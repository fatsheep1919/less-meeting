# ---- 阶段 1: 构建 ----
FROM node:22-bookworm AS builder

# 服务端：安装依赖 + 编译 TypeScript
WORKDIR /build/server
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# 客户端：安装依赖 + Vite 构建
WORKDIR /build/client
COPY client/package*.json client/tsconfig.json client/vite.config.ts ./
RUN npm ci
COPY client/index.html client/src/ ./
RUN npm run build

# ---- 阶段 2: 运行 ----
FROM node:22-bookworm-slim
WORKDIR /app

# mediasoup worker 依赖的 ICE 库
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnice10 \
    && rm -rf /var/lib/apt/lists/*

# 只安装生产依赖
COPY --from=builder /build/server/package*.json ./
RUN npm ci --omit=dev

# 复制构建产物
COPY --from=builder /build/server/dist ./dist
COPY --from=builder /build/client/public ./public

EXPOSE 3000
EXPOSE 40000-49999/udp

CMD ["node", "dist/index.js"]
