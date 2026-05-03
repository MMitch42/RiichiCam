import { put } from '@vercel/blob';

export interface TrainingMeta {
  timestamp: string;
  mode: string;
  sessionId: string;
  predictions: unknown[];
  imageWidth?: number;
  imageHeight?: number;
}

export async function saveTrainingImage(base64: string, meta: TrainingMeta): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;

  const key = `training/${meta.timestamp}_${meta.sessionId}_${meta.mode}`;

  await Promise.all([
    put(`${key}.jpg`, Buffer.from(base64, 'base64'), {
      access: 'private',
      contentType: 'image/jpeg',
    }),
    put(`${key}.json`, JSON.stringify(meta), {
      access: 'private',
      contentType: 'application/json',
    }),
  ]);
}
