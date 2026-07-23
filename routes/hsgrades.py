# -*- coding: utf-8 -*-
"""高中成绩系统 Blueprint"""
import os, json
from flask import Blueprint, request, jsonify

from .utils import make_logger, make_db

bp = Blueprint('hsgrades', __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HSGRADES_DB_PATH = os.path.join(BASE_DIR, '成绩', 'hsgrades.db')
LOG_FILE = os.path.join(BASE_DIR, '成绩', 'hsgrades.log')
_get_db = make_db(HSGRADES_DB_PATH)

_log = make_logger(LOG_FILE)

DEFAULT_EXAMS = [
    {'id': 'ex-1', 'name': '高一上期末', 'className': '', 'scores': {'chinese': 492.5, 'math': None, 'english': None, 'history': None, 'politics': None, 'geography': None}, 'assignedScores': {'politics': None, 'geography': None}, 'ranks': {'chinese': 594}, 'distRank': 230, 'schoolRank': None, 'classRank': None, 'totalScore': 492.5, 'note': ''},
    {'id': 'ex-2', 'name': '高一下期中', 'className': '', 'scores': {'chinese': 490.5, 'math': 594, 'english': 252, 'history': 60, 'politics': 280, 'geography': 100}, 'assignedScores': {'politics': None, 'geography': None}, 'ranks': {'chinese': 1191, 'math': 53, 'english': 60, 'politics': 113, 'history': 395, 'geography': 103}, 'distRank': 388, 'schoolRank': None, 'classRank': None, 'totalScore': 1776.5, 'note': ''},
]


def init_db():
    try:
        os.makedirs(os.path.dirname(HSGRADES_DB_PATH), exist_ok=True)
        conn = _get_db()
        conn.execute('''CREATE TABLE IF NOT EXISTS hsgrades_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exams TEXT DEFAULT '[]',
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        )''')
        existing = conn.execute('SELECT id, exams FROM hsgrades_data LIMIT 1').fetchone()
        if not existing:
            conn.execute('INSERT INTO hsgrades_data (exams) VALUES (?)',
                         (json.dumps(DEFAULT_EXAMS, ensure_ascii=False),))
        else:
            try: cur_exams = json.loads(existing[1] or '[]')
            except (json.JSONDecodeError, TypeError): cur_exams = []
            if len(cur_exams) == 0:
                cur_exams = list(DEFAULT_EXAMS)
                conn.execute('''UPDATE hsgrades_data SET exams = ?, updated_at = datetime('now','localtime')''',
                             (json.dumps(cur_exams, ensure_ascii=False),))
        conn.commit()
        conn.close()
    except Exception as e:
        import traceback
        print(f'[init_hsgrades_db ERROR] {e}\n{traceback.format_exc()}', flush=True)


@bp.route('/api/hsgrades/data', methods=['GET'])
def get_data():
    conn = None
    try:
        conn = _get_db()
        row = conn.execute('SELECT id, exams FROM hsgrades_data LIMIT 1').fetchone()
        if not row:
            return jsonify({'success': False, 'error': '无数据'}), 404
        data = json.loads(row[1] or '[]')
        return jsonify({'success': True, 'data': {'exams': data}})
    except Exception as e:
        import traceback
        print(f'[hsgrades_get_data ERROR] {e}\n{traceback.format_exc()}', flush=True)
        return jsonify({'success': False, 'error': '服务器错误'}), 500
    finally:
        if conn:
            conn.close()


@bp.route('/api/hsgrades/data', methods=['POST'])
def save_data():
    data = request.get_json(silent=True) or {}
    # 防止意外覆盖：需要明确传入 exams 字段
    if 'exams' not in data:
        return jsonify({'success': False, 'error': '缺少数据'}), 400
    conn = None
    try:
        conn = _get_db()
        conn.execute('''UPDATE hsgrades_data SET
            exams = ?,
            updated_at = datetime('now','localtime')
        ''', (json.dumps(data.get('exams', []), ensure_ascii=False),))
        conn.commit()
        _log(f'保存成绩数据: {len(data.get("exams",[]))}场考试')
        return jsonify({'success': True})
    finally:
        if conn:
            conn.close()
