const express = require('express');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/daily-task-logs', require('./routes/daily-task-logs'));
app.use('/api/personnel', require('./routes/personnel'));
app.use('/api/acceptances', require('./routes/acceptances'));

// 前端 SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 异步初始化数据库后启动
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`施工日志系统已启动: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
