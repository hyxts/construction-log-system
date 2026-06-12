@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 一键部署

echo ========================================
echo   一键部署到 PythonAnywhere
echo ========================================
echo.

set "PA_SITE=slhfwq.pythonanywhere.com"

rem --- 1. 推送 ---
echo [1/3] 推送代码到 GitHub...
echo.

git add -A >nul 2>&1
set HAS_CHANGES=
for /f "delims=" %%i in ('git status --porcelain') do set HAS_CHANGES=1

if defined HAS_CHANGES (
    echo 检测到未提交的更改，正在提交...
    set COMMIT_MSG=
    set /p COMMIT_MSG=输入提交信息 (回车跳过): 
    if "!COMMIT_MSG!"=="" set COMMIT_MSG=自动部署更新
    git commit -m "!COMMIT_MSG!"
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
    echo [失败] 推送失败
    pause
    exit /b 1
)
echo [成功] 代码已推送到 GitHub

rem --- 2. 远程拉取 + Reload ---
echo.
echo [2/3] 远程拉取代码并自动 Reload...
curl.exe -s -X POST "https://%PA_SITE%/api/git-pull"
if errorlevel 1 (
    echo [失败] 无法连接 PythonAnywhere
    pause
    exit /b 1
)
echo.

rem --- 3. 完成 ---
echo ========================================
echo   部署完成!
echo   日志系统: https://%PA_SITE%/
echo   排班考勤: https://%PA_SITE%/paiban
echo ========================================
echo.
pause
