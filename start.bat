@echo off
echo ============================================
echo   国标装修工装施工日志系统 v2.0
echo ============================================
echo.
echo 正在检查依赖...
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
)
echo.
echo 启动服务器...
echo 访问地址: http://localhost:3000
echo.
node server.js
pause
