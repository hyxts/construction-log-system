# -*- coding: utf-8 -*-
"""一键部署工具 - 推送GitHub并同步到PythonAnywhere"""

import subprocess, sys, os

PA_SITE = "slhfwq.pythonanywhere.com"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

def run(cmd, cwd=None):
    return subprocess.run(cmd, shell=True, cwd=cwd or PROJECT_DIR,
                          capture_output=True, text=True)

print("=" * 40)
print("  一键部署到 PythonAnywhere")
print("=" * 40)
print()

# 1. 推送
print("[1/3] 推送代码到 GitHub...")
print()

status = run("git status --porcelain")
if status.stdout.strip():
    print("检测到未提交的更改，正在提交...")
    msg = input("输入提交信息 (回车跳过): ").strip()
    if not msg:
        msg = "自动部署更新"
    r = run(f'git add -A')
    r = run(f'git commit -m "{msg}"')
    if r.returncode != 0:
        print(f"[失败] 提交失败: {r.stderr}")
        input("按回车退出...")
        sys.exit(1)
else:
    print("无未提交的更改")

print("正在推送到 GitHub...")
r = run("git push")
if r.returncode != 0:
    print(f"[失败] 推送失败: {r.stderr}")
    input("按回车退出...")
    sys.exit(1)
print("[成功] 代码已推送到 GitHub")

# 2. 远程拉取 + Reload
print()
print("[2/3] 远程拉取代码并自动 Reload...")
r = run(f'curl.exe -s -X POST "https://{PA_SITE}/api/git-pull"')
print(r.stdout.strip() if r.stdout.strip() else "[OK]")
print()

# 3. 完成
print("=" * 40)
print("  部署完成!")
print(f"  日志系统: https://{PA_SITE}/")
print(f"  排班考勤: https://{PA_SITE}/paiban")
print("=" * 40)
print()
input("按回车退出...")
