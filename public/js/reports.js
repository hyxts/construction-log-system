/**
 * 数据报表模块 - 施工总览报表 + 财务汇总报表
 * 依赖：api.js + core.js（需在此文件之前加载）
 */

// ==================== 状态 ====================

let reportDataCache = {};

// ==================== 初始化 ====================

function getReportProjectId() {
  const sel = document.getElementById('reports-project-filter');
  return sel ? sel.value : '';
}

async function loadCurrentReport() {
  // 仅处理 combined 和 finance 两个报表tab（logs 由 index.html 处理）
  const tab = typeof currentReportTab !== 'undefined' ? currentReportTab : 'combined';
  if (tab === 'logs') return; // logs 页由 switchReportLogSub 处理
  const pid = getReportProjectId();
  const param = pid ? '?project_id=' + pid : '';
  
  let contentEl;
  let updatedEl;
  if (tab === 'combined') {
    contentEl = document.getElementById('report-content-combined');
    updatedEl = document.getElementById('report-updated-at');
  } else if (tab === 'finance') {
    contentEl = document.getElementById('report-content-finance');
    updatedEl = document.getElementById('fin-report-updated-at');
  }
  if (!contentEl) return;
  contentEl.innerHTML = '<div class="empty-state"><p>加载中…</p></div>';
  try {
    const resp = await fetch('/api/reports/' + tab + param);
    const json = await resp.json();
    if (!json.success) throw new Error(json.error);
    reportDataCache[tab] = json.data;
    if (updatedEl) updatedEl.textContent = '更新于 ' + new Date().toLocaleString('zh-CN');
    if (tab === 'combined') renderCombinedReport(json.data);
    else if (tab === 'finance') renderFinanceReport(json.data);
  } catch (e) {
    contentEl.innerHTML = '<div class="empty-state"><p>加载失败: ' + escHtml(e.message) + '</p></div>';
  }
}

// ==================== 财务报表 ====================

