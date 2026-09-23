# RiichiCam inference service

Standalone private GPU service for RiichiCam tile detection. The production scorer calls it
through its Vercel broker; the V12 model is never included in the browser deployment.

## API

`POST /v1/detect` accepts the JPEG bytes as the request body with `Content-Type: image/jpeg`.
Optional `confidence` and `iou` query parameters default to the browser detector's current
values (`0.45` and `0.5`). The response preserves the historical `RawPrediction` shape so the
existing TypeScript tile, guided-section, and meld parsing can be reused by a future broker.

```json
{
  "apiVersion": "1",
  "requestId": "uuid",
  "modelVersion": "sha256-prefix",
  "provider": "CUDAExecutionProvider",
  "image": { "width": 1600, "height": 1200 },
  "predictions": [
    { "class": "1m", "confidence": 0.98, "x": 120, "y": 300, "width": 60, "height": 90 }
  ],
  "timingMs": { "preprocess": 8, "inference": 20, "postprocess": 2, "total": 30 }
}
```

Health endpoints are `/healthz` and `/readyz`. Readiness succeeds only after the model has
loaded and a warm-up inference has completed.

## VM deployment: RiichiCam V12 on the shared V100

`docker-compose.vm.example.yml` is the production starting point for the existing
V100 VM. It runs one CUDA worker, mounts the private V12 model read-only, and does
publishes the inference container only to `127.0.0.1:8081`. The VM's existing
Caddy service is the only public ingress; it terminates HTTPS and the service
itself rejects every detection request without its server-only bearer token.

1. Keep `riichicam.com` DNS on Vercel. Add an **A** record in Vercel DNS with
   name `inference` and the VM's public IPv4 address. This exact record overrides
   the existing wildcard record without changing the main site or mail records.
   The existing Caddy service already owns ports 80/443, so do not start another
   Caddy container.
2. On the VM, clone this repository separately from RiichiCast and create the
   ignored file `services/inference/.env`. Generate a token first:

   ```bash
   openssl rand -hex 32
   ```

   Paste that output into the file:

   ```text
   INFERENCE_UPSTREAM_TOKEN=<paste generated token here>
   ```

4. Start the isolated service:

   ```bash
   docker compose --env-file services/inference/.env -f services/inference/docker-compose.vm.example.yml up -d --build
   docker compose --env-file services/inference/.env -f services/inference/docker-compose.vm.example.yml ps
   docker compose --env-file services/inference/.env -f services/inference/docker-compose.vm.example.yml exec inference python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8080/readyz').read().decode())"
   ```

5. Append the content of `Caddyfile.inference.example` to the VM's existing
   `/etc/caddy/Caddyfile`, then validate and reload without interrupting the
   existing RiichiCast routes:

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

6. In Vercel, set production environment variables:

   ```text
   RIICHICAM_SERVER_INFERENCE_ENABLED=true
   RIICHICAM_INFERENCE_URL=https://inference.riichicam.com
   RIICHICAM_INFERENCE_TOKEN=<the same INFERENCE_UPSTREAM_TOKEN>
   ```

Never add the upstream token to Git or browser code. The browser calls
`/api/detect-server`; only that Vercel route knows the upstream token. Set Vercel
values only after the container reports ready, then deploy the web app. RiichiCast
remains on its own loopback port and is not exposed by Caddy.

## Local development

The GPU image requires CUDA. CPU fallback is deliberately opt-in for local testing:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r services/inference/requirements-dev.txt
PYTHONPATH=services/inference REQUIRE_CUDA=false \
  MODEL_PATH=public/models/tile-detector.onnx \
  uvicorn app.main:app --port 8080
```

Run unit tests with:

```bash
PYTHONPATH=services/inference pytest services/inference/tests
```

Build the production image from the repository root so Docker can include the existing model:

```bash
docker build -f services/inference/Dockerfile -t riichicam-inference .
```

The container installs the CUDA 12 / cuDNN 9 ONNX Runtime package and refuses to become ready
if it resolves to CPU in production.

## Legacy CPU-first Cloud Run deployment

`Dockerfile.cpu` packages the smaller RiichiCast v2 model and uses standard ONNX Runtime. The
class profile is explicit because v2's output classes are suit-grouped, unlike the current
browser model. This service can use request-based billing and scale to zero:

```bash
gcloud builds submit \
  --config=services/inference/cloudbuild.cpu.yaml \
  --substitutions=_IMAGE=us-central1-docker.pkg.dev/riichicast/riichicam/inference:riichicast-v2-cpu

gcloud run deploy riichicam-inference \
  --image=us-central1-docker.pkg.dev/riichicast/riichicam/inference:riichicast-v2-cpu \
  --region=us-central1 \
  --execution-environment=gen2 \
  --cpu=2 \
  --memory=2Gi \
  --concurrency=1 \
  --timeout=30s \
  --min=0 \
  --max=1 \
  --cpu-boost \
  --service-account=riichicam-inference-runtime@riichicast.iam.gserviceaccount.com \
  --set-env-vars=REQUIRE_CUDA=false,MODEL_VERSION=riichicast-v2,MODEL_CLASS_PROFILE=riichicast-v2 \
  --no-allow-unauthenticated
```

This path is retained as an alternative deployment scaffold. The V100 VM deployment above is
the active RiichiCam integration.
