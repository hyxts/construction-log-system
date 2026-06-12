/**
 * 核心模块：全局状态管理、配置常量、工具函数、导航
 * 依赖：api.js（需在此文件之前加载）
 */

// ==================== 全局状态 ====================

let activeProjectId = null;           // 当前选中工程ID
let projects = [];                    // 工程列表缓存
let dailyTaskLogs = {};               // { taskId: [{log_date, content, ...}] }
let quickMode = false;                // 快速录入模式
let continuousMode = false;           // 连续录入模式
let currentDetailLog = null;          // 当前查看的日志详情
let currentProjectView = 'gantt';     // 'gantt' | 'list'
let currentProjectSub = 'project';    // 工程子页面

// ==================== 配置常量 ====================

const GANTT_COLORS = {
  pending:     { bg: '#94a3b8', border: '#64748b', text: '#fff' },
  in_progress: { bg: '#3b82f6', border: '#1d4ed8', text: '#fff' },
  completed:   { bg: '#22c55e', border: '#16a34a', text: '#fff' },
  overdue:     { bg: '#ef4444', border: '#dc2626', text: '#fff' }
};

const CATEGORY_COLORS = {
  '拆除工程': '#f97316', '水电改造': '#06b6d4', '防水工程': '#3b82f6',
  '泥瓦工程': '#8b5cf6', '木工工程': '#d97706', '油漆工程': '#ec4899',
  '安装工程': '#10b981', '竣工验收': '#6366f1', '其他': '#94a3b8',
  '': '#94a3b8'
};

const REPORT_TABS = {
  logs: '施工日志', combined: '施工总览报表', finance: '财务汇总报表'
};

const PAGE_TITLES = {
  dashboard: '首页', project: '工程', 
  acceptance: '收方返工', finance: '财务',
  reports: '报表', settings: '设置'
};

// ==================== 日期工具 ====================

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return formatDate(new Date());
}

// ==================== HTML 转义 ====================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ==================== Toast 通知 ====================

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  const duration = (window._toastDuration != null) ? window._toastDuration : 2500;
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==================== 侧边栏导航 ====================

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('hidden', !isOpen);
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelector('.sidebar-overlay').classList.add('hidden');
}

// ==================== 页面路由 ====================

window.switchPage = async function(name) {
  if (window.innerWidth <= 768) closeSidebar();
  document.title = '施工日志 - ' + (PAGE_TITLES[name] || name);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + name);
  if (!pageEl) return;
  pageEl.classList.add('active');
  const ni = document.querySelector('[data-page="' + name + '"]');
  if (ni) ni.classList.add('active');
  // 路由到各模块加载函数
  if (name === 'dashboard') {
    await loadReworksList(); await loadDailyTaskLogs(); await renderDashboard();
  } else if (name === 'project') {
    switchProjectSub('project'); renderProjectList();
    await loadProjects(); await loadDailyTaskLogs(); await loadTasks();
  } else if (name === 'acceptance') {
    loadAcceptanceList();
    loadReworksList().then(() => { renderReworkList(); updateReworkSummary(); });
  } else if (name === 'finance') {
    loadFinanceList(); loadFinanceStats();
  } else if (name === 'reports') {
    switchReportTab('logs');
  } else if (name === 'settings') {
    loadSettings(); renderSettingsStats();
  }
};
