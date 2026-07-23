# -*- coding: utf-8 -*-
"""排工考勤系统 Blueprint"""
import os, json, sqlite3

from .utils import TZ, _now, make_logger, make_db
from flask import Blueprint, request, jsonify, send_from_directory

bp = Blueprint('paiban', __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAIBAN_DB_PATH = os.path.join(BASE_DIR, '排班', 'paiban.db')
LOG_FILE = os.path.join(BASE_DIR, '排班', 'paiban.log')

_log = make_logger(LOG_FILE)
_get_db = make_db(PAIBAN_DB_PATH)


def init_db():
    try:
        os.makedirs(os.path.dirname(PAIBAN_DB_PATH), exist_ok=True)
        conn = _get_db()
        conn.execute('''CREATE TABLE IF NOT EXISTS paiban_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workers TEXT DEFAULT '[]',
            tasks TEXT DEFAULT '[]',
            plan_data TEXT DEFAULT '{}',
            attend_data TEXT DEFAULT '{}',
            docs TEXT DEFAULT '[]',
            archives TEXT DEFAULT '{}',
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            version INTEGER DEFAULT 0
        )''')
        try: conn.execute('ALTER TABLE paiban_data ADD COLUMN version INTEGER DEFAULT 0')
        except sqlite3.OperationalError: pass
        existing = conn.execute('SELECT id FROM paiban_data LIMIT 1').fetchone()
        if not existing:
            conn.execute('INSERT INTO paiban_data (workers, tasks, plan_data, attend_data, docs, archives) VALUES (?, ?, ?, ?, ?, ?)',
                         ('[]', '[]', '{}', '{}', '[]', '{}'))
        conn.commit()
        conn.close()
    except Exception as e:
        import traceback
        print(f'[init_paiban_db ERROR] {e}\n{traceback.format_exc()}', flush=True)


# ==================== 数据API ====================

@bp.route('/api/paiban/data', methods=['GET'])
def get_data():
    conn = None
    try:
        conn = _get_db()
        row = conn.execute('SELECT workers, tasks, plan_data, attend_data, docs, archives, updated_at, version FROM paiban_data LIMIT 1').fetchone()
        if not row:
            return jsonify({'success': False, 'error': '无数据'}), 404
        return jsonify({'success': True, 'data': {
            'workers': json.loads(row[0] or '[]'),
            'tasks': json.loads(row[1] or '[]'),
            'planData': json.loads(row[2] or '{}'),
            'attendData': json.loads(row[3] or '{}'),
            'docs': json.loads(row[4] or '[]'),
            'archives': json.loads(row[5] or '{}'),
            'updated_at': row[6],
            'version': row[7]
        }})
    finally:
        if conn:
            conn.close()


@bp.route('/api/paiban/data', methods=['POST'])
def save_data():
    data = request.get_json(silent=True) or {}
    conn = None
    try:
        conn = _get_db()
        # 乐观锁：检查版本号防止并发覆盖
        client_ver = data.pop('_version', None)
        if client_ver is not None:
            cur_ver = conn.execute('SELECT version FROM paiban_data LIMIT 1').fetchone()
            if cur_ver and cur_ver[0] != client_ver:
                return jsonify({'success': False, 'error': '数据已被其他端修改，请刷新后重试', 'conflict': True}), 409
        conn.execute('''UPDATE paiban_data SET
            workers = ?, tasks = ?, plan_data = ?, attend_data = ?, docs = ?, archives = ?,
            updated_at = datetime('now','localtime'), version = version + 1
        ''', (
            json.dumps(data.get('workers', []), ensure_ascii=False),
            json.dumps(data.get('tasks', []), ensure_ascii=False),
            json.dumps(data.get('planData', {}), ensure_ascii=False),
            json.dumps(data.get('attendData', {}), ensure_ascii=False),
            json.dumps(data.get('docs', []), ensure_ascii=False),
            json.dumps(data.get('archives', {}), ensure_ascii=False)
        ))
        conn.commit()
        workers_cnt = len(data.get('workers', []))
        tasks_cnt = len(data.get('tasks', []))
        _log(f'保存排班数据: {workers_cnt}人 {tasks_cnt}任务')
        new_ver = conn.execute('SELECT version FROM paiban_data LIMIT 1').fetchone()[0]
        return jsonify({'success': True, 'updated_at': _now().strftime('%Y-%m-%d %H:%M:%S'), 'version': new_ver})
    finally:
        if conn:
            conn.close()


# ==================== APK接口 ====================

PAIBAN_VERSION = {
    "versionCode": 1,
    "versionName": "1.0",
    "downloadUrl": "/paiban/app-debug.apk"
}


@bp.route('/paiban/api/version')
def version():
    return jsonify(PAIBAN_VERSION)


@bp.route('/paiban/app-debug.apk')
def download_apk():
    apk_path = os.path.join(BASE_DIR, '排班', 'app-debug.apk')
    if not os.path.exists(apk_path):
        return jsonify({'error': 'APK文件不存在'}), 404
    return send_from_directory('排班', 'app-debug.apk', as_attachment=True, download_name='枫叶管理.apk')
