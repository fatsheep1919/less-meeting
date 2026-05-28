import type { ServerMessage, ClientMessage } from './types';

type MessageHandler = (msg: ServerMessage) => void;

/**
 * WebSocket 信令客户端
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private onCloseCb: (() => void) | null = null;

  /** 连接信令服务器 */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

      // 开发模式下 Vite proxy 通过 /ws 路径代理到后端
      // 生产模式下同一个端口，直接连接
      const wsUrl = `${protocol}//${location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] 已连接');
        resolve();
      };

      this.ws.onerror = () => {
        reject(new Error('WebSocket 连接失败'));
      };

      this.ws.onclose = () => {
        console.log('[WS] 已断开');
        this.onCloseCb?.();
      };

      this.ws.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data) as ServerMessage;
          const list = this.handlers.get(msg.type);
          if (list) {
            list.forEach((h) => h(msg));
          }
        } catch {
          console.warn('[WS] 无法解析消息:', e.data);
        }
      };
    });
  }

  /** 发送消息 */
  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** 注册事件处理 */
  on(type: string, handler: MessageHandler): void {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** 移除事件处理 */
  off(type: string, handler: MessageHandler): void {
    const list = this.handlers.get(type);
    if (list) {
      this.handlers.set(
        type,
        list.filter((h) => h !== handler)
      );
    }
  }

  /** 断开回调 */
  setOnClose(cb: () => void): void {
    this.onCloseCb = cb;
  }

  /** 主动关闭 */
  close(): void {
    this.ws?.close();
    this.handlers.clear();
  }
}
