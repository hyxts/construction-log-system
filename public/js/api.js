/**
 * API 客户端模块
 * 统一封装所有后端 REST API 请求
 * 依赖：无（纯函数，不依赖应用状态）
 */

// ==================== 基础工具 ====================

function genId() {
  return String(Date.now()) + '_' + Math.random().toString(36).substr(2, 9);
}

function initDatabase() {
  // 不再需要初始化，后端自动管理数据库
  return Promise.resolve();
}

// ==================== 通用 HTTP 请求封装 ====================

async function apiGet(url) {
  const resp = await fetch(url);
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data;
}

async function apiPost(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data;
}

async function apiPut(url, body) {
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data;
}

async function apiDelete(url) {
  const resp = await fetch(url, { method: 'DELETE' });
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data;
}

async function apiPatch(url, body) {
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data;
}

// ==================== 工程 (Projects) ====================

async function fetchProjects() {
  return await apiGet('/api/projects');
}

async function createProject(data) {
  const id = genId();
  await apiPost('/api/projects', { ...data, id });
  return id;
}

async function updateProject(id, data) {
  await apiPut('/api/projects/' + id, data);
}

async function deleteProject(id) {
  await apiDelete('/api/projects/' + id);
}

// ==================== 任务 (Tasks) ====================

async function fetchTasksByProject(projectId) {
  return await apiGet('/api/tasks/project/' + projectId);
}

async function createTask(data) {
  const id = genId();
  await apiPost('/api/tasks', { ...data, id });
  return id;
}

// 注意：API 层的 updateTask / deleteTask 在函数名后加 Api 后缀，
// 避免与 UI 层同名函数冲突

async function updateTaskApi(id, data) {
  await apiPut('/api/tasks/' + id, data);
}

async function deleteTaskApi(id) {
  await apiDelete('/api/tasks/' + id);
}

async function deleteAllTasksByProject(projectId) {
  const tasks = await fetchTasksByProject(projectId);
  await Promise.all(tasks.map(t => apiDelete('/api/tasks/' + (t._id || t.id))));
}

// ==================== 施工日志 (Logs) ====================

async function fetchLogsByProject(projectId) {
  return await apiGet('/api/logs/project/' + projectId);
}

async function fetchLogById(id) {
  return await apiGet('/api/logs/' + id);
}

async function createLog(data) {
  const id = genId();
  const resp = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, id })
  });
  const json = await resp.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return { ...json.data, isUpdate: json.isUpdate };
}

// API 层函数加 Api 后缀避免冲突
async function updateLogApi(id, data) {
  await apiPut('/api/logs/' + id, data);
}

async function deleteLogApi(id) {
  await apiDelete('/api/logs/' + id);
}

async function deleteAllLogsByProject(projectId) {
  const logs = await fetchLogsByProject(projectId);
  await Promise.all(logs.map(l => apiDelete('/api/logs/' + (l._id || l.id))));
}

// ==================== 每日施工日志 (Daily Task Logs) ====================

async function fetchDailyTaskLogsByProject(projectId) {
  return await apiGet('/api/daily-task-logs/project/' + projectId);
}

async function fetchDailyTaskLogsByTask(taskId) {
  return await apiGet('/api/daily-task-logs/task/' + taskId);
}

async function saveDailyTaskLog(data) {
  const id = data.id || genId();
  const result = await apiPost('/api/daily-task-logs', { ...data, id });
  return result;
}

async function deleteDailyTaskLog(id) {
  await apiDelete('/api/daily-task-logs/' + id);
}

// ==================== 导出/导入 ====================

async function exportDatabase() {
  try {
    const data = await apiGet('/api/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '施工日志数据备份_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON 数据已导出！');
  } catch(e) {
    showToast('导出失败：' + e.message, 'error');
  }
}

function exportDatabaseExcel() {
  const a = document.createElement('a');
  a.href = '/api/export/excel';
  a.download = '';
  a.click();
  showToast('正在下载全库数据 Excel…', 'info');
}

async function importDatabasePrompt() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('导入数据将覆盖当前所有数据，确定继续吗？')) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const resp = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || '导入失败');
      showToast('数据已成功导入！');
      location.reload();
    } catch(err) {
      showToast('导入失败：' + err.message, 'error');
    }
  };
  input.click();
}

// ==================== 班组/材料/设备 API ====================

async function fetchTeams() {
  if (!activeProjectId) return [];
  const resp = await fetch(`/api/personnel/teams/project/${activeProjectId}`);
  const json = await resp.json();
  return json.data || [];
}

async function fetchMaterials() {
  if (!activeProjectId) return [];
  const resp = await fetch(`/api/personnel/materials/project/${activeProjectId}`);
  const json = await resp.json();
  return json.data || [];
}

async function fetchEquipments() {
  if (!activeProjectId) return [];
  const resp = await fetch(`/api/personnel/equipments/project/${activeProjectId}`);
  const json = await resp.json();
  return json.data || [];
}
