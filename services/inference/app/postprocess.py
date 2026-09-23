from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image


MODEL_INPUT_SIZE = 640
PAD_VALUE = 114
DEFAULT_CONFIDENCE_THRESHOLD = 0.45
DEFAULT_IOU_THRESHOLD = 0.5

# This order must stay byte-for-byte equivalent to lib/detection/tile-classes.ts.
RIICHICAM_CLASS_NAMES = (
    "1m", "1p", "1s", "1z",
    "2m", "2p", "2s", "2z",
    "3m", "3p", "3s", "3z",
    "4m", "4p", "4s", "4z",
    "5m", "5mr", "5p", "5pr", "5s", "5sr", "5z",
    "6m", "6p", "6s", "6z",
    "7m", "7p", "7s", "7z",
    "8m", "8p", "8s",
    "9m", "9p", "9s",
)

# RiichiCast v2 was trained with suit-grouped classes and red fives last.
RIICHICAST_V2_CLASS_NAMES = (
    "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m",
    "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p",
    "1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s",
    "1z", "2z", "3z", "4z", "5z", "6z", "7z",
    "5mr", "5pr", "5sr",
)

# Backwards-compatible name used by the browser-model contract tests.
CLASS_NAMES = RIICHICAM_CLASS_NAMES

CLASS_PROFILES = {
    "riichicam-current": RIICHICAM_CLASS_NAMES,
    "riichicast-v2": RIICHICAST_V2_CLASS_NAMES,
}


def class_names_for_profile(profile: str) -> tuple[str, ...]:
    try:
        return CLASS_PROFILES[profile]
    except KeyError as exc:
        supported = ", ".join(sorted(CLASS_PROFILES))
        raise ValueError(f"Unknown model class profile {profile!r}; expected one of: {supported}") from exc


@dataclass(frozen=True)
class LetterboxInfo:
    scale: float
    pad_x: float
    pad_y: float
    target_size: int


@dataclass(frozen=True)
class ScoredBox:
    x: float
    y: float
    width: float
    height: float
    score: float
    class_index: int


def compute_letterbox(
    source_width: int,
    source_height: int,
    target_size: int = MODEL_INPUT_SIZE,
) -> LetterboxInfo:
    if source_width <= 0 or source_height <= 0:
        raise ValueError("Image dimensions must be positive")

    scale = min(target_size / source_width, target_size / source_height)
    new_width = round(source_width * scale)
    new_height = round(source_height * scale)
    return LetterboxInfo(
        scale=scale,
        pad_x=(target_size - new_width) / 2,
        pad_y=(target_size - new_height) / 2,
        target_size=target_size,
    )


def preprocess_image(
    image: Image.Image,
    target_size: int = MODEL_INPUT_SIZE,
) -> tuple[np.ndarray, LetterboxInfo]:
    rgb = image.convert("RGB")
    letterbox = compute_letterbox(rgb.width, rgb.height, target_size)
    resized_width = round(rgb.width * letterbox.scale)
    resized_height = round(rgb.height * letterbox.scale)
    resized = rgb.resize((resized_width, resized_height), Image.Resampling.BILINEAR)

    canvas = np.full((target_size, target_size, 3), PAD_VALUE, dtype=np.uint8)
    left = (target_size - resized_width) // 2
    top = (target_size - resized_height) // 2
    canvas[top : top + resized_height, left : left + resized_width] = np.asarray(resized)

    chw = np.transpose(canvas.astype(np.float32) / 255.0, (2, 0, 1))
    return np.expand_dims(np.ascontiguousarray(chw), axis=0), letterbox


def _corners(box: ScoredBox) -> tuple[float, float, float, float]:
    return (
        box.x - box.width / 2,
        box.y - box.height / 2,
        box.x + box.width / 2,
        box.y + box.height / 2,
    )


def intersection_over_union(left: ScoredBox, right: ScoredBox) -> float:
    left_x1, left_y1, left_x2, left_y2 = _corners(left)
    right_x1, right_y1, right_x2, right_y2 = _corners(right)
    intersection_width = max(0.0, min(left_x2, right_x2) - max(left_x1, right_x1))
    intersection_height = max(0.0, min(left_y2, right_y2) - max(left_y1, right_y1))
    intersection_area = intersection_width * intersection_height
    if intersection_area == 0:
        return 0.0

    left_area = left.width * left.height
    right_area = right.width * right.height
    return intersection_area / (left_area + right_area - intersection_area)


def non_max_suppression(boxes: list[ScoredBox], iou_threshold: float) -> list[ScoredBox]:
    by_class: dict[int, list[ScoredBox]] = {}
    for box in boxes:
        by_class.setdefault(box.class_index, []).append(box)

    kept: list[ScoredBox] = []
    for group in by_class.values():
        remaining = sorted(group, key=lambda box: box.score, reverse=True)
        while remaining:
            winner = remaining.pop(0)
            kept.append(winner)
            remaining = [
                candidate
                for candidate in remaining
                if intersection_over_union(winner, candidate) <= iou_threshold
            ]
    return kept


def decode_yolo_output(
    output: np.ndarray,
    letterbox: LetterboxInfo,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    iou_threshold: float = DEFAULT_IOU_THRESHOLD,
    class_names: tuple[str, ...] = CLASS_NAMES,
) -> list[dict[str, float | str]]:
    tensor = np.asarray(output)
    if tensor.ndim == 3 and tensor.shape[0] == 1:
        tensor = tensor[0]
    if tensor.ndim != 2:
        raise ValueError(f"Expected a 2D YOLO output after removing batch, received {tensor.shape}")

    expected_channels = 4 + len(class_names)
    if tensor.shape[0] != expected_channels and tensor.shape[1] == expected_channels:
        tensor = tensor.T
    if tensor.shape[0] != expected_channels:
        raise ValueError(
            f"Model output has {tensor.shape[0] - 4} classes; expected {len(class_names)}"
        )

    class_scores = tensor[4:]
    best_classes = np.argmax(class_scores, axis=0)
    best_scores = np.max(class_scores, axis=0)

    candidates: list[ScoredBox] = []
    for anchor_index in np.flatnonzero(best_scores >= confidence_threshold):
        x, y, width, height = tensor[:4, anchor_index]
        if not np.all(np.isfinite((x, y, width, height, best_scores[anchor_index]))):
            continue
        candidates.append(
            ScoredBox(
                x=float(x),
                y=float(y),
                width=float(width),
                height=float(height),
                score=float(best_scores[anchor_index]),
                class_index=int(best_classes[anchor_index]),
            )
        )

    predictions: list[dict[str, float | str]] = []
    for box in non_max_suppression(candidates, iou_threshold):
        predictions.append(
            {
                "class": class_names[box.class_index],
                "confidence": box.score,
                "x": (box.x - letterbox.pad_x) / letterbox.scale,
                "y": (box.y - letterbox.pad_y) / letterbox.scale,
                "width": box.width / letterbox.scale,
                "height": box.height / letterbox.scale,
            }
        )
    return predictions
