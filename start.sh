#!/bin/bash
echo "=========================================="
echo "  预警通注册管理系统"
echo "=========================================="
echo ""
echo "正在启动服务..."
echo ""

# 检查node
if ! command -v node &> /dev/null; then
    echo "错误: 请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

# 启动
PORT=3000 node server/index.mjs &
PID=$!
sleep 2

echo ""
echo "=========================================="
echo "  服务已启动!"
echo ""
echo "  访问地址: http://localhost:3000"
echo "  登录账号: admin / admin"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

wait $PID
