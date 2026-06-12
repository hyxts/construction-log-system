/**
 * 甘特图模块 - Canvas 专业版施工横道图
 * 依赖：api.js + core.js（需在此文件之前加载）
 */

// ==================== 甘特图视图切换 ====================

async function setProjectView(view) {
  currentProjectView = view;
  document.getElementById('view-list-btn').classList.toggle('active', view === 'list');
  document.getElementById('view-gantt-btn').classList.toggle('active', view === 'gantt');
  document.getElementById('project-task-list').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('project-gantt').style.display = view === 'gantt' ? 'block' : 'none';
  await loadTasks();
}

// ==================== Canvas 辅助函数 ====================

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDateOffset(baseDate, offset) {
  const d = new Date(baseDate.getTime() + offset * 86400000);
  return d.toISOString().split('T')[0];
}

// ==================== 甘特图主渲染 ====================

async function renderGanttChart() {
  const proj = getActiveProject();
  const container = document.getElementById('project-gantt');
  if (!container) return;
  if (!proj) { container.innerHTML = '<div class="empty-state"><p>请先选择工程</p></div>'; return; }
  const tasks = proj.tasks || [];
  if (tasks.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>还没有施工任务计划</p><button class="btn btn-primary" style="margin-top:12px" onclick="showTaskForm()">添加第一个任务</button></div>`;
    return;
  }
  const dated = tasks.filter(t => t.start && t.end);
  if (dated.length === 0) { container.innerHTML = '<div class="empty-state"><p>任务缺少起止日期，无法生成甘特图</p></div>'; return; }

  // 加载班组映射（ID -> 名称）
  const teams = await fetchTeams();
  const teamNameMap = {};
  teams.forEach(t => { teamNameMap[t.id] = t.name; });

  // 确保收方数据和返工数据已加载
  if (acceptanceCache.length === 0) {
    await loadAcceptanceList();
  }
  if (reworkCache.length === 0) {
    await loadReworksList();
  }

  // 数据准备
  const allStarts = dated.map(t => new Date(t.start));
  const allEnds = dated.map(t => new Date(t.end));
  // 收集所有实际施工日志的日期，确保时间轴覆盖到所有实际施工的日期
  const allLogDates = [];
  for (const [tid, logs] of Object.entries(dailyTaskLogs)) {
    logs.forEach(l => { if (l.log_date) allLogDates.push(new Date(l.log_date)); });
  }
  const planMinDate = new Date(Math.min(...allStarts));
  const planMaxDate = new Date(Math.max(...allEnds));
  // 时间轴取计划工期和实际施工日期的并集，确保提前/延期的施工也能显示
  const minDate = allLogDates.length > 0
    ? new Date(Math.min(planMinDate.getTime(), Math.min(...allLogDates.map(d => d.getTime()))))
    : new Date(planMinDate.getTime());
  const maxDate = allLogDates.length > 0
    ? new Date(Math.max(planMaxDate.getTime(), Math.max(...allLogDates.map(d => d.getTime()))))
    : new Date(planMaxDate.getTime());
  // 扩展前后各3天留白
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 3);
  const totalDays = Math.ceil((maxDate - minDate) / 86400000) + 1;
  if (totalDays <= 0) { container.innerHTML = '<div class="empty-state"><p>任务日期范围无效</p></div>'; return; }

  const today = new Date(); today.setHours(0,0,0,0);
  const todayOffset = Math.ceil((today - minDate) / 86400000);
  const showTodayLine = today >= minDate && today <= maxDate;

  // 布局参数 - 单行显示，计划条+每日标记在同一行
  const LEFT_PANEL = 200;
  const ROW_H = 36;        // 单行行高
  const HEADER_H = 56;
  const DAY_W = Math.max(24, Math.min(48, Math.floor((window.innerWidth - LEFT_PANEL - 80) / totalDays)));
  const CHART_W = totalDays * DAY_W;
  const CHART_H = dated.length * ROW_H;
  const CANVAS_W = LEFT_PANEL + CHART_W;
  const CANVAS_H = HEADER_H + CHART_H;
  const DPR = window.devicePixelRatio || 1;

  // 构建容器HTML
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'completed').length;
  const inProg = tasks.filter(t => t.status === 'in_progress').length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const startStr = minDate.toISOString().split('T')[0];
  const endStr = maxDate.toISOString().split('T')[0];

  // 统计已标记施工的天数和返工数
  let markedDays = 0;
  Object.values(dailyTaskLogs).forEach(arr => { markedDays += arr.length; });
  const reworkCount = reworkCache.filter(r => r.status !== 'completed').length;

  container.innerHTML = `
    <div class="gantt-container" id="gantt-root">
      <div class="gantt-toolbar">
        <div class="gantt-info">
          <strong>${proj.name || ''} · 施工横道图</strong>
          <span>工期：${startStr} ~ ${endStr} · ${totalDays}天</span>
          <span>任务：${total}项 / 完成${done}项 / 进行中${inProg}项${reworkCount > 0 ? ` · <span style="color:var(--warning)">返工${reworkCount}项</span>` : ''}</span>
          <span style="color:var(--primary);font-weight:600">进度 ${pct}%</span>
        </div>
        <div class="gantt-legend">
          <div class="gantt-legend-item"><div class="gantt-legend-dot" style="background:#2563eb"></div>计划</div>
          <div class="gantt-legend-item"><div class="gantt-legend-dot" style="background:#16a34a"></div>实际</div>
        </div>
      </div>
      <div class="gantt-canvas-wrap" id="gantt-scroll">
        <canvas id="gantt-canvas" style="width:${CANVAS_W}px;height:${CANVAS_H}px"></canvas>
      </div>
    </div>
  `;

  // 延迟获取Canvas确保DOM渲染完毕
  setTimeout(() => {
    const canvas = document.getElementById('gantt-canvas');
    if (!canvas) return;
    canvas.width = CANVAS_W * DPR;
    canvas.height = CANVAS_H * DPR;
    canvas.style.width = CANVAS_W + 'px';
    canvas.style.height = CANVAS_H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 左侧面板背景
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, LEFT_PANEL, CANVAS_H);

    // 月份头部
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, CANVAS_W, HEADER_H);

    const months = [];
    for (let d = 0; d < totalDays; d++) {
      const date = new Date(minDate.getTime() + d * 86400000);
      const monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      if (months.length === 0 || months[months.length - 1].key !== monthKey) {
        months.push({ key: monthKey, start: d, label: date.getFullYear() + '年' + (date.getMonth() + 1) + '月' });
      } else {
        months[months.length - 1].end = d;
      }
    }
    months.forEach(m => { if (m.end === undefined) m.end = m.start; });

    ctx.font = 'bold 13px -apple-system,"Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    months.forEach(m => {
      const startX = LEFT_PANEL + m.start * DAY_W;
      const endX = LEFT_PANEL + m.end * DAY_W;
      const centerX = startX + (endX - startX) / 2;
      ctx.fillStyle = '#334155';
      ctx.fillText(m.label, centerX, 16);
      // 月份分隔线
      if (m.start > 0) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, HEADER_H);
        ctx.lineTo(startX, CANVAS_H);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // 日期小标
    ctx.font = '10px -apple-system,"Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    for (let d = 0; d < totalDays; d++) {
      const date = new Date(minDate.getTime() + d * 86400000);
      const x = LEFT_PANEL + d * DAY_W + DAY_W / 2;
      const dayNum = date.getDate();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      ctx.fillStyle = isWeekend ? '#ef4444' : '#64748b';
      ctx.fillText(dayNum, x, 38);
      // 周末背景
      if (isWeekend) {
        ctx.fillStyle = 'rgba(254,226,226,0.3)';
        ctx.fillRect(LEFT_PANEL + d * DAY_W, HEADER_H, DAY_W, CHART_H);
      }
      // 今日竖线
      if (showTodayLine && d === todayOffset) {
        const tx = LEFT_PANEL + d * DAY_W + DAY_W / 2;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(tx, HEADER_H);
        ctx.lineTo(tx, CANVAS_H);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px -apple-system,"Microsoft YaHei",sans-serif';
        ctx.fillText('今天', tx, HEADER_H + 4);
      }
    }

    // 网格线
    ctx.strokeStyle = '#e8ecf0';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]);
    for (let d = 0; d <= totalDays; d++) {
      const day = new Date(minDate.getTime() + d * 86400000);
      if (day.getDay() !== 1 && d !== 0) {
        const x = LEFT_PANEL + d * DAY_W;
        ctx.beginPath(); ctx.moveTo(x, HEADER_H); ctx.lineTo(x, CANVAS_H); ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // 左侧面板右边框（加深）
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LEFT_PANEL, HEADER_H);
    ctx.lineTo(LEFT_PANEL, CANVAS_H);
    ctx.stroke();

    // ===== 任务行（单行：蓝色计划条 + 绿色实际施工条） =====
    dated.forEach((t, i) => {
      const y = HEADER_H + i * ROW_H;
      const startOff = Math.ceil((new Date(t.start) - minDate) / 86400000);
      const duration = Math.max(1, Math.ceil((new Date(t.end) - new Date(t.start)) / 86400000) + 1);
      const planBarX = LEFT_PANEL + startOff * DAY_W;
      const planBarW = duration * DAY_W;
      const planBarH = 12; // 计划条高度
      const planBarY = y + 5; // 上方
      const actualBarY = y + 19; // 下方
      const actualBarH = 14;

      // 交替行背景
      if (i % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, y, LEFT_PANEL, ROW_H);
      }

      // 左侧任务名
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px -apple-system,"Microsoft YaHei",sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // 收方状态标记（检查收方记录）
      const tid = t._id || t.id;
      const hasAcceptance = acceptanceCache.some(a => a.task_id === tid);
      const rawName = (t.name || '') + (hasAcceptance ? ' [已收]' : '');
      const label = rawName.length > 16 ? rawName.substring(0,15) + '…' : rawName;
      ctx.fillText(label, 10, y + 10);

      // 类别色条（加宽、加圆角）
      const catColor = CATEGORY_COLORS[t.category] || CATEGORY_COLORS[''];
      ctx.fillStyle = catColor;
      roundRect(ctx, LEFT_PANEL - 5, planBarY + 1, 4, ROW_H - 14, 2);
      ctx.fill();

      // ===== 计划工期条（返工任务用橙红色） =====
      const isRework = reworkCache.some(r => r.task_id === tid && r.status !== 'completed');
      ctx.fillStyle = isRework ? '#f97316' : (t.status === 'completed' ? '#1d4ed8' : '#2563eb');
      roundRect(ctx, planBarX, planBarY, planBarW, planBarH, 4);
      ctx.fill();

      // 条内任务名（靠左居中）
      if (planBarW > 20) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px -apple-system,"Microsoft YaHei",sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const barLabel = rawName.length > Math.floor(planBarW / 9) ? rawName.substring(0, Math.floor(planBarW / 9) - 1) + '…' : rawName;
        ctx.fillText(barLabel, planBarX + 6, planBarY + planBarH / 2);
      }

      // ===== 实际施工条（绿色实心，连贯横道，根据 dailyTaskLogs） =====
      const taskId = t._id || t.id;
      const taskLogs = dailyTaskLogs[taskId] || [];
      const taskLogDates = new Set(taskLogs.map(l => l.log_date));

      // 收集所有在时间轴范围内的施工日期
      const actualDates = [];
      for (let d = 0; d < totalDays; d++) {
        const dateStr = formatDateOffset(minDate, d);
        if (taskLogDates.has(dateStr)) actualDates.push(d);
      }

      if (actualDates.length > 0) {
        // 合并连续日期为段
        const segments = [];
        let segStart = actualDates[0];
        let segEnd = actualDates[0];
        for (let k = 1; k < actualDates.length; k++) {
          if (actualDates[k] === segEnd + 1) {
            segEnd = actualDates[k];
          } else {
            segments.push({ start: segStart, end: segEnd });
            segStart = actualDates[k];
            segEnd = actualDates[k];
          }
        }
        segments.push({ start: segStart, end: segEnd });

        segments.forEach(seg => {
          const segX = LEFT_PANEL + seg.start * DAY_W;
          const segW = (seg.end - seg.start + 1) * DAY_W;
          ctx.fillStyle = '#16a34a';
          roundRect(ctx, segX, actualBarY, segW, actualBarH, 4);
          ctx.fill();
        });
      }

      // 存储任务数据用于交互
      t._ganttY = y;
      t._ganttH = ROW_H;
      t._ganttBarX = planBarX;
      t._ganttBarW = planBarW;
      t._ganttBarY = planBarY;
      t._ganttBarH = planBarH;
      t._ganttStartOff = startOff;
      t._ganttDuration = duration;
    });

    // 绑定新交互
    bindGanttInteraction(canvas, dated, CANVAS_W, CANVAS_H, minDate, totalDays, DAY_W, LEFT_PANEL, HEADER_H, ROW_H);
  }, 50);
}

// ==================== 甘特图交互（Canvas 点击/悬停） ====================

function bindGanttInteraction(canvas, tasks, cw, ch, minDate, totalDays, DAY_W, LEFT_PANEL, HEADER_H, ROW_H) {
  const tooltip = getOrCreateTooltip();
  const scrollWrap = document.getElementById('gantt-scroll');

  canvas.onmousemove = function(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = cw / rect.width;
    const scaleY = ch / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let hitTask = null;
    let hitDate = null;
    let inActualZone = false;
    for (const t of tasks) {
      if (t._ganttY === undefined) continue;
      if (my >= t._ganttY && my < t._ganttY + t._ganttH) {
        hitTask = t;
        // 实际条区域：计划条下方整个区域
        const actualZoneTop = t._ganttBarY + t._ganttBarH + 2;
        if (my >= actualZoneTop) {
          inActualZone = true;
          const cellCol = Math.floor((mx - LEFT_PANEL) / DAY_W);
          if (cellCol >= 0 && cellCol < totalDays) {
            hitDate = formatDateOffset(minDate, cellCol);
          }
        }
        break;
      }
    }

    if (hitTask) {
      const catColor = CATEGORY_COLORS[hitTask.category] || CATEGORY_COLORS[''];
      const taskId = hitTask._id || hitTask.id;
      const isMarked = hitDate && ((dailyTaskLogs[taskId] || []).some(l => l.log_date === hitDate));

      if (hitDate) {
        canvas.style.cursor = 'pointer';
        const markedLog = isMarked ? (dailyTaskLogs[taskId] || []).find(l => l.log_date === hitDate) : null;
        let extraLines = '';
        if (markedLog) {
          extraLines = `<div style="margin-top:4px;font-size:11px;color:#93c5fd">${markedLog.worker_count || 0}人 · ${markedLog.content || '已标记施工'}</div>`;
        }
        tooltip.innerHTML = `<div class="tt-name">${escHtml(hitTask.name || '')}</div>
          <div class="tt-row"><span class="tt-label">日期</span><span class="tt-val">${hitDate}</span></div>
          <div class="tt-row"><span class="tt-label">状态</span><span class="tt-val">${isMarked ? '已施工' : '未标记'}</span></div>${extraLines}
          <div class="tt-bar" style="background:${catColor};width:${Math.min(100,(hitTask._ganttDuration||1)*5)}px"></div>
          <div style="font-size:10px;color:#94a3b8;margin-top:4px">点击标记/取消施工</div>`;
      } else {
        canvas.style.cursor = 'pointer';
        tooltip.innerHTML = `<div class="tt-name">${escHtml(hitTask.name || '')}</div>
          <div class="tt-row"><span class="tt-label">状态</span><span class="tt-val">${hitTask.status || ''}</span></div>
          <div class="tt-bar" style="background:${catColor};width:${Math.min(100,(hitTask._ganttDuration||1)*5)}px"></div>
          <div style="font-size:10px;color:#94a3b8;margin-top:4px">点击编辑任务</div>`;
      }

      const tooltipRect = tooltip.getBoundingClientRect();
      let left = e.clientX + 15;
      let top = e.clientY - tooltipRect.height - 10;
      if (left + tooltipRect.width > window.innerWidth) left = e.clientX - tooltipRect.width - 15;
      if (top < 0) top = e.clientY + 15;
      tooltip.style.left = Math.max(0, left) + 'px';
      tooltip.style.top = Math.max(0, top) + 'px';
      tooltip.style.display = 'block';
    } else {
      tooltip.style.display = 'none';
      canvas.style.cursor = 'default';
    }
  };

  canvas.onmouseleave = function() {
    tooltip.style.display = 'none';
    canvas.style.cursor = 'default';
  };

  canvas.onclick = function(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = cw / rect.width;
    const scaleY = ch / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    for (const t of tasks) {
      if (t._ganttY === undefined) continue;
      if (my >= t._ganttY && my < t._ganttY + t._ganttH) {
        const actualZoneTop = t._ganttBarY + t._ganttBarH + 2;
        if (my >= actualZoneTop) {
          // 点击实际条区域 → 标记施工
          const cellCol = Math.floor((mx - LEFT_PANEL) / DAY_W);
          if (cellCol >= 0 && cellCol < totalDays) {
            toggleDailyMark(t, formatDateOffset(minDate, cellCol));
          }
        } else {
          // 点击计划条区域 → 编辑任务
          editTask(t._id || t.id);
        }
        return;
      }
    }
  };

  // 触控支持
  let touchTimeout = null;
  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      canvas.onmousemove({ clientX: touch.clientX, clientY: touch.clientY });
      touchTimeout = setTimeout(() => { tooltip.style.display = 'none'; }, 2000);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      canvas.onmousemove({ clientX: touch.clientX, clientY: touch.clientY });
      if (touchTimeout) clearTimeout(touchTimeout);
    }
  }, { passive: true });
  canvas.addEventListener('touchend', function(e) {
    if (touchTimeout) clearTimeout(touchTimeout);
    const lastTouch = e.changedTouches[0];
    if (lastTouch) {
      canvas.onclick({ clientX: lastTouch.clientX, clientY: lastTouch.clientY });
    }
    canvas.onmouseleave();
  });

  // 滚动同步tooltip隐藏
  if (scrollWrap) {
    scrollWrap.onscroll = () => { tooltip.style.display = 'none'; };
  }
}

// ==================== Tooltip 管理 ====================

function getOrCreateTooltip() {
  let tt = document.getElementById('gantt-tooltip');
  if (!tt) {
    tt = document.createElement('div');
    tt.id = 'gantt-tooltip';
    tt.className = 'gantt-tooltip';
    document.body.appendChild(tt);
  }
  return tt;
}

// ==================== 移动端看板视图（Kanban Board） ====================

/**
 * 移动端专用：施工看板视图
 * 横向滑动的状态列（待施工/施工中/已完工/超期），触控友好
 */
async function renderMobileKanban(container, proj, tasks, dated, teamNameMap, acceptanceCache, reworkCache, stats) {
  const { done, inProg, total, pct, startStr, endStr, totalDays, reworkCount } = stats;
  const todayStr_ = formatDate(new Date());

  // 分组到各状态列 —— 关键：超期 = 已超截止日且未完成
  const columns = [
    { key: 'pending', label: '待施工', tasks: [], color: '#64748b' },
    { key: 'in_progress', label: '施工中', tasks: [], color: '#2563eb' },
    { key: 'completed', label: '已完工', tasks: [], color: '#16a34a' },
    { key: 'overdue', label: '已超期', tasks: [], color: '#dc2626' }
  ];

  const colMap = {};
  columns.forEach(c => { colMap[c.key] = c; });

  dated.forEach(t => {
    const isOverdue = t.end && t.status !== 'completed' && todayStr_ > t.end;
    const key = isOverdue ? 'overdue' : (t.status || 'pending');
    const col = colMap[key] || colMap['pending'];
    col.tasks.push(t);
  });

  // 任务内排序：超期列按截止日升序，其余按开始日期
  columns.forEach(col => {
    col.tasks.sort((a, b) => {
      if (col.key === 'overdue') return (a.end || '').localeCompare(b.end || '');
      return (a.start || '').localeCompare(b.start || '');
    });
  });

  // 构建 HTML
  let html = '<div class="kanban-wrap" id="mobile-kanban-root">';

  // 紧凑头部
  html += `<div class="kb-header">
    <div class="kb-title">${escHtml(proj.name || '')} · 施工看板</div>
    <div class="kb-dates">${startStr} ~ ${endStr} · ${totalDays}天</div>
    <div class="kb-progress-wrap">
      <div class="kb-progress-bar"><div class="kb-progress-fill" style="width:${pct}%"></div></div>
      <div class="kb-progress-stats">
        <span>${total}项任务</span><span>·</span><span style="color:var(--success)">${done}完成</span><span>·</span><span style="color:var(--primary)">${inProg}进行中</span><span>·</span><span>${pct}%</span>${reworkCount > 0 ? `<span>·</span><span style="color:var(--warning)">${reworkCount}返工</span>` : ''}
      </div>
    </div>
  </div>`;

  // 看板主体：横向滚动
  html += '<div class="kb-board">';
  columns.forEach(col => {
    html += `<div class="kb-column" data-status="${col.key}">
      <div class="kb-col-header" style="--col-color:${col.color}">
        <span class="kb-col-label">${col.label}</span>
        <span class="kb-col-count">${col.tasks.length}</span>
      </div>
      <div class="kb-col-cards">`;

    if (col.tasks.length === 0) {
      html += `<div class="kb-empty-col">暂无任务</div>`;
    } else {
      col.tasks.forEach(t => {
        const tid = t._id || t.id;
        const catColor = CATEGORY_COLORS[t.category] || CATEGORY_COLORS[''];
        const isRework = reworkCache.some(r => r.task_id === tid && r.status !== 'completed');
        const hasAcceptance = acceptanceCache.some(a => a.task_id === tid);
        const taskLogs = dailyTaskLogs[tid] || [];
        const actualDays = taskLogs.length;
        const teamName = teamNameMap[t.team] || t.team || '';
        const canStart = col.key === 'pending';
        const canComplete = col.key === 'in_progress' || col.key === 'overdue';

        html += `<div class="kb-card" data-task-id="${escAttr(tid)}" onclick="kanbanEditTask('${escAttr(tid)}')">
          <div class="kb-card-cat" style="background:${catColor}"></div>
          <div class="kb-card-body">
            <div class="kb-card-name">
              ${escHtml(t.name || '')}
              ${isRework ? '<span class="kb-badge rework">返工</span>' : ''}
              ${hasAcceptance ? '<span class="kb-badge accept">收方</span>' : ''}
            </div>
            <div class="kb-card-dates">${t.start || '-'} → ${t.end || '-'}</div>
            ${teamName ? `<div class="kb-card-team">${escHtml(teamName)}</div>` : ''}
            ${actualDays > 0 ? `<div class="kb-card-actual">已施工 ${actualDays} 天</div>` : ''}
          </div>
          <div class="kb-card-actions" onclick="event.stopPropagation()">
            ${canStart ? `<button class="kb-btn kb-btn-start" onclick="kanbanChangeStatus('${escAttr(tid)}','in_progress')">开始</button>` : ''}
            ${canComplete ? `<button class="kb-btn kb-btn-done" onclick="kanbanChangeStatus('${escAttr(tid)}','completed')">完工</button>` : ''}
            <button class="kb-btn kb-btn-mark" onclick="kanbanQuickMark('${escAttr(tid)}')">记录</button>
          </div>
        </div>`;
      });
    }
    html += '</div></div>';
  });
  html += '</div>';

  // 列指示器
  html += '<div class="kb-dots">';
  columns.forEach((col, i) => {
    html += `<span class="kb-dot${i === 1 ? ' active' : ''}" data-col="${i}"></span>`;
  });
  html += '</div></div>';

  container.innerHTML = html;

  // 绑定滚动监听（更新活跃列指示器）
  setTimeout(() => {
    const board = container.querySelector('.kb-board');
    if (!board) return;
    const dots = container.querySelectorAll('.kb-dot');
    const cols = container.querySelectorAll('.kb-column');

    board.addEventListener('scroll', () => {
      let activeIdx = 0;
      const center = board.scrollLeft + board.clientWidth / 2;
      cols.forEach((col, i) => {
        if (col.offsetLeft <= center) activeIdx = i;
      });
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    }, { passive: true });

    // 初始滚动到施工中列
    const inProgCol = container.querySelector('.kb-column[data-status="in_progress"]');
    if (inProgCol && inProgCol.children[1].children.length > 0) {
      board.scrollLeft = Math.max(0, inProgCol.offsetLeft - 12);
    }
  }, 80);
}

// ===== 看板全局交互函数 =====

/** 切换任务状态 */
async function kanbanChangeStatus(tid, newStatus) {
  try {
    const proj = getActiveProject();
    if (!proj) return;
    const task = (proj.tasks || []).find(t => (t._id || t.id) === tid);
    if (!task) return;

    const resp = await fetch(`/api/tasks/${tid}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await resp.json();
    if (!json.success) throw new Error(json.error || '状态更新失败');

    const statusText = { pending: '待施工', in_progress: '施工中', completed: '已完工' };
    showToast('状态已更新：' + (statusText[newStatus] || newStatus));
    await loadTasks();
  } catch (err) {
    showToast('操作失败: ' + err.message, 'error');
  }
}

