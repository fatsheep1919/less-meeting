# 部署指南 / Deployment Guide

[中文](#中文) · [English](#english)

---

## 中文

### 前置条件

- 一台云服务器（CentOS 7+ / Ubuntu 20.04+）
- 安装 Docker 和 Docker Compose：[官方安装指南](https://docs.docker.com/engine/install/)
- 防火墙/安全组已开放以下端口：

| 端口 | 协议 | 用途 |
|------|------|------|
| 80 | TCP | HTTP → 自动跳转 HTTPS |
| 443 | TCP | HTTPS（Nginx + SSL 终止） |
| 3478 | TCP+UDP | TURN 服务器（可选） |
| 40000-49999 | UDP | WebRTC 媒体流 |

> ⚠️ **HTTPS 必须**：浏览器只允许在安全上下文（HTTPS 或 localhost）中访问麦克风。本项目内置 Nginx + SSL 方案。

### 部署步骤

#### 1. 登录服务器

```bash
ssh root@你的服务器IP
```

#### 2. 克隆项目

```bash
git clone <你的仓库地址> less-meeting
cd less-meeting
```

#### 3. 配置环境变量

```bash
cp .env.example .env
vim .env
```

修改 `ANNOUNCED_IP` 为服务器的**公网 IP**：

```
ANNOUNCED_IP=123.456.789.0
```

#### 4. 构建并启动

```bash
docker compose up -d --build
```

首次构建约 3-5 分钟。检查服务状态：

```bash
docker compose logs less-meeting
# [Server] Mediasoup Worker 就绪
# Less Meeting 服务端已启动
```

#### 5. 配置 HTTPS

**路径 A：自签名证书（无域名）**

```bash
bash gen-certs.sh
docker compose up -d
```

访问 `https://你的公网IP`，点击「高级 → 继续访问」即可。

**路径 B：Let's Encrypt（需要域名）**

```bash
docker compose stop nginx
apt-get update && apt-get install -y certbot
certbot certonly --standalone -d your-domain.com
ln -sf /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/fullchain.pem
ln -sf /etc/letsencrypt/live/your-domain.com/privkey.pem certs/privkey.pem
docker compose up -d
```

自动续期：

```bash
crontab -e
# 添加：
0 3 * * * certbot renew --quiet && docker compose restart nginx
```

#### 6. 验证

- 路径 A：`https://你的公网IP`
- 路径 B：`https://your-domain.com`

```bash
curl -s localhost:3000/health
# {"status":"ok","uptime":...,"rooms":0}
```

---

### 排查问题

**对方听不到声音**

1. 确认防火墙 UDP 40000-49999 已开放
2. 确认 `.env` 中 `ANNOUNCED_IP` 为公网 IP
3. `docker compose logs less-meeting | grep ERROR`

**无法访问页面**

1. 确认防火墙 TCP 80、443 已开放
2. `docker compose ps nginx` 确认运行中

**麦克风报错**

确认通过 **HTTPS** 访问，地址栏以 `https://` 开头。

**Mediasoup Worker 启动失败**

```bash
docker exec -it less-meeting ls /app/node_modules/mediasoup/worker/out/Release/
```

---

## English

### Prerequisites

- A cloud VPS (CentOS 7+ / Ubuntu 20.04+)
- Docker & Docker Compose: [Official Guide](https://docs.docker.com/engine/install/)
- Firewall / security group open:

| Port | Protocol | Purpose |
|------|----------|---------|
| 80 | TCP | HTTP → HTTPS redirect |
| 443 | TCP | HTTPS (Nginx + SSL) |
| 3478 | TCP+UDP | TURN server (optional) |
| 40000-49999 | UDP | WebRTC media |

> ⚠️ **HTTPS required**: browsers block mic access on non-secure contexts.

### Deployment

#### 1. SSH into server

```bash
ssh root@your-server-ip
```

#### 2. Clone

```bash
git clone <your-repo-url> less-meeting
cd less-meeting
```

#### 3. Configure

```bash
cp .env.example .env
vim .env
# Set ANNOUNCED_IP=your_public_ip
```

#### 4. Build & start

```bash
docker compose up -d --build
```

Check logs:

```bash
docker compose logs less-meeting
# [Server] Mediasoup Worker ready
```

#### 5. HTTPS

**Path A: Self-signed (no domain)**

```bash
bash gen-certs.sh
docker compose up -d
# Visit https://your-ip → Advanced → Proceed
```

**Path B: Let's Encrypt (needs domain)**

```bash
docker compose stop nginx
apt-get update && apt-get install -y certbot
certbot certonly --standalone -d your-domain.com
ln -sf /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/fullchain.pem
ln -sf /etc/letsencrypt/live/your-domain.com/privkey.pem certs/privkey.pem
docker compose up -d
```

Auto-renewal:

```bash
crontab -e
0 3 * * * certbot renew --quiet && docker compose restart nginx
```

#### 6. Verify

- Path A: `https://your-server-ip`
- Path B: `https://your-domain.com`

```bash
curl -s localhost:3000/health
# {"status":"ok","uptime":...,"rooms":0}
```

---

### Troubleshooting

**No audio between peers**

1. Open firewall UDP 40000-49999
2. Verify `ANNOUNCED_IP` is public IP
3. `docker compose logs less-meeting | grep ERROR`

**Page unreachable**

1. Open firewall TCP 80, 443
2. `docker compose ps nginx`

**Microphone error**

Access via **HTTPS** — address must start with `https://`.

**Mediasoup Worker fails**

```bash
docker exec -it less-meeting ls /app/node_modules/mediasoup/worker/out/Release/
```
