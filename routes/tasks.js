const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// ==================== 任务 CRUD ====================

// 获取某工程的所有任务
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id').all(req.params.projectId);
    res.json({ success: true, data: tasks });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建任务
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { id, project_id, category, name, location, start, end, team, status, description, remark } = req.body;
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id 不能为空' });
    const tid = id || String(Date.now());
    db.prepare(`
      INSERT INTO tasks (id, project_id, category, name, location, start, end, team, status, description, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tid, project_id, category || '', name || '', location || '', start || '', end || '', team || '', status || 'pending', description || '', remark || '');
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(tid);
    res.json({ success: true, data: task });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新任务
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { category, name, location, start, end, team, status, description, remark } = req.body;
    db.prepare(`
      UPDATE tasks SET category=?, name=?, location=?, start=?, end=?, team=?, status=?, description=?, remark=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(category, name, location, start, end, team, status, description, remark, req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    res.json({ success: true, data: task });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除任务
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 批量更新任务状态
router.patch('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    db.prepare("UPDATE tasks SET status=?, updated_at=datetime('now','localtime') WHERE id=?").run(status, req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: task });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 批量创建任务（从模板生成）
router.post('/batch', (req, res) => {
  try {
    const db = getDb();
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ success: false, error: 'tasks 不能为空' });
    }
    const stmt = db.prepare(`
      INSERT INTO tasks (id, project_id, category, name, location, start, end, team, status, description, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const inserted = [];
    for (const t of tasks) {
      const tid = t.id || String(Date.now()) + Math.random().toString(36).substr(2, 6);
      stmt.run(tid, t.project_id, t.category || '', t.name || '', t.location || '', t.start || '', t.end || '', t.team || '', t.status || 'pending', t.description || '', t.remark || '');
      inserted.push(tid);
    }
    res.json({ success: true, data: { count: inserted.length } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
