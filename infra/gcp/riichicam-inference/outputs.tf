output "artifact_registry_repository" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.inference.repository_id}"
}

output "cloud_run_url" {
  value = google_cloud_run_v2_service.inference.uri
}

output "vercel_invoker_service_account" {
  value = google_service_account.vercel_invoker.email
}

output "workload_identity_pool_id" {
  value = google_iam_workload_identity_pool.vercel.workload_identity_pool_id
}

output "workload_identity_provider_id" {
  value = google_iam_workload_identity_pool_provider.vercel.workload_identity_pool_provider_id
}

