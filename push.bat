@echo off
echo ============================================
echo   推送代码到 GitHub
echo ============================================
echo.
cd /d "d:\Qoder项目\装修测试软件"
git add -A
git commit -m "更新代码 %date% %time%"
git push origin main
echo.
echo 已推送到 GitHub！去 PythonAnywhere 执行 git pull 即可更新
pause
