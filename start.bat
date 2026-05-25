@echo off
echo ==========================================
echo   预警通注册管理系统
echo ==========================================
echo.
echo 正在启动服务...
echo.

if not exist node_modules (
    echo 正在安装依赖...
    call npm install
)

echo.
echo ==========================================
echo   服务已启动!
echo.
echo   访问地址: http://localhost:3000
echo   登录账号: admin / admin
echo.
echo   按 Ctrl+C 停止服务
echo ==========================================
echo.

set PORT=3000
node server/index.mjs
