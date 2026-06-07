const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// ==================== 工程 CRUD ====================

// 获取所有工程
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    const tasksStmt = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id');
    const result = projects.map(p => ({
      ...p,
      tasks: tasksStmt.all(p.id)
    }));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取单个工程
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: '工程不存在' });
    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id').all(req.params.id);
    res.json({ success: true, data: { ...project, tasks } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建工程
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { id, name, type, company, manager, recorder } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '工程名称不能为空' });
    const pid = id || String(Date.now());
    db.prepare(`
      INSERT INTO projects (id, name, type, company, manager, recorder)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(pid, name, type || 'custom', company || '', manager || '', recorder || '');
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
    res.json({ success: true, data: { ...project, tasks: [] } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新工程
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, type, company, manager, recorder } = req.body;
    db.prepare(`
      UPDATE projects SET name=?, type=?, company=?, manager=?, recorder=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(name, type, company, manager, recorder, req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: '工程不存在' });
    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY start, id').all(req.params.id);
    res.json({ success: true, data: { ...project, tasks } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除工程
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
