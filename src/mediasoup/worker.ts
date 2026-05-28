import * as mediasoup from 'mediasoup';
import { config } from '../config';

let worker: mediasoup.types.Worker | null = null;

/**
 * 创建（或复用）全局唯一的 Mediasoup Worker 实例
 */
export async function getWorker(): Promise<mediasoup.types.Worker> {
  if (worker) return worker;

  worker = await mediasoup.createWorker({
    logLevel: config.worker.logLevel,
    rtcMinPort: config.worker.rtcMinPort,
    rtcMaxPort: config.worker.rtcMaxPort,
  });

  console.log(`[Mediasoup] Worker 已启动 (PID: ${worker.pid})`);

  worker.on('died', () => {
    console.error('[Mediasoup] Worker 异常退出');
    worker = null;
  });

  return worker;
}

/**
 * 析构 Worker（进程退出时调用）
 */
export async function closeWorker(): Promise<void> {
  if (worker) {
    worker.close();
    worker = null;
    console.log('[Mediasoup] Worker 已关闭');
  }
}
