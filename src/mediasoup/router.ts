import type { types } from 'mediasoup';
import { getWorker } from './worker';
import { mediaCodecs } from './config';

/**
 * 为一个房间创建一个 Mediasoup Router
 */
export async function createRouter(): Promise<types.Router> {
  const worker = await getWorker();
  const router = await worker.createRouter({ mediaCodecs });
  console.log(`[Mediasoup] Router 已创建 (id: ${router.id})`);
  return router;
}
