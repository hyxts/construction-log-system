# -*- coding: utf-8 -*-
"""
国标装修工装施工日志系统 - Flask 后端
适用于 PythonAnywhere 部署
"""
import os
import json
import sqlite3
import traceback
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='public', static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB 限制
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.db')

# ==================== 全局错误处理 ====================

@app.errorhandler(Exception)
def handle_exception(e):
    """全局异常处理，返回 JSON 格式错误"""
    app.logger.error(f"Unhandled exception: {str(e)}\n{traceback.format_exc()}")
    return jsonify({'success': False, 'error': f'服务器错误: {str(e)}'}), 500

@app.errorhandler(400)
def handle_400(e):
    return jsonify({'success': False, 'error': '请求参数错误'}), 400

@app.errorhandler(404)
def handle_404(e):
    return jsonify({'success': False, 'error': '资源不存在'}), 404

@app.errorhandler(405)
def handle_405(e):
    return jsonify({'success': False, 'error': '请求方法不允许'}), 405

# ==================== 数据库工具 ====================

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'custom',
            company TEXT DEFAULT '',
            client TEXT DEFAULT '',
            address TEXT DEFAULT '',
            manager TEXT DEFAULT '',
            recorder TEXT DEFAULT '',
            duration INTEGER DEFAULT 0,
            start_date TEXT DEFAULT '',
            end_date TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            category TEXT DEFAULT '',
            name TEXT NOT NULL DEFAULT '',
            location TEXT DEFAULT '',
            start TEXT DEFAULT '',
            end TEXT DEFAULT '',
            team TEXT DEFAULT '',
            workers INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            description TEXT DEFAULT '',
            remark TEXT DEFAULT '',
            is_rework INTEGER DEFAULT 0,
            rework_reason TEXT DEFAULT '',
            rework_source_task_id TEXT DEFAULT '',
            demolish_qty REAL DEFAULT 0,
            demolish_unit TEXT DEFAULT '',
            rebuild_desc TEXT DEFAULT '',
            inspection_status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            project_name TEXT DEFAULT '',
            unit TEXT DEFAULT '',
            date TEXT DEFAULT '',
            weather TEXT DEFAULT '',
            temp_high TEXT DEFAULT '',
            temp_low TEXT DEFAULT '',
            wind TEXT DEFAULT '',
            location TEXT DEFAULT '',
            incident TEXT DEFAULT '',
            production_record TEXT DEFAULT '',
            tech_quality_safety TEXT DEFAULT '',
            manager TEXT DEFAULT '',
            recorder TEXT DEFAULT '',
            materials TEXT DEFAULT '',
            equipments TEXT DEFAULT '',
            daily_task_log_ids TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS daily_task_logs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            log_date TEXT DEFAULT '',
            content TEXT DEFAULT '',
            weather TEXT DEFAULT '',
            team TEXT DEFAULT '',
            worker_count INTEGER DEFAULT 0,
            materials TEXT DEFAULT '',
            equipments TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            leader TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            specialty TEXT DEFAULT '',
            worker_count INTEGER DEFAULT 0,
            remark TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS materials (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            spec TEXT DEFAULT '',
            unit TEXT DEFAULT '',
            quantity REAL DEFAULT 0,
            min_quantity REAL DEFAULT 0,
            supplier TEXT DEFAULT '',
            status TEXT DEFAULT 'in_stock',
            remark TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS equipments (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            model TEXT DEFAULT '',
            count INTEGER DEFAULT 1,
            status TEXT DEFAULT 'normal',
            remark TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS acceptances (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            task_id TEXT DEFAULT '',
            rework_task_id TEXT DEFAULT '',
            acceptance_type TEXT DEFAULT 'normal',
            name TEXT NOT NULL DEFAULT '',
            location TEXT DEFAULT '',
            unit TEXT DEFAULT '',
            basis TEXT DEFAULT '',
            design_qty REAL DEFAULT 0,
            actual_qty REAL DEFAULT 0,
            unit_price REAL DEFAULT 0,
            total_price REAL DEFAULT 0,
            calc_formula TEXT DEFAULT '',
            quantity_type TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            date TEXT DEFAULT '',
            remark TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_logs_project ON logs(project_id);
        CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);
        CREATE INDEX IF NOT EXISTS idx_daily_task_logs_project ON daily_task_logs(project_id);
        CREATE INDEX IF NOT EXISTS idx_daily_task_logs_task ON daily_task_logs(task_id);
        CREATE INDEX IF NOT EXISTS idx_daily_task_logs_date ON daily_task_logs(log_date);
        CREATE INDEX IF NOT EXISTS idx_teams_project ON teams(project_id);
        CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id);
        CREATE INDEX IF NOT EXISTS idx_equipments_project ON equipments(project_id);
        CREATE INDEX IF NOT EXISTS idx_acceptances_project ON acceptances(project_id);
    ''')
    # Migration: add missing columns (silently skip if exist)
    for table, col, col_def in [
        ('projects', 'duration', 'INTEGER DEFAULT 0'),
        ('projects', 'start_date', "TEXT DEFAULT ''"),
        ('projects', 'end_date', "TEXT DEFAULT ''"),
        ('tasks', 'workers', 'INTEGER DEFAULT 0'),
        ('tasks', 'is_rework', 'INTEGER DEFAULT 0'),
        ('tasks', 'rework_reason', "TEXT DEFAULT ''"),
        ('tasks', 'rework_source_task_id', "TEXT DEFAULT ''"),
        ('tasks', 'demolish_qty', 'REAL DEFAULT 0'),
        ('tasks', 'demolish_unit', "TEXT DEFAULT ''"),
        ('tasks', 'rebuild_desc', "TEXT DEFAULT ''"),
        ('tasks', 'inspection_status', "TEXT DEFAULT 'pending'"),
        ('logs', 'materials', "TEXT DEFAULT ''"),
        ('logs', 'equipments', "TEXT DEFAULT ''"),
        ('logs', 'daily_task_log_ids', "TEXT DEFAULT ''"),
        ('daily_task_logs', 'weather', "TEXT DEFAULT ''"),
        ('daily_task_logs', 'team', "TEXT DEFAULT ''"),
        ('daily_task_logs', 'worker_count', 'INTEGER DEFAULT 0'),
        ('daily_task_logs', 'materials', "TEXT DEFAULT ''"),
        ('daily_task_logs', 'equipments', "TEXT DEFAULT ''"),
        ('acceptances', 'basis', "TEXT DEFAULT ''"),
        ('acceptances', 'calc_formula', "TEXT DEFAULT ''"),
        ('acceptances', 'task_id', "TEXT DEFAULT ''"),
        ('acceptances', 'rework_task_id', "TEXT DEFAULT ''"),
        ('acceptances', 'acceptance_type', "TEXT DEFAULT 'normal'"),
        ('acceptances', 'quantity_type', "TEXT DEFAULT ''"),
        ('acceptances', 'unit_price', 'REAL DEFAULT 0'),
        ('acceptances', 'total_price', 'REAL DEFAULT 0'),
        ('materials', 'min_quantity', 'REAL DEFAULT 0'),
    ]:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
        except:
            pass
    conn.commit()
    conn.close()

def dict_from_row(row):
    if row is None:
        return None
    return dict(row)

def dicts_from_rows(rows):
    return [dict(row) for row in rows]

# ==================== 工程 CRUD ====================

@app.route('/api/projects', methods=['GET'])
def get_projects():
    conn = get_db()
    projects = dicts_from_rows(conn.execute('SELECT * FROM projects ORDER BY created_at DESC').fetchall())
    for p in projects:
        tasks = dicts_from_rows(
            conn.execute('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id', (p['id'],)).fetchall()
        )
        p['tasks'] = tasks
    conn.close()
    return jsonify({'success': True, 'data': projects})

@app.route('/api/projects/<pid>', methods=['GET'])
def get_project(pid):
    conn = get_db()
    project = dict_from_row(conn.execute('SELECT * FROM projects WHERE id = ?', (pid,)).fetchone())
    if not project:
        conn.close()
        return jsonify({'success': False, 'error': '工程不存在'}), 404
    tasks = dicts_from_rows(
        conn.execute('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id', (pid,)).fetchall()
    )
    project['tasks'] = tasks
    conn.close()
    return jsonify({'success': True, 'data': project})

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = (request.get_json(silent=True) or {})
    name = data.get('name', '')
    if not name:
        return jsonify({'success': False, 'error': '工程名称不能为空'}), 400
    pid = data.get('id') or str(int(datetime.now().timestamp() * 1000))
    conn = get_db()
    conn.execute(
        'INSERT INTO projects (id, name, type, company, client, address, manager, recorder, duration, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (pid, name, data.get('type', 'custom'), data.get('company', ''),
         data.get('client', ''), data.get('address', ''), data.get('manager', ''), data.get('recorder', ''),
         data.get('duration', 0), data.get('start_date', ''), data.get('end_date', ''))
    )
    conn.commit()
    project = dict_from_row(conn.execute('SELECT * FROM projects WHERE id = ?', (pid,)).fetchone())
    project['tasks'] = []
    conn.close()
    return jsonify({'success': True, 'data': project})

@app.route('/api/projects/<pid>', methods=['PUT'])
def update_project(pid):
    data = (request.get_json(silent=True) or {})
    conn = get_db()
    conn.execute(
        "UPDATE projects SET name=?, type=?, company=?, client=?, address=?, manager=?, recorder=?, duration=?, start_date=?, end_date=?, updated_at=datetime('now','localtime') WHERE id=?",
        (data.get('name', ''), data.get('type', 'custom'), data.get('company', ''),
         data.get('client', ''), data.get('address', ''), data.get('manager', ''), data.get('recorder', ''),
         data.get('duration', 0), data.get('start_date', ''), data.get('end_date', ''), pid)
    )
    conn.commit()
    project = dict_from_row(conn.execute('SELECT * FROM projects WHERE id = ?', (pid,)).fetchone())
    if not project:
        conn.close()
        return jsonify({'success': False, 'error': '工程不存在'}), 404
    tasks = dicts_from_rows(
        conn.execute('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id', (pid,)).fetchall()
    )
    project['tasks'] = tasks
    conn.close()
    return jsonify({'success': True, 'data': project})

@app.route('/api/projects/<pid>', methods=['DELETE'])
def delete_project(pid):
    conn = get_db()
    conn.execute('DELETE FROM daily_task_logs WHERE project_id = ?', (pid,))
    conn.execute('DELETE FROM logs WHERE project_id = ?', (pid,))
    conn.execute('DELETE FROM acceptances WHERE project_id = ?', (pid,))
    conn.execute('DELETE FROM materials WHERE project_id = ?', (pid,))
    conn.execute('DELETE FROM equipments WHERE project_id = ?', (pid,))
    conn.execute('DELETE FROM teams WHERE project_id = ?', (pid,))
    conn.execute('DELETE FROM tasks WHERE project_id = ?', (pid,))
    conn.execute('DELETE FROM projects WHERE id = ?', (pid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== 任务 CRUD ====================

@app.route('/api/tasks/project/<project_id>', methods=['GET'])
def get_tasks(project_id):
    conn = get_db()
    tasks = dicts_from_rows(
        conn.execute('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id', (project_id,)).fetchall()
    )
    conn.close()
    return jsonify({'success': True, 'data': tasks})

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = (request.get_json(silent=True) or {})
    project_id = data.get('project_id', '')
    if not project_id:
        return jsonify({'success': False, 'error': 'project_id 不能为空'}), 400
    tid = data.get('id') or str(int(datetime.now().timestamp() * 1000))
    conn = get_db()
    conn.execute(
        '''INSERT INTO tasks (id, project_id, category, name, location, start, end, team, workers, status, description, remark, is_rework, rework_reason, rework_source_task_id, demolish_qty, demolish_unit, rebuild_desc, inspection_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (tid, project_id, data.get('category', ''), data.get('name', ''),
         data.get('location', ''), data.get('start', ''), data.get('end', ''),
         data.get('team', ''), data.get('workers', 0), data.get('status', 'pending'),
         data.get('description', ''), data.get('remark', ''),
         data.get('is_rework', 0), data.get('rework_reason', ''),
         data.get('rework_source_task_id', ''), data.get('demolish_qty', 0),
         data.get('demolish_unit', ''), data.get('rebuild_desc', ''),
         data.get('inspection_status', 'pending'))
    )
    conn.commit()
    task = dict_from_row(conn.execute('SELECT * FROM tasks WHERE id = ?', (tid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': task})

@app.route('/api/tasks/<tid>', methods=['PUT'])
def update_task(tid):
    data = (request.get_json(silent=True) or {})
    conn = get_db()
    conn.execute(
        "UPDATE tasks SET category=?, name=?, location=?, start=?, end=?, team=?, workers=?, status=?, description=?, remark=?, is_rework=?, rework_reason=?, rework_source_task_id=?, demolish_qty=?, demolish_unit=?, rebuild_desc=?, inspection_status=?, updated_at=datetime('now','localtime') WHERE id=?",
        (data.get('category', ''), data.get('name', ''), data.get('location', ''),
         data.get('start', ''), data.get('end', ''), data.get('team', ''),
         data.get('workers', 0), data.get('status', 'pending'),
         data.get('description', ''), data.get('remark', ''),
         data.get('is_rework', 0), data.get('rework_reason', ''),
         data.get('rework_source_task_id', ''), data.get('demolish_qty', 0),
         data.get('demolish_unit', ''), data.get('rebuild_desc', ''),
         data.get('inspection_status', 'pending'), tid)
    )
    conn.commit()
    task = dict_from_row(conn.execute('SELECT * FROM tasks WHERE id = ?', (tid,)).fetchone())
    conn.close()
    if not task:
        return jsonify({'success': False, 'error': '任务不存在'}), 404
    return jsonify({'success': True, 'data': task})

@app.route('/api/tasks/<tid>', methods=['DELETE'])
def delete_task(tid):
    conn = get_db()
    conn.execute('DELETE FROM tasks WHERE id = ?', (tid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/tasks/<tid>/status', methods=['PATCH'])
def update_task_status(tid):
    data = (request.get_json(silent=True) or {})
    status = data.get('status', 'pending')
    inspection_status = data.get('inspection_status', 'pending')
    conn = get_db()
    conn.execute("UPDATE tasks SET status=?, inspection_status=?, updated_at=datetime('now','localtime') WHERE id=?", (status, inspection_status, tid))
    conn.commit()
    task = dict_from_row(conn.execute('SELECT * FROM tasks WHERE id = ?', (tid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': task})

@app.route('/api/tasks/batch', methods=['POST'])
def batch_create_tasks():
    data = (request.get_json(silent=True) or {})
    tasks = data.get('tasks', [])
    if not tasks:
        return jsonify({'success': False, 'error': 'tasks 不能为空'}), 400
    conn = get_db()
    count = 0
    for t in tasks:
        tid = t.get('id') or str(int(datetime.now().timestamp() * 1000)) + str(count)
        conn.execute(
            '''INSERT INTO tasks (id, project_id, category, name, location, start, end, team, workers, status, description, remark, is_rework, rework_reason, rework_source_task_id, demolish_qty, demolish_unit, rebuild_desc, inspection_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (tid, t.get('project_id', ''), t.get('category', ''), t.get('name', ''),
             t.get('location', ''), t.get('start', ''), t.get('end', ''),
             t.get('team', ''), t.get('workers', 0), t.get('status', 'pending'),
             t.get('description', ''), t.get('remark', ''),
             t.get('is_rework', 0), t.get('rework_reason', ''),
             t.get('rework_source_task_id', ''), t.get('demolish_qty', 0),
             t.get('demolish_unit', ''), t.get('rebuild_desc', ''),
             t.get('inspection_status', 'pending'))
        )
        count += 1
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'data': {'count': count}})

# ==================== 日志 CRUD ====================

@app.route('/api/logs/project/<project_id>', methods=['GET'])
def get_logs(project_id):
    conn = get_db()
    logs = dicts_from_rows(
        conn.execute('SELECT * FROM logs WHERE project_id = ? ORDER BY date DESC, created_at DESC', (project_id,)).fetchall()
    )
    conn.close()
    return jsonify({'success': True, 'data': logs})

@app.route('/api/logs/<lid>', methods=['GET'])
def get_log(lid):
    conn = get_db()
    log = dict_from_row(conn.execute('SELECT * FROM logs WHERE id = ?', (lid,)).fetchone())
    conn.close()
    if not log:
        return jsonify({'success': False, 'error': '日志不存在'}), 404
    return jsonify({'success': True, 'data': log})

@app.route('/api/logs', methods=['POST'])
def create_log():
    data = (request.get_json(silent=True) or {})
    project_id = data.get('project_id', '')
    if not project_id:
        return jsonify({'success': False, 'error': 'project_id 不能为空'}), 400
    lid = data.get('id') or str(int(datetime.now().timestamp() * 1000))
    conn = get_db()
    conn.execute(
        '''INSERT INTO logs (id, project_id, project_name, unit, date, weather,
            temp_high, temp_low, wind, location, incident,
            production_record, tech_quality_safety, manager, recorder, materials, equipments, daily_task_log_ids)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (lid, project_id, data.get('project_name', ''), data.get('unit', ''),
         data.get('date', ''), data.get('weather', ''),
         data.get('temp_high', ''), data.get('temp_low', ''), data.get('wind', ''),
         data.get('location', ''), data.get('incident', ''),
         data.get('production_record', ''), data.get('tech_quality_safety', ''),
         data.get('manager', ''), data.get('recorder', ''),
         json.dumps(data.get('materials', []), ensure_ascii=False) if data.get('materials') else '',
         json.dumps(data.get('equipments', []), ensure_ascii=False) if data.get('equipments') else '',
         data.get('daily_task_log_ids', ''))
    )
    conn.commit()
    log = dict_from_row(conn.execute('SELECT * FROM logs WHERE id = ?', (lid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': log})

@app.route('/api/logs/<lid>', methods=['PUT'])
def update_log(lid):
    data = (request.get_json(silent=True) or {})
    conn = get_db()
    conn.execute(
        "UPDATE logs SET project_name=?, unit=?, date=?, weather=?, temp_high=?, temp_low=?, wind=?, location=?, incident=?, production_record=?, tech_quality_safety=?, manager=?, recorder=?, materials=?, equipments=?, daily_task_log_ids=?, updated_at=datetime('now','localtime') WHERE id=?",
        (data.get('project_name', ''), data.get('unit', ''), data.get('date', ''),
         data.get('weather', ''), data.get('temp_high', ''), data.get('temp_low', ''),
         data.get('wind', ''), data.get('location', ''), data.get('incident', ''),
         data.get('production_record', ''), data.get('tech_quality_safety', ''),
         data.get('manager', ''), data.get('recorder', ''),
         json.dumps(data.get('materials', []), ensure_ascii=False) if data.get('materials') else '',
         json.dumps(data.get('equipments', []), ensure_ascii=False) if data.get('equipments') else '',
         data.get('daily_task_log_ids', ''), lid)
    )
    conn.commit()
    log = dict_from_row(conn.execute('SELECT * FROM logs WHERE id = ?', (lid,)).fetchone())
    conn.close()
    if not log:
        return jsonify({'success': False, 'error': '日志不存在'}), 404
    return jsonify({'success': True, 'data': log})

@app.route('/api/logs/<lid>', methods=['DELETE'])
def delete_log(lid):
    conn = get_db()
    conn.execute('DELETE FROM logs WHERE id = ?', (lid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== 每日任务施工日志 CRUD ====================

@app.route('/api/daily-task-logs/project/<project_id>', methods=['GET'])
def get_daily_task_logs(project_id):
    """获取某工程所有每日任务施工日志"""
    conn = get_db()
    logs = dicts_from_rows(
        conn.execute('SELECT * FROM daily_task_logs WHERE project_id = ? ORDER BY log_date ASC', (project_id,)).fetchall()
    )
    conn.close()
    return jsonify({'success': True, 'data': logs})

@app.route('/api/daily-task-logs/task/<task_id>', methods=['GET'])
def get_task_daily_logs(task_id):
    """获取某任务的所有每日施工日志"""
    conn = get_db()
    logs = dicts_from_rows(
        conn.execute('SELECT * FROM daily_task_logs WHERE task_id = ? ORDER BY log_date ASC', (task_id,)).fetchall()
    )
    conn.close()
    return jsonify({'success': True, 'data': logs})

@app.route('/api/daily-task-logs', methods=['POST'])
def create_daily_task_log():
    """创建或更新每日任务施工日志（同一任务+日期唯一）"""
    data = (request.get_json(silent=True) or {})
    task_id = data.get('task_id', '')
    log_date = data.get('log_date', '')
    project_id = data.get('project_id', '')
    if not task_id or not log_date:
        return jsonify({'success': False, 'error': 'task_id 和 log_date 不能为空'}), 400

    conn = get_db()
    # 查找是否已存在
    existing = conn.execute(
        'SELECT id FROM daily_task_logs WHERE task_id = ? AND log_date = ?', (task_id, log_date)
    ).fetchone()

    if existing:
        # 更新
        conn.execute(
            "UPDATE daily_task_logs SET content=?, weather=?, team=?, worker_count=?, materials=?, equipments=?, created_at=datetime('now','localtime') WHERE id=?",
            (data.get('content', ''), data.get('weather', ''), data.get('team', ''),
             data.get('worker_count', 0),
             json.dumps(data.get('materials', []), ensure_ascii=False) if data.get('materials') else '',
             json.dumps(data.get('equipments', []), ensure_ascii=False) if data.get('equipments') else '',
             existing['id'])
        )
        lid = existing['id']
    else:
        # 创建
        import uuid
        lid = str(uuid.uuid4())
        conn.execute(
            '''INSERT INTO daily_task_logs (id, project_id, task_id, log_date, content, weather, team, worker_count, materials, equipments)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (lid, project_id, task_id, log_date, data.get('content', ''),
             data.get('weather', ''), data.get('team', ''), data.get('worker_count', 0),
             json.dumps(data.get('materials', []), ensure_ascii=False) if data.get('materials') else '',
             json.dumps(data.get('equipments', []), ensure_ascii=False) if data.get('equipments') else '')
        )
    conn.commit()
    log = dict_from_row(conn.execute('SELECT * FROM daily_task_logs WHERE id = ?', (lid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': log})

@app.route('/api/daily-task-logs/<lid>', methods=['DELETE'])
def delete_daily_task_log(lid):
    """删除每日任务施工日志"""
    conn = get_db()
    conn.execute('DELETE FROM daily_task_logs WHERE id = ?', (lid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== 人员/班组/材料/设备 管理 (personnel) ====================

@app.route('/api/personnel/<resource_type>/project/<project_id>', methods=['GET'])
def get_personnel(resource_type, project_id):
    """获取班组/材料/设备列表"""
    table_map = {'teams': 'teams', 'materials': 'materials', 'equipments': 'equipments'}
    table = table_map.get(resource_type)
    if not table:
        return jsonify({'success': False, 'error': '无效资源类型'}), 400
    conn = get_db()
    items = dicts_from_rows(
        conn.execute(f'SELECT * FROM {table} WHERE project_id = ? ORDER BY created_at DESC', (project_id,)).fetchall()
    )
    conn.close()
    return jsonify({'success': True, 'data': items})

@app.route('/api/personnel/<resource_type>', methods=['POST'])
def create_personnel(resource_type):
    """创建班组/材料/设备"""
    table_map = {'teams': 'teams', 'materials': 'materials', 'equipments': 'equipments'}
    table = table_map.get(resource_type)
    if not table:
        return jsonify({'success': False, 'error': '无效资源类型'}), 400
    data = (request.get_json(silent=True) or {})
    project_id = data.get('project_id', '')
    if not project_id:
        return jsonify({'success': False, 'error': 'project_id 不能为空'}), 400
    rid = data.get('id') or str(int(datetime.now().timestamp() * 1000))
    conn = get_db()
    if table == 'teams':
        conn.execute(
            f'INSERT INTO {table} (id, project_id, name, leader, phone, specialty, worker_count, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (rid, project_id, data.get('name', ''), data.get('leader', ''), data.get('phone', ''),
             data.get('specialty', ''), data.get('worker_count', 0), data.get('remark', ''))
        )
    elif table == 'materials':
        conn.execute(
            f'INSERT INTO {table} (id, project_id, name, spec, unit, quantity, min_quantity, supplier, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (rid, project_id, data.get('name', ''), data.get('spec', ''), data.get('unit', ''),
             data.get('quantity', 0), data.get('min_quantity', 0), data.get('supplier', ''),
             data.get('status', 'in_stock'), data.get('remark', ''))
        )
    elif table == 'equipments':
        conn.execute(
            f'INSERT INTO {table} (id, project_id, name, model, count, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (rid, project_id, data.get('name', ''), data.get('model', ''),
             data.get('count', 1), data.get('status', 'normal'), data.get('remark', ''))
        )
    conn.commit()
    item = dict_from_row(conn.execute(f'SELECT * FROM {table} WHERE id = ?', (rid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': item})

@app.route('/api/personnel/<resource_type>/<rid>', methods=['PUT'])
def update_personnel(resource_type, rid):
    """更新班组/材料/设备"""
    table_map = {'teams': 'teams', 'materials': 'materials', 'equipments': 'equipments'}
    table = table_map.get(resource_type)
    if not table:
        return jsonify({'success': False, 'error': '无效资源类型'}), 400
    data = (request.get_json(silent=True) or {})
    conn = get_db()
    if table == 'teams':
        conn.execute(
            f"UPDATE {table} SET name=?, leader=?, phone=?, specialty=?, worker_count=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?",
            (data.get('name', ''), data.get('leader', ''), data.get('phone', ''),
             data.get('specialty', ''), data.get('worker_count', 0), data.get('remark', ''), rid)
        )
    elif table == 'materials':
        conn.execute(
            f"UPDATE {table} SET name=?, spec=?, unit=?, quantity=?, min_quantity=?, supplier=?, status=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?",
            (data.get('name', ''), data.get('spec', ''), data.get('unit', ''),
             data.get('quantity', 0), data.get('min_quantity', 0), data.get('supplier', ''),
             data.get('status', 'in_stock'), data.get('remark', ''), rid)
        )
    elif table == 'equipments':
        conn.execute(
            f"UPDATE {table} SET name=?, model=?, count=?, status=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?",
            (data.get('name', ''), data.get('model', ''), data.get('count', 1),
             data.get('status', 'normal'), data.get('remark', ''), rid)
        )
    conn.commit()
    item = dict_from_row(conn.execute(f'SELECT * FROM {table} WHERE id = ?', (rid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': item})

@app.route('/api/personnel/<resource_type>/<rid>', methods=['DELETE'])
def delete_personnel(resource_type, rid):
    """删除班组/材料/设备"""
    table_map = {'teams': 'teams', 'materials': 'materials', 'equipments': 'equipments'}
    table = table_map.get(resource_type)
    if not table:
        return jsonify({'success': False, 'error': '无效资源类型'}), 400
    conn = get_db()
    conn.execute(f'DELETE FROM {table} WHERE id = ?', (rid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== 收方管理 (acceptances) ====================

@app.route('/api/acceptances/project/<project_id>', methods=['GET'])
def get_acceptances(project_id):
    """获取某工程所有收方记录"""
    conn = get_db()
    items = dicts_from_rows(
        conn.execute('SELECT * FROM acceptances WHERE project_id = ? ORDER BY date DESC, created_at DESC', (project_id,)).fetchall()
    )
    conn.close()
    return jsonify({'success': True, 'data': items})

@app.route('/api/acceptances', methods=['POST'])
def create_acceptance():
    """创建收方记录"""
    data = (request.get_json(silent=True) or {})
    project_id = data.get('project_id', '')
    if not project_id:
        return jsonify({'success': False, 'error': 'project_id 不能为空'}), 400
    aid = data.get('id') or str(int(datetime.now().timestamp() * 1000))
    conn = get_db()
    conn.execute(
        '''INSERT INTO acceptances (id, project_id, task_id, rework_task_id, acceptance_type,
            name, location, unit, basis, design_qty, actual_qty, unit_price, total_price,
            calc_formula, quantity_type, status, date, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (aid, project_id, data.get('task_id', ''), data.get('rework_task_id', ''),
         data.get('acceptance_type', 'normal'), data.get('name', ''),
         data.get('location', ''), data.get('unit', ''), data.get('basis', ''),
         data.get('design_qty', 0), data.get('actual_qty', 0),
         data.get('unit_price', 0), data.get('total_price', 0),
         data.get('calc_formula', ''), data.get('quantity_type', ''),
         data.get('status', 'pending'), data.get('date', ''), data.get('remark', ''))
    )
    conn.commit()
    item = dict_from_row(conn.execute('SELECT * FROM acceptances WHERE id = ?', (aid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': item})

@app.route('/api/acceptances/<aid>', methods=['PUT'])
def update_acceptance(aid):
    """更新收方记录"""
    data = (request.get_json(silent=True) or {})
    conn = get_db()
    conn.execute(
        "UPDATE acceptances SET task_id=?, rework_task_id=?, acceptance_type=?, name=?, location=?, unit=?, basis=?, design_qty=?, actual_qty=?, unit_price=?, total_price=?, calc_formula=?, quantity_type=?, status=?, date=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?",
        (data.get('task_id', ''), data.get('rework_task_id', ''), data.get('acceptance_type', 'normal'),
         data.get('name', ''), data.get('location', ''), data.get('unit', ''),
         data.get('basis', ''), data.get('design_qty', 0), data.get('actual_qty', 0),
         data.get('unit_price', 0), data.get('total_price', 0),
         data.get('calc_formula', ''), data.get('quantity_type', ''),
         data.get('status', 'pending'), data.get('date', ''), data.get('remark', ''), aid)
    )
    conn.commit()
    item = dict_from_row(conn.execute('SELECT * FROM acceptances WHERE id = ?', (aid,)).fetchone())
    conn.close()
    return jsonify({'success': True, 'data': item})

@app.route('/api/acceptances/<aid>', methods=['DELETE'])
def delete_acceptance(aid):
    """删除收方记录"""
    conn = get_db()
    conn.execute('DELETE FROM acceptances WHERE id = ?', (aid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== 数据导出/导入 ====================

@app.route('/api/export', methods=['GET'])
def export_data():
    conn = get_db()
    projects = dicts_from_rows(conn.execute('SELECT * FROM projects ORDER BY created_at DESC').fetchall())
    tasks = dicts_from_rows(conn.execute('SELECT * FROM tasks ORDER BY start, id').fetchall())
    logs = dicts_from_rows(conn.execute('SELECT * FROM logs ORDER BY date DESC').fetchall())
    daily_task_logs = dicts_from_rows(conn.execute('SELECT * FROM daily_task_logs ORDER BY log_date').fetchall())
    conn.close()
    return jsonify({
        'success': True,
        'data': {
            'version': '2.1',
            'exported_at': datetime.now().isoformat(),
            'projects': projects,
            'tasks': tasks,
            'logs': logs,
            'daily_task_logs': daily_task_logs
        }
    })

@app.route('/api/import', methods=['POST'])
def import_data():
    data = (request.get_json(silent=True) or {})
    if not data:
        return jsonify({'success': False, 'error': '无效数据'}), 400
    conn = get_db()
    # 清空现有数据
    conn.execute('DELETE FROM daily_task_logs')
    conn.execute('DELETE FROM logs')
    conn.execute('DELETE FROM tasks')
    conn.execute('DELETE FROM projects')
    # 导入新数据
    for p in data.get('projects', []):
        conn.execute(
            'INSERT INTO projects (id, name, type, company, client, address, manager, recorder, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (p.get('id'), p.get('name', ''), p.get('type', 'custom'), p.get('company', ''),
             p.get('client', ''), p.get('address', ''), p.get('manager', ''), p.get('recorder', ''), p.get('duration', 0), p.get('created_at', ''), p.get('updated_at', ''))
        )
    for t in data.get('tasks', []):
        conn.execute(
            '''INSERT INTO tasks (id, project_id, category, name, location, start, end, team, status, description, remark, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (t.get('id'), t.get('project_id', ''), t.get('category', ''), t.get('name', ''),
             t.get('location', ''), t.get('start', ''), t.get('end', ''),
             t.get('team', ''), t.get('status', 'pending'),
             t.get('description', ''), t.get('remark', ''),
             t.get('created_at', ''), t.get('updated_at', ''))
        )
    for l in data.get('logs', []):
        conn.execute(
            '''INSERT INTO logs (id, project_id, project_name, unit, date, weather,
                temp_high, temp_low, wind, location, incident,
                production_record, tech_quality_safety, manager, recorder, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (l.get('id'), l.get('project_id', ''), l.get('project_name', ''), l.get('unit', ''),
             l.get('date', ''), l.get('weather', ''),
             l.get('temp_high', ''), l.get('temp_low', ''), l.get('wind', ''),
             l.get('location', ''), l.get('incident', ''),
             l.get('production_record', ''), l.get('tech_quality_safety', ''),
             l.get('manager', ''), l.get('recorder', ''),
             l.get('created_at', ''), l.get('updated_at', ''))
        )
    for dtl in data.get('daily_task_logs', []):
        conn.execute(
            '''INSERT INTO daily_task_logs (id, project_id, task_id, log_date, content, worker_count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (dtl.get('id'), dtl.get('project_id', ''), dtl.get('task_id', ''),
             dtl.get('log_date', ''), dtl.get('content', ''), dtl.get('worker_count', 0),
             dtl.get('created_at', ''))
        )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== 数据重置 ====================

@app.route('/api/reset', methods=['POST'])
def reset_data():
    conn = get_db()
    conn.execute('DELETE FROM daily_task_logs')
    conn.execute('DELETE FROM logs')
    conn.execute('DELETE FROM acceptances')
    conn.execute('DELETE FROM materials')
    conn.execute('DELETE FROM equipments')
    conn.execute('DELETE FROM teams')
    conn.execute('DELETE FROM tasks')
    conn.execute('DELETE FROM projects')
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== 前端路由 ====================

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('public', path)

# ==================== 启动 ====================

# 应用导入时自动初始化数据库
init_db()

if __name__ == '__main__':
    print('施工日志系统已启动: http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=True)
