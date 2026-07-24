# -*- coding: utf-8 -*-
"""
PyInstaller 桌面打包脚本
用法：python build_desktop.py
输出：dist/字帖生成器.exe
"""
import os
import sys
import shutil
import PyInstaller.__main__

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT, 'dist')
BUILD_DIR = os.path.join(ROOT, 'build')
SPEC_FILE = os.path.join(ROOT, '字帖生成器.spec')

# 清理旧构建
for d in (DIST_DIR, BUILD_DIR):
    if os.path.isdir(d):
        shutil.rmtree(d)
if os.path.exists(SPEC_FILE):
    os.remove(SPEC_FILE)

# 前端资源目录（中文目录名）
DATA_DIRS = ['人情', '排班', '绩点', '成绩', '倒计时', '记账', '部署', '字帖']

# 通过 --add-data 附加资源；格式在 Windows 下为 "src;dest"
datas = []
for name in DATA_DIRS:
    src = os.path.join(ROOT, name)
    if os.path.isdir(src):
        datas.extend(['--add-data', f'{src};{name}'])

# 需要显式导入的路由模块（app.py 使用 __import__ 动态加载，PyInstaller 无法静态分析）
HIDDEN_IMPORTS = [
    'routes.utils',
    'routes.seed_data',
    'routes.renqing',
    'routes.paiban',
    'routes.gpa',
    'routes.hsgrades',
    'routes.backup',
    'routes.deploy',
    'routes.pa',
    'routes.countdown',
    'routes.accounting',
    'routes.speedtest',
]

hidden = []
for m in HIDDEN_IMPORTS:
    hidden.extend(['--hidden-import', m])

# 图标：Windows 下 PyInstaller 仅原生支持 .ico；.svg 需要预先转换。
# 若不存在 icon.ico，则使用 PyInstaller 默认图标。
icon_path = os.path.join(ROOT, 'icon.ico')
icon_args = []
if os.path.exists(icon_path):
    icon_args = ['--icon', icon_path]

args = [
    os.path.join(ROOT, 'app.py'),
    '--name', '字帖生成器',
    '--onefile',
    '--windowed',
    '--clean',
    '--noconfirm',
] + datas + hidden + icon_args

PyInstaller.__main__.run(args)
print('打包完成，输出:', os.path.join(DIST_DIR, '字帖生成器.exe'))
