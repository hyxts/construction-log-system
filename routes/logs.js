const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// ==================== 日志 CRUD ====================

// 获取某工程的所有日志
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare('SELECT * FROM logs WHERE project_id = ? ORDER BY date DESC, created_at DESC').all(req.params.projectId);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取单条日志
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id);
    if (!log) return res.status(404).json({ success: false, error: '日志不存在' });
    res.json({ success: true, data: log });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建日志 — 同一日期+工程只保留一条（存在则更新）
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      id, project_id, project_name, unit, date, weather,
      temp_high, temp_low, wind, location, incident,
      production_record, tech_quality_safety, manager, recorder,
      materials, equipments, daily_task_log_ids
    } = req.body;
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id 不能为空' });
    if (!date) return res.status(400).json({ success: false, error: '日期不能为空' });

    // 检查同工程+同日期是否已有日志
    const existing = db.prepare('SELECT id FROM logs WHERE project_id = ? AND date = ?').get(project_id, date);

    let lid;
    if (existing) {
      // 已有日志 → 更新
      lid = existing.id;
      db.prepare(`
        UPDATE logs SET project_name=?, unit=?, weather=?,
          temp_high=?, temp_low=?, wind=?, location=?, incident=?,
          production_record=?, tech_quality_safety=?, manager=?, recorder=?,
          materials=?, equipments=?, daily_task_log_ids=?,
          updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(project_name || '', unit || '', weather || '',
        temp_high || '', temp_low || '', wind || '', location || '', incident || '',
        production_record || '', tech_quality_safety || '', manager || '', recorder || '',
        materials || '', equipments || '', daily_task_log_ids || '',
        lid);
    } else {
      // 新建
      lid = id || String(Date.now());
      db.prepare(`
        INSERT INTO logs (id, project_id, project_name, unit, date, weather,
          temp_high, temp_low, wind, location, incident,
          production_record, tech_quality_safety, manager, recorder, materials, equipments, daily_task_log_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(lid, project_id, project_name || '', unit || '', date || '', weather || '',
        temp_high || '', temp_low || '', wind || '', location || '', incident || '',
        production_record || '', tech_quality_safety || '', manager || '', recorder || '',
        materials || '', equipments || '', daily_task_log_ids || '');
    }

    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(lid);
    res.json({ success: true, data: log, isUpdate: !!existing });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新日志
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const {
      project_name, unit, date, weather,
      temp_high, temp_low, wind, location, incident,
      production_record, tech_quality_safety, manager, recorder,
      materials, equipments, daily_task_log_ids
    } = req.body;
    db.prepare(`
      UPDATE logs SET project_name=?, unit=?, date=?, weather=?,
        temp_high=?, temp_low=?, wind=?, location=?, incident=?,
        production_record=?, tech_quality_safety=?, manager=?, recorder=?,
        materials=?, equipments=?, daily_task_log_ids=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(project_name, unit, date, weather,
      temp_high, temp_low, wind, location, incident,
      production_record, tech_quality_safety, manager, recorder,
      materials || '', equipments || '', daily_task_log_ids || '',
      req.params.id);
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id);
    if (!log) return res.status(404).json({ success: false, error: '日志不存在' });
    res.json({ success: true, data: log });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除日志
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM logs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
