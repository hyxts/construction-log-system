# -*- coding: utf-8 -*-
"""数据库备份 Blueprint（含每日自动备份、每周自动清理）"""
import os, shutil, zipfile, threading, time as time_mod

from .utils import _now, _size_str
from flask import Blueprint, jsonify

bp = Blueprint('backup', __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
MAX_SERVER_BACKUPS = 7
AUTO_BACKUP_INTERVAL = 86400       # 备份间隔：24小时
AUTO_CLEAN_INTERVAL = 604800       # 清理间隔：7天
MAX_LOG_LINES = 200                # 日志最多保留行数

# 数据库路径
DB_PATHS = [
    ('gifts.db', os.path.join(BASE_DIR, '人情', 'gifts.db')),
    ('paiban.db', os.path.join(BASE_DIR, '排班', 'paiban.db')),
    ('gpa.db', os.path.join(BASE_DIR, '绩点', 'gpa.db')),
    ('hsgrades.db', os.path.join(BASE_DIR, '成绩', 'hsgrades.db')),
    ('countdown.db', os.path.join(BASE_DIR, '倒计时', 'countdown.db')),
    ('accounting.db', os.path.join(BASE_DIR, '记账', 'accounting.db')),
    ('pa.db', os.path.join(BASE_DIR, '服务器', 'pa.db')),
]


def _save_server_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = _now().strftime('%Y%m%d_%H%M%S')
    zip_path = os.path.join(BACKUP_DIR, f'backup_{ts}.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, path in DB_PATHS:
            if os.path.exists(path):
                zf.write(path, name)
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.zip')])
    while len(backups) > MAX_SERVER_BACKUPS:
        os.remove(os.path.join(BACKUP_DIR, backups.pop(0)))
    return zip_path


def _auto_backup_thread():
    """每天定时自动备份一次"""
    while True:
        try:
            time_mod.sleep(AUTO_BACKUP_INTERVAL)
            zip_path = _save_server_backup()
            ts = _now().strftime('%Y-%m-%d %H:%M:%S')
            print(f'[{ts}] 自动备份完成: {os.path.basename(zip_path)}')
        except Exception as e:
            ts = _now().strftime('%Y-%m-%d %H:%M:%S')
            print(f'[{ts}] 自动备份失败: {e}')


def start_auto_backup():
    t = threading.Thread(target=_auto_backup_thread, daemon=True)
    t.start()


# ==================== 自动清理 ====================

_last_cleanup = {'time': '-', 'freed': '-', 'results': []}
_last_cleanup_lock = threading.Lock()


def _do_cleanup():
    """清理日志和临时文件"""
    results = []
    total_freed = 0

    # 1. 截断 PA 续期日志
    log_path = os.path.join(BASE_DIR, '服务器', 'renew.log')
    if os.path.exists(log_path):
        size_before = os.path.getsize(log_path)
        with open(log_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        if len(lines) > MAX_LOG_LINES:
            with open(log_path, 'w', encoding='utf-8') as f:
                f.writelines(lines[-MAX_LOG_LINES:])
            size_after = os.path.getsize(log_path)
            freed = size_before - size_after
            total_freed += freed
            results.append(f'PA日志: {len(lines)}行 → {MAX_LOG_LINES}行, 释放 {_size_str(freed)}')

    # 2. 清理 __pycache__ 目录
    for root, dirs, files in os.walk(BASE_DIR):
        if '__pycache__' in dirs:
            cache_path = os.path.join(root, '__pycache__')
            dirs.remove('__pycache__')  # 防止os.walk尝试进入已删除目录
            try:
                size_before = sum(os.path.getsize(os.path.join(cache_path, f))
                                  for f in os.listdir(cache_path) if os.path.isfile(os.path.join(cache_path, f)))
                shutil.rmtree(cache_path)
                total_freed += size_before
                results.append(f'已清理: {os.path.relpath(cache_path, BASE_DIR)}')
            except Exception:
                pass

    # 3. 清理已废弃的旧目录和文件（模块已迁移或移除后残留）
    # 4. 截断系统日志（500错误日志、重载日志等）
    SYSTEM_LOGS = [
        '500_error.log', 'reload_stdout.log', 'reload_stderr.log'
    ]
    for log_name in SYSTEM_LOGS:
        log_path = os.path.join(BASE_DIR, log_name)
        if os.path.exists(log_path):
            try:
                size_before = os.path.getsize(log_path)
                with open(log_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                if len(lines) > MAX_LOG_LINES:
                    with open(log_path, 'w', encoding='utf-8') as f:
                        f.writelines(lines[-MAX_LOG_LINES:])
                    size_after = os.path.getsize(log_path)
                    freed = size_before - size_after
                    total_freed += freed
                    results.append(f'{log_name}: {len(lines)}行 → {MAX_LOG_LINES}行, 释放 {_size_str(freed)}')
            except Exception:
                pass

    # 5. 清理已废弃的旧目录和文件（模块已迁移或移除后残留）
    ORPHAN_DIRS = ['傲视小助手']
    ORPHAN_FILES = ['data.db', '服务器/monitor.db', '服务器/data_report.log']
    for dname in ORPHAN_DIRS:
        dpath = os.path.join(BASE_DIR, dname)
        if os.path.isdir(dpath):
            try:
                sz = sum(os.path.getsize(os.path.join(r, f))
                         for r, _, fs in os.walk(dpath) for f in fs
                         if os.path.isfile(os.path.join(r, f)))
                shutil.rmtree(dpath)
                total_freed += sz
                results.append(f'已清理废弃目录: {dname}/ ({_size_str(sz)})')
            except Exception:
                pass
    for fname in ORPHAN_FILES:
        fpath = os.path.join(BASE_DIR, fname)
        if os.path.isfile(fpath):
            try:
                sz = os.path.getsize(fpath)
                os.remove(fpath)
                total_freed += sz
                results.append(f'已清理废弃文件: {fname} ({_size_str(sz)})')
            except Exception:
                pass

    if not results:
        results.append('无需清理')
    return results, total_freed


def _auto_clean_thread():
    """每7天自动清理一次"""
    global _last_cleanup
    while True:
        try:
            time_mod.sleep(AUTO_CLEAN_INTERVAL)
            results, freed = _do_cleanup()
            ts = _now().strftime('%Y-%m-%d %H:%M:%S')
            with _last_cleanup_lock:
                _last_cleanup = {'time': ts, 'freed': _size_str(freed), 'results': results}
            print(f'[{ts}] 自动清理完成: 释放 {_size_str(freed)}; {"; ".join(results)}')
        except Exception as e:
            ts = _now().strftime('%Y-%m-%d %H:%M:%S')
            print(f'[{ts}] 自动清理失败: {e}')


def start_auto_clean():
    t = threading.Thread(target=_auto_clean_thread, daemon=True)
    t.start()


_cleanup_lock = threading.Lock()

@bp.route('/api/cleanup', methods=['POST'])
def manual_cleanup():
    global _last_cleanup
    if _cleanup_lock.locked():
        return jsonify({'success': False, 'error': '清理正在进行中'}), 409
    with _cleanup_lock:
        try:
            results, freed = _do_cleanup()
            ts = _now().strftime('%Y-%m-%d %H:%M:%S')
            with _last_cleanup_lock:
                _last_cleanup = {'time': ts, 'freed': _size_str(freed), 'results': results}
            return jsonify({'success': True, 'results': results, 'freed': _size_str(freed)})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/cleanup/status', methods=['GET'])
def cleanup_status():
    with _last_cleanup_lock:
        return jsonify(dict(_last_cleanup))


@bp.route('/api/backup/list')
def list_backups():
    """列出所有备份文件"""
    if not os.path.exists(BACKUP_DIR):
        return jsonify({'success': True, 'backups': []})
    files = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.zip')], reverse=True)
    result = []
    for f in files:
        fp = os.path.join(BACKUP_DIR, f)
        sz = os.path.getsize(fp)
        result.append({'name': f, 'size': _size_str(sz), 'size_bytes': sz})
    return jsonify({'success': True, 'backups': result})


@bp.route('/api/backup/create', methods=['POST'])
def create_backup():
    """手动创建备份"""
    try:
        zip_path = _save_server_backup()
        return jsonify({'success': True, 'file': os.path.basename(zip_path),
                        'size': _size_str(os.path.getsize(zip_path))})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/backup/restore/<filename>')
def restore_backup(filename):
    """从指定备份文件恢复所有数据库"""
    if '..' in filename or '/' in filename:
        return jsonify({'success': False, 'error': '非法文件名'}), 403
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': '备份文件不存在'}), 404
    results = []
    try:
        db_targets = {
            'gifts.db': os.path.join(BASE_DIR, '人情', 'gifts.db'),
            'paiban.db': os.path.join(BASE_DIR, '排班', 'paiban.db'),
            'gpa.db': os.path.join(BASE_DIR, '绩点', 'gpa.db'),
            'hsgrades.db': os.path.join(BASE_DIR, '成绩', 'hsgrades.db'),
            'countdown.db': os.path.join(BASE_DIR, '倒计时', 'countdown.db'),
            'accounting.db': os.path.join(BASE_DIR, '记账', 'accounting.db'),
            'pa.db': os.path.join(BASE_DIR, '服务器', 'pa.db'),
        }
        with zipfile.ZipFile(filepath, 'r') as zf:
            for fname in zf.namelist():
                if fname in db_targets:
                    target = db_targets[fname]
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    data = zf.read(fname)
                    with open(target, 'wb') as f:
                        f.write(data)
                    results.append(f'{fname} -> {os.path.relpath(target, BASE_DIR)} ({len(data)} bytes)')
        return jsonify({'success': True, 'backup_file': filename, 'restored': results})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/backup/download/<filename>')
def download_backup(filename):
    """下载指定备份文件"""
    if '..' in filename or '/' in filename:
        return jsonify({'success': False, 'error': '非法文件名'}), 403
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': '备份文件不存在'}), 404
    from flask import send_file
    return send_file(filepath, as_attachment=True, download_name=filename)
