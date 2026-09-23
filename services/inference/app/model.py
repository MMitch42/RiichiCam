from __future__ import annotations

import hashlib
import os
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .postprocess import class_names_for_profile, decode_yolo_output, preprocess_image


@dataclass(frozen=True)
class DetectionResult:
    predictions: list[dict[str, float | str]]
    image_width: int
    image_height: int
    preprocess_ms: float
    inference_ms: float
    postprocess_ms: float


class TileDetector:
    def __init__(
        self,
        model_path: Path,
        require_cuda: bool = True,
        class_profile: str = "riichicam-current",
    ) -> None:
        self.model_path = model_path
        self.require_cuda = require_cuda
        self.class_profile = class_profile
        self.class_names = class_names_for_profile(class_profile)
        self.session = None
        self.input_name = ""
        self.output_name = ""
        self.provider = "unloaded"
        self.model_version = os.getenv("MODEL_VERSION", "")

    def load_and_warm(self) -> None:
        import onnxruntime as ort

        if not self.model_path.is_file():
            raise RuntimeError(f"Model not found at {self.model_path}")

        # The production wheel installs CUDA/cuDNN through its optional extras.
        # Explicitly preload those site-package libraries before ORT constructs
        # the CUDA provider; otherwise a valid GPU image can silently fall back
        # because the dynamic linker did not discover cuDNN.
        if self.require_cuda and hasattr(ort, "preload_dlls"):
            ort.preload_dlls(directory="")

        available = ort.get_available_providers()
        if self.require_cuda and "CUDAExecutionProvider" not in available:
            raise RuntimeError(
                "CUDAExecutionProvider is required but unavailable; "
                f"installed providers: {available}"
            )

        providers = []
        if "CUDAExecutionProvider" in available:
            providers.append("CUDAExecutionProvider")
        providers.append("CPUExecutionProvider")

        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=options,
            providers=providers,
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.provider = self.session.get_providers()[0]

        if self.require_cuda and self.provider != "CUDAExecutionProvider":
            raise RuntimeError(f"Model unexpectedly resolved to {self.provider}")

        self.session.run(
            [self.output_name],
            {self.input_name: np.zeros((1, 3, 640, 640), dtype=np.float32)},
        )

        if not self.model_version:
            digest = hashlib.sha256()
            with self.model_path.open("rb") as model_file:
                for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
                    digest.update(chunk)
            self.model_version = digest.hexdigest()[:12]

    def detect(
        self,
        image: Image.Image,
        confidence_threshold: float,
        iou_threshold: float,
    ) -> DetectionResult:
        if self.session is None:
            raise RuntimeError("Detector has not been loaded")

        preprocess_start = time.perf_counter()
        tensor, letterbox = preprocess_image(image)
        preprocess_ms = (time.perf_counter() - preprocess_start) * 1000

        inference_start = time.perf_counter()
        output = self.session.run(
            [self.output_name],
            {self.input_name: tensor},
        )[0]
        inference_ms = (time.perf_counter() - inference_start) * 1000

        postprocess_start = time.perf_counter()
        predictions = decode_yolo_output(
            output,
            letterbox,
            confidence_threshold=confidence_threshold,
            iou_threshold=iou_threshold,
            class_names=self.class_names,
        )
        postprocess_ms = (time.perf_counter() - postprocess_start) * 1000

        return DetectionResult(
            predictions=predictions,
            image_width=image.width,
            image_height=image.height,
            preprocess_ms=preprocess_ms,
            inference_ms=inference_ms,
            postprocess_ms=postprocess_ms,
        )


def detector_from_environment() -> TileDetector:
    model_path = Path(os.getenv("MODEL_PATH", "/models/tile-detector.onnx"))
    require_cuda = os.getenv("REQUIRE_CUDA", "true").lower() not in {"0", "false", "no"}
    class_profile = os.getenv("MODEL_CLASS_PROFILE", "riichicam-current")
    return TileDetector(
        model_path=model_path,
        require_cuda=require_cuda,
        class_profile=class_profile,
    )
