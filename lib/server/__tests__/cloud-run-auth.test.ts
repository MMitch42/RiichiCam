import { describe, expect, it, vi } from 'vitest';
import {
  createCloudRunIdToken,
  DEFAULT_CLOUD_RUN_AUTH_CONFIG,
} from '../cloud-run-auth';

describe('createCloudRunIdToken', () => {
  it('exchanges the Vercel token and mints a Cloud Run audience token', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'federated-token' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'cloud-run-id-token' })));

    const result = await createCloudRunIdToken(
      'vercel-token',
      DEFAULT_CLOUD_RUN_AUTH_CONFIG,
      fetchMock,
    );

    expect(result).toBe('cloud-run-id-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const exchangeBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(exchangeBody).toMatchObject({
      audience:
        '//iam.googleapis.com/projects/1047256919984/locations/global/' +
        'workloadIdentityPools/vercel-riichicam/providers/vercel',
      subjectToken: 'vercel-token',
    });

    const identityRequest = fetchMock.mock.calls[1];
    expect(identityRequest[0]).toContain('riichicam-vercel-invoker%40riichicast');
    expect(identityRequest[1]?.headers).toMatchObject({
      authorization: 'Bearer federated-token',
    });
    expect(JSON.parse(String(identityRequest[1]?.body))).toEqual({
      audience: DEFAULT_CLOUD_RUN_AUTH_CONFIG.cloudRunUrl,
      includeEmail: true,
    });
  });

  it('summarizes a rejected STS response', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('invalid subject token', { status: 403 }),
    );

    await expect(
      createCloudRunIdToken('bad-token', DEFAULT_CLOUD_RUN_AUTH_CONFIG, fetchMock),
    ).rejects.toThrow('Google STS exchange failed (403): invalid subject token');
  });

  it('rejects an empty Vercel token before making a network request', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    await expect(
      createCloudRunIdToken('', DEFAULT_CLOUD_RUN_AUTH_CONFIG, fetchMock),
    ).rejects.toThrow('Vercel OIDC token is unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
