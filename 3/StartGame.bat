@echo off
chcp 65001 >nul
echo ==========================================
echo       回煞 (Returns) - 游戏启动器
echo ==========================================
echo.
echo 正在启动本地服务器...
echo 请保持此窗口开启，游戏结束后可关闭。
echo.
echo 正在打开浏览器...
echo.

:: Start the PowerShell server in a new window
start "Game Server" powershell -ExecutionPolicy Bypass -File server.ps1

:: Wait for server to initialize
timeout /t 2 >nul

:: Open the game in default browser
start http://localhost:8000

:: Optional: Provide instructions
echo 游戏已在浏览器中打开。
echo 如果浏览器没有自动打开，请手动访问: http://localhost:8000
echo.
pause
