# Dedicated RiichiCam Cloud Run service

This module creates a separate CPU-only `riichicam-inference` service rather than adding
camera traffic to RiichiCast ingest. It defaults to request-based billing, zero minimum
instances, and one maximum instance, so idle compute scales away while early spend stays
bounded. The measured RiichiCast v2 model latency does not currently justify an L4.

It also creates:

- a dedicated runtime service account with no project roles;
- a dedicated Vercel invoker service account with only `roles/run.invoker` on this service;
- a Vercel OIDC Workload Identity Federation pool/provider;
- a regional Artifact Registry Docker repository.

The Cloud Run endpoint uses public network ingress because Vercel is outside GCP, but Cloud Run
IAM still rejects unauthenticated callers. No browser-visible or long-lived API key is created.

## Bootstrap order

Cloud Run cannot deploy until the referenced container exists, so bootstrap in two passes:

1. Copy `terraform.tfvars.example` to an ignored `terraform.tfvars` and fill in the project and
   exact Vercel team/project names.
2. Confirm billing is enabled, then create the APIs and registry:

   ```bash
   terraform init
   terraform apply -target=google_project_service.required \
     -target=google_artifact_registry_repository.inference
   ```

3. Place the private model artifact in the ignored `services/inference/models/` directory,
   then build and push from the repository root:

   ```bash
   gcloud auth configure-docker us-central1-docker.pkg.dev
   gcloud builds submit \
     --config=services/inference/cloudbuild.cpu.yaml \
     --substitutions=_IMAGE=us-central1-docker.pkg.dev/PROJECT_ID/riichicam/inference:MODEL_VERSION
   ```

4. Resolve the pushed digest, place the immutable `@sha256:...` URL in `container_image`, then
   run `terraform apply` normally.

5. Enable Vercel's team-mode OIDC issuer in the RiichiCam project. A future Next.js broker will
   exchange the short-lived Vercel token through this pool, impersonate the invoker service
   account, and mint the Google ID token Cloud Run expects.

This is an optional private deployment path. RiichiCam's production browser sends scan images
only to its authenticated private inference service and never downloads model files or an
inference runtime.

## Existing `riichicast` deployment

The live service, registry, service accounts, and Workload Identity resources were initially
bootstrapped with `gcloud`. Before the first `terraform apply` against that project, import
those existing resources into the chosen Terraform state. Applying this module from an empty
state without importing them will correctly stop on duplicate-resource errors rather than
adopting them implicitly.