/** 点击卡片编辑 */
function kanbanEditTask(tid) {
  editTask(tid);
}

/** 快速记录施工 */
async function kanbanQuickMark(tid) {
  const proj = getActiveProject();
  if (!proj) return;
  const task = (proj.tasks || []).find(t => (t._id || t.id) === tid);
  if (!task) return;
  // 自动切换为「施工中」+ 标记今日施工
  try {
    if (task.status === 'pending') {
      await fetch(`/api/tasks/${tid}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
    }
    await toggleDailyMark(task, todayStr());
  } catch (err) {
    showToast('标记失败: ' + err.message, 'error');
  }
}

// ==================== 响应式重绘 ====================

let _ganttResizeTimer = null;
let _ganttLastWidth = window.innerWidth;

window.addEventListener('resize', () => {
  clearTimeout(_ganttResizeTimer);
  _ganttResizeTimer = setTimeout(() => {
    const newWidth = window.innerWidth;
    // 仅在跨越断点（768px）时重绘，同端内不重绘
    const crossedBreakpoint = (_ganttLastWidth <= 768 && newWidth > 768) || (_ganttLastWidth > 768 && newWidth <= 768);
    _ganttLastWidth = newWidth;
    if (!crossedBreakpoint) return;
    // 仅当前在工程页面的甘特图视图时才重绘
    const ganttContainer = document.getElementById('project-gantt');
    if (!ganttContainer || ganttContainer.style.display === 'none') return;
    const ganttRoot = document.getElementById('gantt-root');
    const mobileRoot = document.getElementById('mobile-kanban-root');
    if (ganttRoot || mobileRoot) {
      if (typeof loadTasks === 'function') loadTasks();
    }
  }, 300);
});
