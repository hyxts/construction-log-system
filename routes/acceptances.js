const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// 获取某工程的所有收方记录
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const list = db.prepare('SELECT * FROM acceptances WHERE project_id = ? ORDER BY date DESC, created_at DESC').all(req.params.projectId);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取单条收方记录
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const item = db.prepare('SELECT * FROM acceptances WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '记录不存在' });
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建收方记录
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { id, project_id, name, location, unit, basis, design_qty, actual_qty, unit_price, total_price, calc_formula, status, date, remark,
      rework_task_id, quantity_type, task_id, acceptance_type } = req.body;
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id 不能为空' });
    if (!name) return res.status(400).json({ success: false, error: '收方项目名称不能为空' });
    const aid = id || String(Date.now());
    db.prepare(`
      INSERT INTO acceptances (id, project_id, name, location, unit, basis, design_qty, actual_qty, unit_price, total_price, calc_formula, status, date, remark, rework_task_id, quantity_type, task_id, acceptance_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(aid, project_id, name, location || '', unit || '', basis || '', design_qty || 0, actual_qty || 0, unit_price || 0, total_price || 0, calc_formula || '', status || 'pending', date || '', remark || '',
      rework_task_id || '', quantity_type || '', task_id || '', acceptance_type || 'normal');
    const item = db.prepare('SELECT * FROM acceptances WHERE id = ?').get(aid);
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新收方记录
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, location, unit, basis, design_qty, actual_qty, unit_price, total_price, calc_formula, status, date, remark,
      rework_task_id, quantity_type, task_id, acceptance_type } = req.body;
    db.prepare(`
      UPDATE acceptances SET name=?, location=?, unit=?, basis=?, design_qty=?, actual_qty=?, unit_price=?, total_price=?, calc_formula=?, status=?, date=?, remark=?, rework_task_id=?, quantity_type=?, task_id=?, acceptance_type=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(name || '', location || '', unit || '', basis || '', design_qty ?? 0, actual_qty ?? 0, unit_price ?? 0, total_price ?? 0, calc_formula || '', status || 'pending', date || '', remark || '',
      rework_task_id || '', quantity_type || '', task_id || '', acceptance_type || 'normal', req.params.id);
    const item = db.prepare('SELECT * FROM acceptances WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除收方记录
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM acceptances WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 收方汇总统计
router.get('/summary/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const pid = req.params.projectId;
    const items = db.prepare('SELECT * FROM acceptances WHERE project_id = ? ORDER BY date DESC').all(pid);
    const totalCount = items.length;
    const pendingCount = items.filter(i => i.status === 'pending').length;
    const confirmedCount = items.filter(i => i.status === 'confirmed').length;
    res.json({ success: true, data: { items, totalCount, pendingCount, confirmedCount } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
