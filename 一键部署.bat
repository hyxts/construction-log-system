@echo off
chcp 65001 >nul
title 一键部署到 PythonAnywhere

echo ========================================
echo   一键部署到 PythonAnywhere
echo ========================================
echo.

set "PA_SITE=slhfwq.pythonanywhere.com"
set "PA_USER=slhfwq"

:: 读取已保存的 API Token
set "PA_TOKEN="
if exist ".pa_token" set /p PA_TOKEN=<.pa_token

if "%PA_TOKEN%"=="" (
    echo [首次使用] 需要 PythonAnywhere API Token
    echo   获取地址: https://www.pythonanywhere.com/user/%PA_USER%/account/#api_tab
    echo.
    set /p PA_TOKEN=粘贴 API Token: 
    if "%PA_TOKEN%"=="" (
        echo 未输入 Token，跳过自动 Reload
        goto :SKIP_TOKEN
    )
    echo %PA_TOKEN%>.pa_token
    echo [已保存] Token 已保存到 .pa_token
    echo.
)

:SKIP_TOKEN

:: 1. 推送代码到 GitHub
echo [1/4] 推送代码到 GitHub...
echo.

git add -A >nul 2>&1
for /f "delims=" %%i in ('git status --porcelain') do set HAS_CHANGES=%%i

if defined HAS_CHANGES (
    echo 检测到未提交的更改，正在提交...
    set /p COMMIT_MSG=输入提交信息 (回车跳过): 
    if "%COMMIT_MSG%"=="" set COMMIT_MSG=自动部署更新
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

:: 2. 远程拉取到 PythonAnywhere
echo.
echo [2/4] 远程拉取到 PythonAnywhere...
curl -s -X POST "https://%PA_SITE%/api/git-pull"
if errorlevel 1 (
    echo [失败] 无法连接 PythonAnywhere
    pause
    exit /b 1
)
echo.
echo [成功] PythonAnywhere 已拉取代码

:: 3. 自动 Reload
echo.
if "%PA_TOKEN%"=="" (
    echo [3/4] 未配置 Token，跳过自动 Reload
    echo   请手动打开: https://www.pythonanywhere.com/user/%PA_USER%/webapps/
    goto :DONE
)

echo [3/4] 自动 Reload Web 应用...
curl -s -X POST -H "Authorization: Token %PA_TOKEN%" "https://www.pythonanywhere.com/api/v1/user/%PA_USER%/webapps/%PA_SITE%/reload/" > reload_result.txt 2>&1
set /p RELOAD_RESULT=<reload_result.txt
del reload_result.txt 2>nul

:: 判断 reload 结果
echo %RELOAD_RESULT% | findstr /i "error detail" >nul
if errorlevel 1 (
    echo [成功] Web 应用已自动 Reload!
) else (
    echo [提示] Reload 返回: %RELOAD_RESULT%
    echo   如果未生效，请手动打开: https://www.pythonanywhere.com/user/%PA_USER%/webapps/
)

:: 4. 完成
:DONE
echo.
echo ========================================
echo   部署完成!
echo   日志系统: https://%PA_SITE%/
echo   排班考勤: https://%PA_SITE%/paiban
echo ========================================
echo.
pause
