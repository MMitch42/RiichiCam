from __future__ import annotations

import io
import hmac
import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from .model import TileDetector, detector_from_environment
from .postprocess import DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_IOU_THRESHOLD


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("riichicam.inference")

MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", "4000000"))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "16000000"))
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def require_upstream_token(request: Request) -> None:
    """Accept only the Vercel broker; browsers never receive this credential."""
    expected = os.getenv("INFERENCE_UPSTREAM_TOKEN", "")
    supplied = request.headers.get("authorization", "")
    if not expected:
        logger.error(json.dumps({"event": "missing_upstream_token"}))
        raise HTTPException(status_code=503, detail="service_not_configured")
    if not hmac.compare_digest(supplied, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="unauthorized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    detector = detector_from_environment()
    await run_in_threadpool(detector.load_and_warm)
    app.state.detector = detector
    # This VM shares its V100 with RiichiCast. Do not queue an arbitrary number
    # of camera scans behind broadcast work; callers receive a fast 503 and can
    # use manual input instead.
    app.state.inference_lock = asyncio.Lock()
    logger.info(
        json.dumps(
            {
                "event": "model_ready",
                "provider": detector.provider,
                "modelVersion": detector.model_version,
                "classProfile": detector.class_profile,
            }
        )
    )
    yield


app = FastAPI(
    title="RiichiCam Inference",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def ready(request: Request) -> dict[str, str]:
    detector: TileDetector | None = getattr(request.app.state, "detector", None)
    if detector is None or detector.session is None:
        raise HTTPException(status_code=503, detail="model_not_ready")
    return {
        "status": "ready",
        "provider": detector.provider,
        "modelVersion": detector.model_version,
        "classProfile": detector.class_profile,
    }


@app.post("/v1/detect")
async def detect(
    request: Request,
    confidence: float = Query(DEFAULT_CONFIDENCE_THRESHOLD, ge=0.0, le=1.0),
    iou: float = Query(DEFAULT_IOU_THRESHOLD, ge=0.0, le=1.0),
) -> JSONResponse:
    require_upstream_token(request)
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type not in {"image/jpeg", "image/jpg"}:
        raise HTTPException(status_code=415, detail="jpeg_required")

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image_too_large")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="image_required")
    if len(body) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image_too_large")

    try:
        image = Image.open(io.BytesIO(body))
        if image.format != "JPEG":
            raise HTTPException(status_code=415, detail="jpeg_required")
        image.load()
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise HTTPException(status_code=413, detail="image_dimensions_too_large")
        image = image.convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=422, detail="invalid_image") from exc

    detector: TileDetector | None = getattr(request.app.state, "detector", None)
    if detector is None:
        raise HTTPException(status_code=503, detail="model_not_ready")

    inference_lock: asyncio.Lock | None = getattr(request.app.state, "inference_lock", None)
    if inference_lock is None or inference_lock.locked():
        raise HTTPException(status_code=503, detail="inference_busy")

    started = time.perf_counter()
    try:
        async with inference_lock:
            result = await run_in_threadpool(detector.detect, image, confidence, iou)
    except Exception:
        logger.exception(json.dumps({"event": "inference_failed", "requestId": request_id}))
        raise HTTPException(status_code=500, detail="inference_failed")

    total_ms = (time.perf_counter() - started) * 1000
    logger.info(
        json.dumps(
            {
                "event": "inference_complete",
                "requestId": request_id,
                "modelVersion": detector.model_version,
                "provider": detector.provider,
                "predictionCount": len(result.predictions),
                "totalMs": round(total_ms, 2),
            }
        )
    )

    return JSONResponse(
        {
            "apiVersion": "1",
            "requestId": request_id,
            "modelVersion": detector.model_version,
            "provider": detector.provider,
            "classProfile": detector.class_profile,
            "image": {"width": result.image_width, "height": result.image_height},
            "predictions": result.predictions,
            "timingMs": {
                "preprocess": round(result.preprocess_ms, 2),
                "inference": round(result.inference_ms, 2),
                "postprocess": round(result.postprocess_ms, 2),
                "total": round(total_ms, 2),
            },
        },
        headers={"x-request-id": request_id, "cache-control": "no-store"},
    )
