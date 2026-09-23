#!/usr/bin/env python3
"""Compare the RiichiCam and RiichiCast v2 detectors on reviewed frames.

The script intentionally reads models and review data in place. It never copies,
modifies, or exports the source images or annotations.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


CURRENT_LABELS = (
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

RIICHICAST_V2_LABELS = (
    "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m",
    "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p",
    "1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s",
    "1z", "2z", "3z", "4z", "5z", "6z", "7z",
    "5mr", "5pr", "5sr",
)

MODEL_SIZE = 640
PAD_VALUE = 114


@dataclass(frozen=True)
class Box:
    label: str
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float = 1.0


@dataclass(frozen=True)
class Frame:
    frame_id: str
    image_path: Path
    boxes: tuple[Box, ...]


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * fraction))
    return ordered[index]


def iou(left: Box, right: Box) -> float:
    ix1 = max(left.x1, right.x1)
    iy1 = max(left.y1, right.y1)
    ix2 = min(left.x2, right.x2)
    iy2 = min(left.y2, right.y2)
    intersection = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if intersection == 0:
        return 0.0
    left_area = max(0.0, left.x2 - left.x1) * max(0.0, left.y2 - left.y1)
    right_area = max(0.0, right.x2 - right.x1) * max(0.0, right.y2 - right.y1)
    union = left_area + right_area - intersection
    return intersection / union if union > 0 else 0.0


def preprocess(image: Image.Image) -> tuple[np.ndarray, float, int, int]:
    rgb = image.convert("RGB")
    scale = min(MODEL_SIZE / rgb.width, MODEL_SIZE / rgb.height)
    resized_width = round(rgb.width * scale)
    resized_height = round(rgb.height * scale)
    resized = rgb.resize((resized_width, resized_height), Image.Resampling.BILINEAR)
    left = (MODEL_SIZE - resized_width) // 2
    top = (MODEL_SIZE - resized_height) // 2
    canvas = np.full((MODEL_SIZE, MODEL_SIZE, 3), PAD_VALUE, dtype=np.uint8)
    canvas[top : top + resized_height, left : left + resized_width] = np.asarray(resized)
    chw = np.transpose(canvas.astype(np.float32) / 255.0, (2, 0, 1))
    return np.expand_dims(np.ascontiguousarray(chw), 0), scale, left, top


def nms(boxes: np.ndarray, scores: np.ndarray, threshold: float) -> list[int]:
    if len(boxes) == 0:
        return []
    order = np.argsort(-scores)
    keep: list[int] = []
    while order.size:
        winner = int(order[0])
        keep.append(winner)
        if order.size == 1:
            break
        rest = order[1:]
        intersections_x1 = np.maximum(boxes[winner, 0], boxes[rest, 0])
        intersections_y1 = np.maximum(boxes[winner, 1], boxes[rest, 1])
        intersections_x2 = np.minimum(boxes[winner, 2], boxes[rest, 2])
        intersections_y2 = np.minimum(boxes[winner, 3], boxes[rest, 3])
        intersection = (
            np.maximum(0.0, intersections_x2 - intersections_x1)
            * np.maximum(0.0, intersections_y2 - intersections_y1)
        )
        winner_area = max(0.0, boxes[winner, 2] - boxes[winner, 0]) * max(
            0.0, boxes[winner, 3] - boxes[winner, 1]
        )
        rest_area = np.maximum(0.0, boxes[rest, 2] - boxes[rest, 0]) * np.maximum(
            0.0, boxes[rest, 3] - boxes[rest, 1]
        )
        union = winner_area + rest_area - intersection
        overlaps = np.divide(intersection, union, out=np.zeros_like(intersection), where=union > 0)
        order = rest[overlaps <= threshold]
    return keep


def decode(
    output: np.ndarray,
    labels: tuple[str, ...],
    scale: float,
    left: int,
    top: int,
    image_width: int,
    image_height: int,
    confidence_floor: float,
    nms_threshold: float,
) -> list[Box]:
    tensor = output[0] if output.ndim == 3 else output
    expected_channels = 4 + len(labels)
    if tensor.shape[0] != expected_channels and tensor.shape[1] == expected_channels:
        tensor = tensor.T
    if tensor.shape[0] != expected_channels:
        raise ValueError(f"Unexpected output shape {output.shape} for {len(labels)} labels")

    class_scores = tensor[4:]
    class_indices = np.argmax(class_scores, axis=0)
    scores = np.max(class_scores, axis=0)
    candidate_indices = np.flatnonzero(scores >= confidence_floor)
    if not candidate_indices.size:
        return []

    xywh = tensor[:4, candidate_indices].T
    candidate_scores = scores[candidate_indices]
    candidate_classes = class_indices[candidate_indices]
    boxes = np.column_stack(
        (
            xywh[:, 0] - xywh[:, 2] / 2,
            xywh[:, 1] - xywh[:, 3] / 2,
            xywh[:, 0] + xywh[:, 2] / 2,
            xywh[:, 1] + xywh[:, 3] / 2,
        )
    )

    kept: list[int] = []
    for class_index in np.unique(candidate_classes):
        class_positions = np.flatnonzero(candidate_classes == class_index)
        class_keep = nms(boxes[class_positions], candidate_scores[class_positions], nms_threshold)
        kept.extend(int(class_positions[position]) for position in class_keep)

    predictions: list[Box] = []
    for position in kept:
        x1, y1, x2, y2 = boxes[position]
        predictions.append(
            Box(
                label=labels[int(candidate_classes[position])],
                x1=max(0.0, min(float(image_width), (float(x1) - left) / scale)),
                y1=max(0.0, min(float(image_height), (float(y1) - top) / scale)),
                x2=max(0.0, min(float(image_width), (float(x2) - left) / scale)),
                y2=max(0.0, min(float(image_height), (float(y2) - top) / scale)),
                confidence=float(candidate_scores[position]),
            )
        )
    return sorted(predictions, key=lambda box: box.confidence, reverse=True)


class Detector:
    def __init__(self, model_path: Path, labels: tuple[str, ...]) -> None:
        self.model_path = model_path
        self.labels = labels
        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(
            str(model_path), sess_options=options, providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.session.run(
            [self.output_name],
            {self.input_name: np.zeros((1, 3, MODEL_SIZE, MODEL_SIZE), dtype=np.float32)},
        )

    def predict(self, image: Image.Image) -> tuple[list[Box], dict[str, float]]:
        preprocess_start = time.perf_counter()
        tensor, scale, left, top = preprocess(image)
        preprocess_ms = (time.perf_counter() - preprocess_start) * 1000

        inference_start = time.perf_counter()
        output = self.session.run([self.output_name], {self.input_name: tensor})[0]
        inference_ms = (time.perf_counter() - inference_start) * 1000

        postprocess_start = time.perf_counter()
        predictions = decode(
            output,
            self.labels,
            scale,
            left,
            top,
            image.width,
            image.height,
            confidence_floor=0.01,
            nms_threshold=0.5,
        )
        postprocess_ms = (time.perf_counter() - postprocess_start) * 1000
        return predictions, {
            "preprocess_ms": preprocess_ms,
            "inference_ms": inference_ms,
            "postprocess_ms": postprocess_ms,
        }


def load_frames(reviews_dir: Path, data_root: Path, limit: int | None) -> list[Frame]:
    frames: list[Frame] = []
    for review_path in sorted(reviews_dir.glob("*.json")):
        review = json.loads(review_path.read_text())
        if review.get("reviewed") is not True:
            continue
        image_path = Path(review["thumbnail_path"])
        if not image_path.is_absolute():
            image_path = data_root / image_path
        if not image_path.is_file():
            continue
        boxes = tuple(
            Box(
                label=item["class_label"],
                x1=float(item["bbox"]["x1"]),
                y1=float(item["bbox"]["y1"]),
                x2=float(item["bbox"]["x2"]),
                y2=float(item["bbox"]["y2"]),
            )
            for item in review["boxes"]
        )
        frames.append(Frame(review_path.stem, image_path, boxes))
        if limit is not None and len(frames) >= limit:
            break
    return frames


def match_frame(
    truth: tuple[Box, ...], predictions: list[Box], threshold: float, require_label: bool = True
) -> tuple[int, int, int, int, int]:
    selected = [box for box in predictions if box.confidence >= threshold]
    unmatched = set(range(len(truth)))
    true_positives = 0
    localized = 0
    correct_labels = 0
    for prediction in selected:
        candidates = [
            (iou(prediction, truth[index]), index)
            for index in unmatched
            if not require_label or prediction.label == truth[index].label
        ]
        if not candidates:
            continue
        overlap, index = max(candidates)
        if overlap >= 0.5:
            unmatched.remove(index)
            true_positives += 1
            localized += 1
            correct_labels += int(prediction.label == truth[index].label)
    return true_positives, len(selected) - true_positives, len(unmatched), localized, correct_labels


def threshold_metrics(
    frames: list[Frame], predictions: dict[str, list[Box]], threshold: float
) -> dict[str, float | int]:
    true_positives = false_positives = false_negatives = exact_frames = 0
    localized = correct_labels = 0
    for frame in frames:
        tp, fp, fn, _, _ = match_frame(frame.boxes, predictions[frame.frame_id], threshold)
        true_positives += tp
        false_positives += fp
        false_negatives += fn
        exact_frames += int(fp == 0 and fn == 0)
        _, _, _, local_count, correct_count = match_frame(
            frame.boxes, predictions[frame.frame_id], threshold, require_label=False
        )
        localized += local_count
        correct_labels += correct_count
    precision = true_positives / (true_positives + false_positives) if true_positives + false_positives else 0.0
    recall = true_positives / (true_positives + false_negatives) if true_positives + false_negatives else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "threshold": threshold,
        "true_positives": true_positives,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "exact_frame_rate": exact_frames / len(frames) if frames else 0.0,
        "label_accuracy_on_localized_boxes": correct_labels / localized if localized else 0.0,
    }


def average_precision(recall: np.ndarray, precision: np.ndarray) -> float:
    mrec = np.concatenate(([0.0], recall, [1.0]))
    mpre = np.concatenate(([0.0], precision, [0.0]))
    mpre = np.maximum.accumulate(mpre[::-1])[::-1]
    changes = np.flatnonzero(mrec[1:] != mrec[:-1])
    return float(np.sum((mrec[changes + 1] - mrec[changes]) * mpre[changes + 1]))


def map50(frames: list[Frame], predictions: dict[str, list[Box]]) -> tuple[float, dict[str, float]]:
    labels = sorted({box.label for frame in frames for box in frame.boxes})
    per_class: dict[str, float] = {}
    for label in labels:
        truth_by_frame = {
            frame.frame_id: [box for box in frame.boxes if box.label == label] for frame in frames
        }
        truth_count = sum(len(boxes) for boxes in truth_by_frame.values())
        used = {frame_id: set() for frame_id in truth_by_frame}
        candidates = sorted(
            (
                (prediction.confidence, frame.frame_id, prediction)
                for frame in frames
                for prediction in predictions[frame.frame_id]
                if prediction.label == label
            ),
            reverse=True,
            key=lambda item: item[0],
        )
        true_positive_flags: list[float] = []
        false_positive_flags: list[float] = []
        for _, frame_id, prediction in candidates:
            overlaps = [
                (iou(prediction, truth), index)
                for index, truth in enumerate(truth_by_frame[frame_id])
                if index not in used[frame_id]
            ]
            best_overlap, best_index = max(overlaps, default=(0.0, -1))
            matched = best_overlap >= 0.5
            if matched:
                used[frame_id].add(best_index)
            true_positive_flags.append(float(matched))
            false_positive_flags.append(float(not matched))
        if not candidates:
            per_class[label] = 0.0
            continue
        cumulative_tp = np.cumsum(true_positive_flags)
        cumulative_fp = np.cumsum(false_positive_flags)
        recall = cumulative_tp / truth_count
        precision = cumulative_tp / np.maximum(cumulative_tp + cumulative_fp, 1e-12)
        per_class[label] = average_precision(recall, precision)
    return statistics.fmean(per_class.values()) if per_class else 0.0, per_class


def evaluate(name: str, model_path: Path, labels: tuple[str, ...], frames: list[Frame]) -> dict:
    detector = Detector(model_path, labels)
    predictions: dict[str, list[Box]] = {}
    timings: dict[str, list[float]] = {
        "preprocess_ms": [],
        "inference_ms": [],
        "postprocess_ms": [],
    }
    started = time.perf_counter()
    for index, frame in enumerate(frames, 1):
        with Image.open(frame.image_path) as image:
            frame_predictions, frame_timings = detector.predict(image)
        predictions[frame.frame_id] = frame_predictions
        for timing_name, value in frame_timings.items():
            timings[timing_name].append(value)
        if index % 25 == 0 or index == len(frames):
            print(f"{name}: {index}/{len(frames)} frames", flush=True)

    thresholds = [round(value, 2) for value in np.arange(0.1, 0.76, 0.05)]
    metrics_by_threshold = [threshold_metrics(frames, predictions, value) for value in thresholds]
    best = max(metrics_by_threshold, key=lambda item: item["f1"])
    mean_ap50, per_class_ap50 = map50(frames, predictions)
    timing_summary = {
        timing_name: {
            "mean": statistics.fmean(values),
            "p50": percentile(values, 0.50),
            "p95": percentile(values, 0.95),
        }
        for timing_name, values in timings.items()
    }
    return {
        "name": name,
        "model_path": str(model_path),
        "model_bytes": model_path.stat().st_size,
        "provider": detector.session.get_providers()[0],
        "frames": len(frames),
        "ground_truth_boxes": sum(len(frame.boxes) for frame in frames),
        "map50": mean_ap50,
        "per_class_ap50": per_class_ap50,
        "best_f1": best,
        "at_0_25": threshold_metrics(frames, predictions, 0.25),
        "at_0_45": threshold_metrics(frames, predictions, 0.45),
        "local_cpu_timings": timing_summary,
        "wall_seconds": time.perf_counter() - started,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--current-model", type=Path, required=True)
    parser.add_argument("--candidate-model", type=Path, required=True)
    parser.add_argument("--reviews-dir", type=Path, required=True)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    frames = load_frames(args.reviews_dir, args.data_root, args.limit)
    if not frames:
        raise SystemExit("No reviewed frames with available images were found")
    result = {
        "dataset": {
            "reviewed_frames": len(frames),
            "boxes": sum(len(frame.boxes) for frame in frames),
            "source": str(args.reviews_dir),
            "warning": (
                "These reviews predate the RiichiCast v2 model and may overlap its training set. "
                "Treat this as an in-domain fit comparison, not a held-out generalization score."
            ),
        },
        "models": [
            evaluate("riichicam-current", args.current_model, CURRENT_LABELS, frames),
            evaluate("riichicast-v2", args.candidate_model, RIICHICAST_V2_LABELS, frames),
        ],
    }
    rendered = json.dumps(result, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n")
    print(rendered)


if __name__ == "__main__":
    main()