function renderFinanceReport(d) {
  const t = d.totals || {};
  let html = '<div class="report-summary-grid">';
  html += `<div class="report-stat-card"><div class="rs-val danger">¥${(t.total_expense || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">总支出</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val success">¥${(t.total_income || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">总收入</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${t.total_count || 0}</div><div class="rs-lbl">总记录数</div></div>`;
  const balance = (t.total_income || 0) - (t.total_expense || 0);
  html += `<div class="report-stat-card"><div class="rs-val ${balance >= 0 ? 'success' : 'danger'}">¥${Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">${balance >= 0 ? '盈余' : '赤字'}</div></div>`;
  html += '</div>';

  // 按来源
  if (d.by_source && d.by_source.length) {
    html += '<div class="report-section-title">按资金来源</div>';
    html += '<table class="report-table"><thead><tr><th>来源</th><th>支出</th><th>收入</th><th>合计</th><th>笔数</th></tr></thead><tbody>';
    const maxAmt = Math.max(...d.by_source.map(s => s.total || 0), 1);
    d.by_source.forEach(s => {
      const srcName = s.source === 'company' ? '公司财务' : '个人';
      html += `<tr><td>${srcName}</td><td class="num">¥${(s.expense || 0).toFixed(2)}</td><td class="num">¥${(s.income || 0).toFixed(2)}</td><td class="num">¥${(s.total || 0).toFixed(2)} <span class="report-bar" style="width:${Math.round((s.total || 0) / maxAmt * 120)}px;background:var(--primary)"></span></td><td class="num">${s.cnt}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  // 按类别
  if (d.by_category && d.by_category.length) {
    html += '<div class="report-section-title">支出类别排行</div>';
    html += '<table class="report-table"><thead><tr><th>类别</th><th>金额</th><th>笔数</th></tr></thead><tbody>';
    const maxCat = d.by_category[0]?.total || 1;
    d.by_category.forEach(c => {
      html += `<tr><td>${escHtml(c.category)}</td><td class="num">¥${(c.total || 0).toFixed(2)} <span class="report-bar" style="width:${Math.round((c.total || 0) / maxCat * 120)}px;background:var(--danger)"></span></td><td class="num">${c.cnt}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  // 按月份
  if (d.by_month && d.by_month.length) {
    html += '<div class="report-section-title">月度趋势</div>';
    html += '<table class="report-table"><thead><tr><th>月份</th><th>支出</th><th>收入</th><th>笔数</th></tr></thead><tbody>';
    d.by_month.forEach(m => {
      html += `<tr><td>${m.month}</td><td class="num">¥${(m.expense || 0).toFixed(2)}</td><td class="num">¥${(m.income || 0).toFixed(2)}</td><td class="num">${m.cnt}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  // 按项目
  if (d.by_project && d.by_project.length) {
    html += '<div class="report-section-title">按项目分布</div>';
    html += '<table class="report-table"><thead><tr><th>项目</th><th>支出</th><th>收入</th><th>笔数</th></tr></thead><tbody>';
    d.by_project.forEach(p => {
      html += `<tr><td>${escHtml(p.project_name || p.project_ref || '通用')}</td><td class="num">¥${(p.expense || 0).toFixed(2)}</td><td class="num">¥${(p.income || 0).toFixed(2)}</td><td class="num">${p.cnt}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  document.getElementById('report-content-finance').innerHTML = html;
  const exBtn = document.getElementById('report-export-btn');
  if (exBtn) exBtn.textContent = '导出财务报表Excel';
}

// ==================== 收方报表 ====================

function renderAcceptanceReport(d) {
  const t = d.totals || {};
  let html = '<div class="report-summary-grid">';
  html += `<div class="report-stat-card"><div class="rs-val">${t.total_count || 0}</div><div class="rs-lbl">收方记录数</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val primary">¥${(t.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">累计总价</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${(t.total_design || 0).toLocaleString()}</div><div class="rs-lbl">设计总量</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val success">${(t.total_actual || 0).toLocaleString()}</div><div class="rs-lbl">实际总量</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val success">${t.confirmed_count || 0}</div><div class="rs-lbl">已确认</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val warning">${t.pending_count || 0}</div><div class="rs-lbl">待确认</div></div>`;
  html += '</div>';

  if (d.by_unit && d.by_unit.length) {
    html += '<div class="report-section-title">按计量单位统计</div>';
    html += '<table class="report-table"><thead><tr><th>单位</th><th>设计量</th><th>实际量</th><th>记录数</th></tr></thead><tbody>';
    d.by_unit.forEach(u => {
      html += `<tr><td>${escHtml(u.unit || '未知')}</td><td class="num">${(u.total_design || 0).toLocaleString()}</td><td class="num">${(u.total_actual || 0).toLocaleString()}</td><td class="num">${u.cnt}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  if (d.by_date && d.by_date.length) {
    html += '<div class="report-section-title">月度收方趋势</div>';
    html += '<table class="report-table"><thead><tr><th>月份</th><th>设计量</th><th>实际量</th><th>记录数</th></tr></thead><tbody>';
    d.by_date.forEach(m => {
      html += `<tr><td>${m.month}</td><td class="num">${(m.total_design || 0).toLocaleString()}</td><td class="num">${(m.total_actual || 0).toLocaleString()}</td><td class="num">${m.cnt}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  if (d.by_project && d.by_project.length) {
    html += '<div class="report-section-title">按项目分布</div>';
    html += '<table class="report-table"><thead><tr><th>项目</th><th>设计量</th><th>实际量</th><th>总价</th><th>记录数</th></tr></thead><tbody>';
    d.by_project.forEach(p => {
      html += `<tr><td>${escHtml(p.project_name || '未知')}</td><td class="num">${(p.total_design || 0).toLocaleString()}</td><td class="num">${(p.total_actual || 0).toLocaleString()}</td><td class="num">¥${(p.total_price || 0).toFixed(2)}</td><td class="num">${p.cnt}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  if (d.items && d.items.length) {
    html += '<div class="report-section-title">收方明细（最近50条）</div>';
    html += '<table class="report-table"><thead><tr><th>名称</th><th>项目</th><th>日期</th><th>设计量</th><th>实际量</th><th>单位</th><th>状态</th></tr></thead><tbody>';
    d.items.slice(0, 50).forEach(i => {
      html += `<tr><td>${escHtml(i.name || '')}</td><td>${escHtml(i.project_name || '')}</td><td>${(i.date || '').substring(0, 10)}</td><td class="num">${(i.design_qty || 0).toLocaleString()}</td><td class="num">${(i.actual_qty || 0).toLocaleString()}</td><td>${i.unit || ''}</td><td>${i.status === 'confirmed' ? '已确认' : '待确认'}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  // 收方报表已移除独立Tab，由 loadCurrentReport 调用时写入对应容器
  const ct = document.getElementById('report-content-combined');
  if (ct) ct.innerHTML = html;
}

// ==================== 人员报表 ====================

function renderPersonnelReport(d) {
  const ts = d.task_status || {};
  const rw = d.rework_stats || {};
  let html = '<div class="report-summary-grid">';
  html += `<div class="report-stat-card"><div class="rs-val">${ts.total || 0}</div><div class="rs-lbl">任务总数</div></div>`;
  const pct = ts.total ? Math.round((ts.completed || 0) / ts.total * 100) : 0;
  html += `<div class="report-stat-card"><div class="rs-val success">${ts.completed || 0}</div><div class="rs-lbl">已完成 (${pct}%)</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val primary">${ts.in_progress || 0}</div><div class="rs-lbl">进行中</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${ts.pending || 0}</div><div class="rs-lbl">待开始</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${(d.team_stats || []).length}</div><div class="rs-lbl">班组数</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val primary">${(d.total_workers || {}).total || 0}</div><div class="rs-lbl">总工人数</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val warning">${rw.total || 0}</div><div class="rs-lbl">返工记录</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val ${(rw.pending || 0) > 0 ? 'danger' : ''}">${rw.pending || 0}</div><div class="rs-lbl">待处理返工</div></div>`;
  html += '</div>';

  if (d.team_stats && d.team_stats.length) {
    html += '<div class="report-section-title">班组任务统计</div>';
    html += '<table class="report-table"><thead><tr><th>班组</th><th>人数</th><th>任务数</th><th>已完成</th><th>完成率</th><th>专业</th></tr></thead><tbody>';
    d.team_stats.forEach(tm => {
      const rate = tm.task_count ? Math.round((tm.completed_tasks || 0) / tm.task_count * 100) : 0;
      html += `<tr><td>${escHtml(tm.name || '')}</td><td class="num">${tm.workers || 0}</td><td class="num">${tm.task_count || 0}</td><td class="num">${tm.completed_tasks || 0}</td><td class="num"><span style="color:${rate >= 80 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)'}">${rate}%</span></td><td>${escHtml(tm.specialty || '')}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  if (d.task_by_category && d.task_by_category.length) {
    html += '<div class="report-section-title">工序分类统计</div>';
    html += '<table class="report-table"><thead><tr><th>分类</th><th>任务数</th><th>已完成</th><th>完成率</th></tr></thead><tbody>';
    d.task_by_category.forEach(c => {
      const rate = c.cnt ? Math.round((c.completed || 0) / c.cnt * 100) : 0;
      html += `<tr><td>${escHtml(c.category)}</td><td class="num">${c.cnt}</td><td class="num">${c.completed || 0}</td><td class="num"><span style="color:${rate >= 80 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)'}">${rate}%</span></td></tr>`;
    });
    html += '</tbody></table>';
  }

  if (rw.total > 0) {
    html += '<div class="report-section-title">返工统计</div>';
    html += '<table class="report-table"><thead><tr><th>状态</th><th>数量</th><th>总工程量</th></tr></thead><tbody>';
    html += `<tr><td>待处理</td><td class="num">${rw.pending || 0}</td><td class="num">-</td></tr>`;
    html += `<tr><td>返工中</td><td class="num">${rw.in_progress || 0}</td><td class="num">-</td></tr>`;
    html += `<tr><td>已完成</td><td class="num">${rw.completed || 0}</td><td class="num">${(rw.total_qty || 0).toLocaleString()}</td></tr>`;
    html += '</tbody></table>';
  }

  const ct = document.getElementById('report-content-combined');
  if (ct) ct.innerHTML = html;
}

// ==================== 综合报表 ====================

function renderCombinedReport(d) {
  const fin = d.finance || {}, acc = d.acceptance || {}, task = d.tasks || {};
  const tm = d.teams || {}, rw = d.reworks || {};
  let html = '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">涵盖 ' + (d.project_count || 0) + ' 个工程的数据汇总</div>';

  // 财务概览
  html += '<div class="report-section-title">财务概览</div>';
  html += '<div class="report-summary-grid">';
  html += `<div class="report-stat-card"><div class="rs-val success">¥${(fin.total_income || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">总收入</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val danger">¥${(fin.total_expense || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">总支出</div></div>`;
  const balance = (fin.total_income || 0) - (fin.total_expense || 0);
  html += `<div class="report-stat-card"><div class="rs-val ${balance >= 0 ? 'success' : 'danger'}">¥${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">收支结余</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${fin.count || 0}</div><div class="rs-lbl">财务记录数</div></div>`;
  html += '</div>';

  // 任务与收方概览
  html += '<div class="report-section-title">任务与收方概览</div>';
  html += '<div class="report-summary-grid">';
  html += `<div class="report-stat-card"><div class="rs-val">${task.total || 0}</div><div class="rs-lbl">任务总数</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val success">${task.completed || 0}</div><div class="rs-lbl">已完成</div></div>`;
  const taskPct = task.total ? Math.round((task.completed || 0) / task.total * 100) : 0;
  html += `<div class="report-stat-card"><div class="rs-val primary">${taskPct}%</div><div class="rs-lbl">完成率</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val primary">¥${(acc.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div class="rs-lbl">收方总价</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${acc.count || 0}</div><div class="rs-lbl">收方记录</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${acc.confirmed || 0}</div><div class="rs-lbl">已确认收方</div></div>`;
  html += '</div>';

  // 人员与返工概览
  html += '<div class="report-section-title">人员与返工概览</div>';
  html += '<div class="report-summary-grid">';
  html += `<div class="report-stat-card"><div class="rs-val primary">${tm.total_workers || 0}</div><div class="rs-lbl">人员总数</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val">${tm.count || 0}</div><div class="rs-lbl">班组数</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val warning">${rw.total || 0}</div><div class="rs-lbl">返工记录</div></div>`;
  html += `<div class="report-stat-card"><div class="rs-val ${rw.pending > 0 ? 'danger' : 'success'}">${rw.completed || 0}/${rw.total || 0}</div><div class="rs-lbl">返工解决率</div></div>`;
  html += '</div>';

  // 各工程明细
  if (d.by_project && d.by_project.length) {
    html += '<div class="report-section-title">各工程明细</div>';
    html += '<table class="report-table"><thead><tr><th>工程名称</th><th>任务(已完成)</th><th>收入</th><th>支出</th><th>结余</th><th>收方记录</th><th>收方总价</th></tr></thead><tbody>';
    const statusMap = { active: '在建', completed: '竣工', paused: '暂停', pending: '待开始' };
    d.by_project.forEach(p => {
      const pBalance = (p.income || 0) - (p.expense || 0);
      html += `<tr><td>${escHtml(p.name || '')}</td><td class="num">${p.task_count || 0} (${p.task_done || 0})</td><td class="num" style="color:var(--success)">¥${(p.income || 0).toFixed(2)}</td><td class="num" style="color:var(--danger)">¥${(p.expense || 0).toFixed(2)}</td><td class="num" style="color:${pBalance >= 0 ? 'var(--success)' : 'var(--danger)'}">¥${pBalance.toFixed(2)}</td><td class="num">${p.acceptance_count || 0}</td><td class="num">¥${(p.acceptance_total || 0).toFixed(2)}</td></tr>`;
    });
    // 合计行
    const totalIncome = d.by_project.reduce((s, p) => s + (p.income || 0), 0);
    const totalExpense = d.by_project.reduce((s, p) => s + (p.expense || 0), 0);
    const totalBalance = totalIncome - totalExpense;
    html += `<tr style="font-weight:700;background:var(--bg2)"><td>合计</td><td class="num">${d.by_project.reduce((s,p)=>s+(p.task_count||0),0)} (${d.by_project.reduce((s,p)=>s+(p.task_done||0),0)})</td><td class="num">¥${totalIncome.toFixed(2)}</td><td class="num">¥${totalExpense.toFixed(2)}</td><td class="num" style="color:${totalBalance >= 0 ? 'var(--success)' : 'var(--danger)'}">¥${totalBalance.toFixed(2)}</td><td class="num">${d.by_project.reduce((s,p)=>s+(p.acceptance_count||0),0)}</td><td class="num">¥${d.by_project.reduce((s,p)=>s+(p.acceptance_total||0),0).toFixed(2)}</td></tr>`;
    html += '</tbody></table>';
  }

  document.getElementById('report-content-combined').innerHTML = html;
  const exBtn = document.getElementById('report-export-btn');
  if (exBtn) exBtn.textContent = '导出综合报表Excel';
}

// ==================== CSV 导出 (保留兼容) ====================

function exportReportCSV() {
  const tab = typeof currentReportTab !== 'undefined' ? currentReportTab : 'combined';
  const d = reportDataCache[tab];
  if (!d) return showToast('暂无报表数据，请先加载', 'error');
  const pid = getReportProjectId();
  const projName = pid ? (projects.find(p => String(p._id || p.id) === String(pid)) || {}).name || '筛选项目' : '全部工程';
  const now = new Date().toISOString().substring(0, 10);
  const tabNames = { finance: '财务', acceptance: '收方', personnel: '人员', combined: '综合' };
  const filename = `${tabNames[tab] || ''}报表_${projName}_${now}.csv`;

  let csv = '\uFEFF'; // BOM for Excel
  csv += `${tabNames[tab] || ''}报表 - ${projName} | 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  if (tab === 'finance') csv += financeReportCSV(d);
  else if (tab === 'acceptance') csv += acceptanceReportCSV(d);
  else if (tab === 'personnel') csv += personnelReportCSV(d);
  else if (tab === 'combined') csv += combinedReportCSV(d);

  downloadCSV(csv, filename);
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('报表已导出: ' + filename, 'success');
}

// ==================== Excel 导出 ====================

function exportReportExcel() {
  const tab = typeof currentReportTab !== 'undefined' ? currentReportTab : 'combined';
  const pid = getReportProjectId();
  const param = pid ? '?project_id=' + pid : '';
  const a = document.createElement('a');
  a.href = '/api/reports/' + tab + '/excel' + param;
  a.download = '';
  a.click();
  showToast('正在下载 Excel 报表…', 'info');
}

// ==================== PDF 导出 ====================

function exportReportPDF() {
  const tab = typeof currentReportTab !== 'undefined' ? currentReportTab : 'combined';
  const ctId = tab === 'finance' ? 'report-content-finance' : 'report-content-combined';
  const content = document.getElementById(ctId)?.innerHTML || '';
  const tabName = { finance: '财务报表', combined: '综合报表' }[tab] || '报表';
  const pid = getReportProjectId();
  const projName = pid ? (projects.find(p => String(p._id || p.id) === String(pid)) || {}).name || '筛选项目' : '全部工程';
  const nowStr = new Date().toLocaleString('zh-CN');

  // 从报表 HTML 提取纯文本数据，生成打印友好页面
  const printHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${tabName} - ${projName}</title>
<style>
  @media print {
    body { margin: 0; padding: 12mm; }
    .no-print { display: none; }
  }
  body {
    font-family: "SimSun", "宋体", "Microsoft YaHei", sans-serif;
    max-width: 210mm; margin: 0 auto; padding: 20px;
    color: #333; line-height: 1.6;
  }
  h1 { text-align: center; font-size: 22px; margin-bottom: 5px; }
  .subtitle { text-align: center; font-size: 13px; color: #888; margin-bottom: 20px; }
  .summary-grid { margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px; }
  .stat-card {
    flex: 1; min-width: 120px; padding: 12px; text-align: center;
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
  }
  .stat-card .val { font-size: 22px; font-weight: 700; color: #0f172a; }
  .stat-card .lbl { font-size: 11px; color: #64748b; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; background: #f1f5f9; border-bottom: 2px solid #2563eb; font-weight: 600; }
  td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }
  .num { text-align: right; }
  .section-title { font-size: 15px; font-weight: 700; margin: 20px 0 8px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; }
  .report-bar { display: inline-block; height: 6px; border-radius: 3px; vertical-align: middle; margin-right: 6px; background: #2563eb; }
  .btn-print { display: block; margin: 20px auto; padding: 10px 30px; font-size: 16px; cursor: pointer; background: #2563eb; color: #fff; border: none; border-radius: 6px; }
  .btn-print:hover { background: #1d4ed8; }
</style>
</head>
<body>
  <h1>${tabName}</h1>
  <div class="subtitle">${projName} · 导出时间：${nowStr}</div>
  ${content}
  <button class="btn-print no-print" onclick="window.print()">打印 / 保存为PDF</button>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { showToast('请允许弹窗以查看PDF打印版本', 'info'); return; }
  w.document.write(printHtml);
  w.document.close();
  showToast('PDF 打印版已在新窗口打开，请使用浏览器"另存为PDF"保存', 'info');
}

// ==================== 打印（保留兼容） ====================

function financeReportCSV(d) {
  let csv = '=== 财务报表 ===\n';
  const t = d.totals || {};
  csv += `总支出,¥${(t.total_expense || 0).toFixed(2)}\n`;
  csv += `总收入,¥${(t.total_income || 0).toFixed(2)}\n`;
  csv += `总记录数,${t.total_count || 0}\n\n`;

  csv += '按资金来源\n来源,支出,收入,合计,笔数\n';
  (d.by_source || []).forEach(s => {
    csv += `${s.source === 'company' ? '公司财务' : '个人'},${(s.expense || 0).toFixed(2)},${(s.income || 0).toFixed(2)},${(s.total || 0).toFixed(2)},${s.cnt}\n`;
  });
  csv += '\n支出类别排行\n类别,金额,笔数\n';
  (d.by_category || []).forEach(c => { csv += `"${c.category}",${(c.total || 0).toFixed(2)},${c.cnt}\n`; });
  csv += '\n月度趋势\n月份,支出,收入,笔数\n';
  (d.by_month || []).forEach(m => { csv += `${m.month},${(m.expense || 0).toFixed(2)},${(m.income || 0).toFixed(2)},${m.cnt}\n`; });
  return csv;
}

function acceptanceReportCSV(d) {
  let csv = '=== 收方报表 ===\n';
  const t = d.totals || {};
  csv += `记录数,${t.total_count || 0}\n`;
  csv += `累计总价,¥${(t.total_price || 0).toFixed(2)}\n`;
  csv += `设计总量,${(t.total_design || 0).toFixed(2)}\n`;
  csv += `实际总量,${(t.total_actual || 0).toFixed(2)}\n\n`;

  csv += '收方明细\n名称,项目,日期,设计量,实际量,单位,状态\n';
  (d.items || []).forEach(i => {
    csv += `"${i.name || ''}","${i.project_name || ''}","${(i.date || '').substring(0, 10)}",${i.design_qty || 0},${i.actual_qty || 0},"${i.unit || ''}",${i.status === 'confirmed' ? '已确认' : '待确认'}\n`;
  });
  return csv;
}

function personnelReportCSV(d) {
  let csv = '=== 人员报表 ===\n';
  const ts = d.task_status || {};
  csv += `任务总数,${ts.total || 0}\n`;
  csv += `已完成,${ts.completed || 0}\n`;
  csv += `进行中,${ts.in_progress || 0}\n`;
  csv += `待开始,${ts.pending || 0}\n\n`;

  csv += '班组统计\n班组,人数,任务数,已完成,完成率\n';
  (d.team_stats || []).forEach(tm => {
    const rate = tm.task_count ? Math.round((tm.completed_tasks || 0) / tm.task_count * 100) : 0;
    csv += `"${tm.name || ''}",${tm.workers || 0},${tm.task_count || 0},${tm.completed_tasks || 0},${rate}%\n`;
  });
  return csv;
}

function combinedReportCSV(d) {
  let csv = '=== 综合报表 ===\n';
  const fin = d.finance || {}, acc = d.acceptance || {}, task = d.tasks || {};
  csv += `工程总数,${d.project_count || 0}\n`;
  csv += `总收入,¥${(fin.total_income || 0).toFixed(2)}\n`;
  csv += `总支出,¥${(fin.total_expense || 0).toFixed(2)}\n`;
  csv += `收支结余,¥${((fin.total_income||0)-(fin.total_expense||0)).toFixed(2)}\n`;
  csv += `收方总价,¥${(acc.total_price || 0).toFixed(2)}\n`;
  csv += `任务总数,${task.total || 0}\n`;
  csv += `已完成任务,${task.completed || 0}\n\n`;

  csv += '各工程明细\n工程名称,任务数,已完成,收入,支出,结余,收方记录,收方总价\n';
  (d.by_project || []).forEach(p => {
    csv += `"${p.name || ''}",${p.task_count || 0},${p.task_done || 0},${(p.income || 0).toFixed(2)},${(p.expense || 0).toFixed(2)},${((p.income||0)-(p.expense||0)).toFixed(2)},${p.acceptance_count || 0},${(p.acceptance_total || 0).toFixed(2)}\n`;
  });
  return csv;
}

function printReport() {
  const tab = typeof currentReportTab !== 'undefined' ? currentReportTab : 'combined';
  const ctId = tab === 'finance' ? 'report-content-finance' : 'report-content-combined';
  const content = document.getElementById(ctId)?.innerHTML || '';
  const tabNames = { finance: '财务汇总', combined: '施工总览' };
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<html><head><meta charset="UTF-8"><title>${tabNames[tab] || ''}</title>
<style>body{font-family:-apple-system,'Microsoft YaHei',sans-serif;padding:30px;color:#0f172a;line-height:1.6}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-size:13px}
th{background:#f1f5f9}.num{text-align:right}.report-section-title{font-size:16px;font-weight:700;margin:24px 0 8px;border-bottom:2px solid #2563eb;padding-bottom:4px}
.report-stat-card{display:inline-block;width:30%;margin:6px 1%;padding:12px;text-align:center;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.rs-val{font-size:22px;font-weight:700;color:#0f172a}.rs-lbl{font-size:11px;color:#64748b}
.report-summary-grid{margin-bottom:16px}@media print{body{padding:0}}
</style></head><body><h2>${tabNames[tab] || ''}</h2><p style="color:#94a3b8;font-size:12px;margin-bottom:20px">导出时间: ${new Date().toLocaleString('zh-CN')}</p>${content}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
