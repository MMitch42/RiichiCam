variable "project_id" {
  description = "Google Cloud project that will own the dedicated RiichiCam service."
  type        = string
}

variable "region" {
  description = "Cloud Run and Artifact Registry region."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Dedicated Cloud Run service name."
  type        = string
  default     = "riichicam-inference"
}

variable "container_image" {
  description = "Immutable Artifact Registry image URL, preferably pinned by digest."
  type        = string
}

variable "model_version" {
  description = "Human-readable model version returned by the API. Empty uses a SHA-256 prefix."
  type        = string
  default     = ""
}

variable "model_class_profile" {
  description = "Class ordering used by the selected ONNX model."
  type        = string
  default     = "riichicast-v2"
}

variable "cpu" {
  description = "vCPUs allocated while an inference request is active."
  type        = string
  default     = "2"
}

variable "memory" {
  description = "Memory allocated while an inference request is active."
  type        = string
  default     = "2Gi"
}

variable "min_instances" {
  description = "Keep zero for scale-to-zero; raise only after measuring cold-start impact."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Cost and concurrency guardrail for inference instances."
  type        = number
  default     = 1
}

variable "vercel_team_slug" {
  description = "Vercel team/owner slug used by the OIDC issuer and audience."
  type        = string
}

variable "vercel_project_name" {
  description = "Exact Vercel project name allowed to invoke production inference."
  type        = string
}

variable "vercel_environment" {
  description = "Vercel environment allowed to invoke this service."
  type        = string
  default     = "production"
}
