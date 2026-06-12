@echo off
chcp 65001 >nul
title 一键部署到 PythonAnywhere

echo ========================================
echo   一键部署到 PythonAnywhere
echo ========================================
echo.

set "PA_SITE=slhfwq.pythonanywhere.com"

:: 1. 检查是否有未提交的更改
echo [1/3] 推送代码到 GitHub...
echo.

git add -A >nul 2>&1
for /f "delims=" %%i in ('git status --porcelain') do set HAS_CHANGES=%%i

if defined HAS_CHANGES (
    echo 检测到未提交的更改，正在提交...
    set /p COMMIT_MSG=输入提交信息 (回车跳过): 
    if "%COMMIT_MSG%"=="" set COMMIT_MSG=自动部署更新
    git commit -m "%COMMIT_MSG%"
    if errorlevel 1 (
        echo [失败] 提交失败
        pause
        exit /b 1
    )
) else (
    echo 无未提交的更改
)

echo 正在推送到 GitHub...
git push
if errorlevel 1 (
    echo [失败] 推送失败，请检查网络
    pause
    exit /b 1
)
echo [成功] 代码已推送到 GitHub

:: 2. 远程拉取到 PythonAnywhere
echo.
echo [2/3] 远程拉取到 PythonAnywhere...
echo.

curl -s -X POST "https://%PA_SITE%/api/git-pull" 2>&1
if errorlevel 1 (
    echo.
    echo [失败] 无法连接到 PythonAnywhere，请确认站点已部署
    pause
    exit /b 1
)

echo.
echo [成功] PythonAnywhere 已拉取最新代码!

:: 3. 提示 Reload
echo.
echo [3/3] 请手动完成最后一步:
echo -------------------------------------------------------
echo   打开: https://www.pythonanywhere.com/user/slhfwq/webapps/
echo   点击绿色 Reload 按钮
echo -------------------------------------------------------
echo.
pause
