FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive \
    MODEL_PATH=/models/tile-detector.onnx \
    REQUIRE_CUDA=true \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3.12 -m venv /venv

ENV PATH=/venv/bin:$PATH

WORKDIR /srv

COPY services/inference/requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY services/inference/app ./app
RUN useradd --create-home --uid 10001 appuser \
    && mkdir /models \
    && chown -R appuser:appuser /srv /models
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
