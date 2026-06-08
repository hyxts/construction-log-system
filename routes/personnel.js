const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// ==================== 班组 CRUD ====================

// 获取某工程的所有班组
router.get('/teams/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const teams = db.prepare('SELECT * FROM teams WHERE project_id = ? ORDER BY name').all(req.params.projectId);
    res.json({ success: true, data: teams });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建班组
router.post('/teams', (req, res) => {
  try {
    const db = getDb();
    const { id, project_id, name, leader, phone, specialty, worker_count, remark } = req.body;
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id 不能为空' });
    if (!name) return res.status(400).json({ success: false, error: '班组名称不能为空' });
    const tid = id || String(Date.now());
    db.prepare(`
      INSERT INTO teams (id, project_id, name, leader, phone, specialty, worker_count, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tid, project_id, name, leader || '', phone || '', specialty || '', worker_count || 0, remark || '');
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(tid);
    res.json({ success: true, data: team });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新班组
router.put('/teams/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, leader, phone, specialty, worker_count, remark } = req.body;
    db.prepare(`
      UPDATE teams SET name = ?, leader = ?, phone = ?, specialty = ?, worker_count = ?, remark = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(name || '', leader || '', phone || '', specialty || '', worker_count ?? 0, remark || '', req.params.id);
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: team });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除班组
router.delete('/teams/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 班组统计汇总
router.get('/summary/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const teams = db.prepare(`SELECT * FROM teams WHERE project_id = ? ORDER BY name`).all(req.params.projectId);
    const totalWorkers = teams.reduce((sum, t) => sum + (t.worker_count || 0), 0);
    res.json({ success: true, data: { teams, totalWorkers } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 材料 CRUD ====================

router.get('/materials/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const list = db.prepare('SELECT * FROM materials WHERE project_id = ? ORDER BY name').all(req.params.projectId);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/materials', (req, res) => {
  try {
    const db = getDb();
    const { id, project_id, name, spec, unit, quantity, supplier, status, remark } = req.body;
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id 不能为空' });
    if (!name) return res.status(400).json({ success: false, error: '材料名称不能为空' });
    const mid = id || String(Date.now());
    db.prepare(`
      INSERT INTO materials (id, project_id, name, spec, unit, quantity, supplier, status, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mid, project_id, name, spec || '', unit || '', quantity || 0, supplier || '', status || 'in_stock', remark || '');
    const item = db.prepare('SELECT * FROM materials WHERE id = ?').get(mid);
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/materials/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, spec, unit, quantity, supplier, status, remark } = req.body;
    db.prepare(`
      UPDATE materials SET name=?, spec=?, unit=?, quantity=?, supplier=?, status=?, remark=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(name || '', spec || '', unit || '', quantity ?? 0, supplier || '', status || 'in_stock', remark || '', req.params.id);
    const item = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/materials/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 设备 CRUD ====================

router.get('/equipments/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const list = db.prepare('SELECT * FROM equipments WHERE project_id = ? ORDER BY name').all(req.params.projectId);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/equipments', (req, res) => {
  try {
    const db = getDb();
    const { id, project_id, name, model, count, status, remark } = req.body;
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id 不能为空' });
    if (!name) return res.status(400).json({ success: false, error: '设备名称不能为空' });
    const eid = id || String(Date.now());
    db.prepare(`
      INSERT INTO equipments (id, project_id, name, model, count, status, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eid, project_id, name, model || '', count || 1, status || 'normal', remark || '');
    const item = db.prepare('SELECT * FROM equipments WHERE id = ?').get(eid);
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/equipments/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, model, count, status, remark } = req.body;
    db.prepare(`
      UPDATE equipments SET name=?, model=?, count=?, status=?, remark=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(name || '', model || '', count ?? 1, status || 'normal', remark || '', req.params.id);
    const item = db.prepare('SELECT * FROM equipments WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/equipments/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM equipments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== 综合资源统计 ====================

router.get('/resource-summary/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const pid = req.params.projectId;
    const teams = db.prepare('SELECT * FROM teams WHERE project_id = ? ORDER BY name').all(pid);
    const totalWorkers = teams.reduce((sum, t) => sum + (t.worker_count || 0), 0);
    const materials = db.prepare('SELECT COUNT(*) as cnt FROM materials WHERE project_id = ?').get(pid);
    const equipments = db.prepare('SELECT COUNT(*) as cnt FROM equipments WHERE project_id = ?').get(pid);
    res.json({ success: true, data: {
      teams, totalWorkers,
      materialCount: materials?.cnt || 0,
      equipmentCount: equipments?.cnt || 0
    }});
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
