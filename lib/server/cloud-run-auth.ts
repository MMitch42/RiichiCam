export interface CloudRunAuthConfig {
  projectNumber: string;
  workloadIdentityPoolId: string;
  workloadIdentityProviderId: string;
  serviceAccountEmail: string;
  cloudRunUrl: string;
}

export const DEFAULT_CLOUD_RUN_AUTH_CONFIG: CloudRunAuthConfig = {
  projectNumber: '1047256919984',
  workloadIdentityPoolId: 'vercel-riichicam',
  workloadIdentityProviderId: 'vercel',
  serviceAccountEmail: 'riichicam-vercel-invoker@riichicast.iam.gserviceaccount.com',
  cloudRunUrl: 'https://riichicam-inference-1047256919984.us-central1.run.app',
};

type Fetch = typeof fetch;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Google authentication response is missing ${field}`);
  }
  return value;
}

async function errorSummary(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 300).replaceAll(/\s+/g, ' ');
}

export function cloudRunAuthConfigFromEnvironment(): CloudRunAuthConfig {
  return {
    projectNumber: process.env.GCP_PROJECT_NUMBER ?? DEFAULT_CLOUD_RUN_AUTH_CONFIG.projectNumber,
    workloadIdentityPoolId:
      process.env.GCP_WORKLOAD_IDENTITY_POOL_ID ??
      DEFAULT_CLOUD_RUN_AUTH_CONFIG.workloadIdentityPoolId,
    workloadIdentityProviderId:
      process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID ??
      DEFAULT_CLOUD_RUN_AUTH_CONFIG.workloadIdentityProviderId,
    serviceAccountEmail:
      process.env.GCP_SERVICE_ACCOUNT_EMAIL ??
      DEFAULT_CLOUD_RUN_AUTH_CONFIG.serviceAccountEmail,
    cloudRunUrl:
      process.env.RIICHICAM_INFERENCE_URL ?? DEFAULT_CLOUD_RUN_AUTH_CONFIG.cloudRunUrl,
  };
}

export async function createCloudRunIdToken(
  vercelOidcToken: string,
  config: CloudRunAuthConfig = cloudRunAuthConfigFromEnvironment(),
  fetchImpl: Fetch = fetch,
): Promise<string> {
  if (!vercelOidcToken) throw new Error('Vercel OIDC token is unavailable');

  const providerAudience =
    `//iam.googleapis.com/projects/${config.projectNumber}` +
    `/locations/global/workloadIdentityPools/${config.workloadIdentityPoolId}` +
    `/providers/${config.workloadIdentityProviderId}`;

  const exchangeResponse = await fetchImpl('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      audience: providerAudience,
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: vercelOidcToken,
    }),
  });

  if (!exchangeResponse.ok) {
    throw new Error(
      `Google STS exchange failed (${exchangeResponse.status}): ` +
      (await errorSummary(exchangeResponse)),
    );
  }

  const exchange = (await exchangeResponse.json()) as Record<string, unknown>;
  const accessToken = requiredString(exchange.access_token, 'access_token');
  const encodedServiceAccount = encodeURIComponent(config.serviceAccountEmail);
  const identityResponse = await fetchImpl(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodedServiceAccount}:generateIdToken`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ audience: config.cloudRunUrl, includeEmail: true }),
    },
  );

  if (!identityResponse.ok) {
    throw new Error(
      `Google ID token generation failed (${identityResponse.status}): ` +
      (await errorSummary(identityResponse)),
    );
  }

  const identity = (await identityResponse.json()) as Record<string, unknown>;
  return requiredString(identity.token, 'token');
}
