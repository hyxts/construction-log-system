# -*- coding: utf-8 -*-
"""
一键部署工具 - 推送代码到 GitHub 并同步到 PythonAnywhere

用法：
  python deploy.py                   推送到 GitHub + 远程拉取
  python deploy.py --push-only       仅推送到 GitHub
  python deploy.py --pull-only       仅远程拉取（不推送）

首次使用需配置 PythonAnywhere 的站点地址:
  python deploy.py --setup

PythonAnywhere 免费版 API reload 可能不可用，拉取后会提示手动 Reload。
"""
import os
import sys
import json
import subprocess
import urllib.request
import urllib.error

CFG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.deploy_cfg.json')

def load_cfg():
    if os.path.exists(CFG_FILE):
        with open(CFG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_cfg(cfg):
    with open(CFG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

def run(cmd, cwd=None):
    """执行命令并显示输出"""
    print(f'[执行] {cmd}')
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if r.stdout.strip():
        print(r.stdout.strip())
    if r.stderr.strip():
        print(r.stderr.strip())
    return r

def git_push():
    """推送本地代码到 GitHub"""
    root = os.path.dirname(os.path.abspath(__file__))
    
    # 检查是否有未提交的更改
    r = run('git status --porcelain', cwd=root)
    if r.stdout.strip():
        print('\n检测到未提交的更改，正在提交...')
        run('git add -A', cwd=root)
        now = subprocess.run('git log --oneline -1', shell=True, cwd=root,
                             capture_output=True, text=True).stdout.strip()
        commit_msg = input('输入提交信息 (直接回车使用自动标题): ').strip()
        if not commit_msg:
            commit_msg = f'自动部署更新 ({len(r.stdout.strip().splitlines())}个文件)'
        run(f'git commit -m "{commit_msg}"', cwd=root)
    
    print('\n--- 推送到 GitHub ---')
    result = run('git push', cwd=root)
    if result.returncode != 0:
        print('[失败] 推送失败，请检查网络或权限')
        return False
    print('[成功] 代码已推送到 GitHub')
    return True

def remote_pull():
    """远程拉取代码到 PythonAnywhere"""
    cfg = load_cfg()
    pa_site = cfg.get('pa_site', '')
    
    if not pa_site:
        print('\n首次使用需配置 PythonAnywhere 站点地址')
        setup()
        cfg = load_cfg()
        pa_site = cfg.get('pa_site', '')
        if not pa_site:
            return False
    
    # 确保是 https 开头
    if not pa_site.startswith('http'):
        pa_site = 'https://' + pa_site
    
    url = f'{pa_site}/api/git-pull'
    print(f'\n--- 远程拉取: {url} ---')
    
    try:
        req = urllib.request.Request(url, method='POST', data=b'')
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('success'):
                print('[成功] PythonAnywhere 已拉取最新代码')
                if data.get('stdout'):
                    print(data['stdout'])
            else:
                print(f'[拉取结果] {data}')
                
    except urllib.error.HTTPError as e:
        print(f'[HTTP错误] {e.code} - 请确认 PythonAnywhere 站点已部署且可访问')
        return False
    except Exception as e:
        print(f'[网络错误] {e} - 无法连接到 PythonAnywhere')
        return False
    
    # 尝试通过 API reload（需要 PythonAnywhere API token）
    api_token = cfg.get('api_token', '')
    pa_username = cfg.get('pa_username', '')
    
    if api_token and pa_username:
        print('\n--- 尝试自动 Reload ---')
        try:
            reload_url = f'https://www.pythonanywhere.com/api/v1/user/{pa_username}/webapps/{pa_username}.pythonanywhere.com/reload/'
            req = urllib.request.Request(reload_url, method='POST')
            req.add_header('Authorization', f'Token {api_token}')
            with urllib.request.urlopen(req, timeout=30) as resp:
                print('[成功] Web 应用已自动 Reload!')
                return True
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print('[提示] API Token 无效，请重新配置')
            elif e.code == 404:
                print('[提示] 免费版可能不支持 API Reload')
            else:
                print(f'[提示] API Reload 失败 (HTTP {e.code})')
        except Exception as e:
            print(f'[提示] {e}')
    else:
        print(f'\n[提示] 代码已拉取到 PythonAnywhere，请在 Web 页面点击 Reload 按钮生效')
        print(f'  快速链接: https://www.pythonanywhere.com/user/{pa_username or "你的用户名"}/webapps/')
    
    return True

def setup():
    """配置 PythonAnywhere 连接信息"""
    cfg = load_cfg()
    
    print('\n=== 配置 PythonAnywhere 连接 ===')
    print('(直接回车跳过不修改)\n')
    
    pa_site = input(f'PythonAnywhere 站点地址 [{cfg.get("pa_site", "")}]: ').strip()
    if pa_site:
        cfg['pa_site'] = pa_site
    
    pa_username = input(f'PythonAnywhere 用户名 [{cfg.get("pa_username", "")}]: ').strip()
    if pa_username:
        cfg['pa_username'] = pa_username
    
    print('\n如需自动 Reload（可选），需要 API Token:')
    print('  获取方式: https://www.pythonanywhere.com/user/{}/account/#api_tab'.format(
        pa_username or cfg.get('pa_username', 'yourname')))
    api_token = input(f'API Token [{cfg.get("api_token", ""):.8}{"..." if len(cfg.get("api_token", "")) > 8 else ""}]: ').strip()
    if api_token:
        cfg['api_token'] = api_token
    
    save_cfg(cfg)
    print(f'\n[保存] 配置已保存到 {CFG_FILE}')

def main():
    args = sys.argv[1:]
    push_only = '--push-only' in args
    pull_only = '--pull-only' in args
    do_setup = '--setup' in args
    
    if do_setup:
        setup()
        return
    
    root = os.path.dirname(os.path.abspath(__file__))
    
    if pull_only:
        remote_pull()
        return
    
    if push_only:
        git_push()
        return
    
    # 默认：推送 + 远程拉取
    print('=' * 50)
    print('  一键部署工具')
    print('=' * 50)
    
    if git_push():
        remote_pull()
    
    print('\n完成!')

if __name__ == '__main__':
    main()
