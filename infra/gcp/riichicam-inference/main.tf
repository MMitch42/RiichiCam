data "google_project" "current" {
  project_id = var.project_id
}

locals {
  vercel_subject = "owner:${var.vercel_team_slug}:project:${var.vercel_project_name}:environment:${var.vercel_environment}"
}

resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "sts.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "inference" {
  project       = var.project_id
  location      = var.region
  repository_id = "riichicam"
  description   = "RiichiCam inference containers"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "riichicam-inference-runtime"
  display_name = "RiichiCam inference runtime"
}

resource "google_service_account" "vercel_invoker" {
  project      = var.project_id
  account_id   = "riichicam-vercel-invoker"
  display_name = "RiichiCam Vercel Cloud Run invoker"
}

resource "google_iam_workload_identity_pool" "vercel" {
  project                   = var.project_id
  workload_identity_pool_id = "vercel-riichicam"
  display_name              = "Vercel RiichiCam"
  description               = "Short-lived Vercel identities for RiichiCam production"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "vercel" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.vercel.workload_identity_pool_id
  workload_identity_pool_provider_id = "vercel"
  display_name                       = "Vercel OIDC"

  attribute_mapping = {
    "google.subject" = "assertion.sub"
  }

  attribute_condition = "assertion.sub == '${local.vercel_subject}'"

  oidc {
    issuer_uri        = "https://oidc.vercel.com/${var.vercel_team_slug}"
    allowed_audiences = ["https://vercel.com/${var.vercel_team_slug}"]
  }
}

resource "google_service_account_iam_member" "vercel_can_impersonate" {
  service_account_id = google_service_account.vercel_invoker.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.vercel.workload_identity_pool_id}/subject/${local.vercel_subject}"
}

resource "google_cloud_run_v2_service" "inference" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.runtime.email
    timeout                          = "30s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.container_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "REQUIRE_CUDA"
        value = "false"
      }

      env {
        name  = "MODEL_VERSION"
        value = var.model_version
      }

      env {
        name  = "MODEL_CLASS_PROFILE"
        value = var.model_class_profile
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 1
        period_seconds        = 2
        failure_threshold     = 180

        http_get {
          path = "/readyz"
          port = 8080
        }
      }

      liveness_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 1
        period_seconds        = 10
        failure_threshold     = 3

        http_get {
          path = "/healthz"
          port = 8080
        }
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "vercel_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.inference.location
  name     = google_cloud_run_v2_service.inference.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.vercel_invoker.email}"
}
