import express from 'express';
import http from 'http';
import { config } from './config';
import { createWSServer } from './signaling/handlers';
import { roomManager } from './room/RoomManager';
import { getWorker, closeWorker } from './mediasoup/worker';
import path from 'path';

async function main(): Promise<void> {
  // 1. 初始化 Mediasoup Worker
  try {
    await getWorker();
    console.log('[Server] Mediasoup Worker 就绪');
  } catch (err) {
    console.error('[Server] Mediasoup Worker 启动失败:', err);
    process.exit(1);
  }

  // 2. 创建 HTTP 服务
  const app = express();
  app.use(express.json());

  // 静态文件（前端）
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  const server = http.createServer(app);

  // 3. WebSocket 服务
  const wss = createWSServer();

  // HTTP → WebSocket 升级
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  // 4. REST API

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      rooms: roomManager.getRoomCount(),
    });
  });

  /**
   * POST /rooms
   * Body: { name: string, passcode?: string }
   * 创建一个新房间，返回 roomId、name、passcode 和 url
   */
  app.post('/rooms', async (req, res) => {
    try {
      const { name, passcode } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: '请提供房间名称' });
        return;
      }
      const result = await roomManager.createRoom(name.trim(), passcode || undefined);
      const url = `/room/${result.roomId}?p=${result.passcode}`;
      res.json({ ...result, url });
    } catch (err) {
      console.error('[API] 创建房间失败:', err);
      res.status(500).json({ error: '创建房间失败' });
    }
  });

  /**
   * GET /rooms/:roomId
   * 检查房间是否存在及人数（API）
   */
  app.get('/api/rooms/:roomId', (req, res) => {
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: '房间不存在' });
      return;
    }
    res.json({
      roomId: room.id,
      name: room.name,
      peerCount: room.peers.size,
      maxPeers: room.maxPeers,
      createdAt: room.createdAt.toISOString(),
    });
  });

  // SPA fallback — 所有非 API 请求返回前端 index.html（必须放在最后）
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // 5. 启动
  server.listen(config.listenPort, config.listenIp, () => {
    console.log('');
    console.log('=========================================');
    console.log('  Less Meeting 服务端已启动');
    console.log(`  HTTP/WS: http://${config.listenIp}:${config.listenPort}`);
    console.log(`  RTC 端口: ${config.worker.rtcMinPort}-${config.worker.rtcMaxPort}`);
    console.log(`  宣告 IP: ${config.announcedIp}`);
    console.log('=========================================');
    console.log('');
  });

  // 6. 优雅关闭
  const shutdown = async () => {
    console.log('\n[Server] 正在关闭...');

    // 关闭 WebSocket 服务
    wss.close();

    // 清理所有房间
    await roomManager.shutdown();

    // 关闭 Mediasoup Worker
    await closeWorker();

    // 停止 HTTP 服务
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Server] 启动失败:', err);
  process.exit(1);
});
