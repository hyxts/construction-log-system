const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// 获取某工程的所有每日任务施工日志
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare(
      'SELECT * FROM daily_task_logs WHERE project_id = ? ORDER BY log_date ASC'
    ).all(req.params.projectId);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取某任务的所有每日施工日志
router.get('/task/:taskId', (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare(
      'SELECT * FROM daily_task_logs WHERE task_id = ? ORDER BY log_date ASC'
    ).all(req.params.taskId);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建或更新每日任务施工日志
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { id, project_id, task_id, log_date, content, weather, team, worker_count, materials, equipments } = req.body;
    if (!task_id || !log_date) {
      return res.status(400).json({ success: false, error: 'task_id 和 log_date 不能为空' });
    }

    // 查找是否已存在
    const existing = db.prepare(
      'SELECT id FROM daily_task_logs WHERE task_id = ? AND log_date = ?'
    ).get(task_id, log_date);

    let lid;
    if (existing) {
      lid = existing.id;
      db.prepare(
        "UPDATE daily_task_logs SET content=?, weather=?, team=?, worker_count=?, materials=?, equipments=?, created_at=datetime('now','localtime') WHERE id=?"
      ).run(content || '', weather || '', team || '', worker_count || 0, materials || '', equipments || '', lid);
    } else {
      lid = id || String(Date.now()) + Math.random().toString(36).substr(2, 9);
      db.prepare(
        'INSERT INTO daily_task_logs (id, project_id, task_id, log_date, content, weather, team, worker_count, materials, equipments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(lid, project_id || '', task_id, log_date, content || '', weather || '', team || '', worker_count || 0, materials || '', equipments || '');
    }
    const log = db.prepare('SELECT * FROM daily_task_logs WHERE id = ?').get(lid);
    res.json({ success: true, data: log });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除每日任务施工日志
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM daily_task_logs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
