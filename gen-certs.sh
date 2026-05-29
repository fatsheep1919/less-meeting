#!/bin/bash
# 生成自签名 SSL 证书（适用于没有域名的场景）
# 用法: bash gen-certs.sh

set -e

mkdir -p certs

openssl req -x509 -newkey rsa:4096 \
  -keyout certs/privkey.pem \
  -out certs/fullchain.pem \
  -days 365 -nodes \
  -subj "/CN=SelfSigned"

echo "证书已生成到 ./certs/"
echo ""
echo "浏览器访问时会提示「不安全」，点击「高级」→「继续访问」即可。"
echo "这是因为自签名证书不受公共 CA 信任，但加密效果与正式证书相同。"
