const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

let db = null;   // 对外暴露的 wrapper（getDb() 返回值）
let rawDb = null; // 原始 sql.js Database 实例

function getDb() {
  if (db) return db;
  throw new Error('数据库未初始化，请先调用 initDb()');
}

// 保存数据库到文件
function saveDb() {
  if (!rawDb) return;
  const data = rawDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function initDb() {
  const SQL = await initSqlJs();

  // 尝试从文件加载
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }

  rawDb.run('PRAGMA foreign_keys = ON');

  // 建表
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'custom',
      company TEXT DEFAULT '',
      manager TEXT DEFAULT '',
      recorder TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      location TEXT DEFAULT '',
      start TEXT DEFAULT '',
      end TEXT DEFAULT '',
      team TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      description TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT DEFAULT '',
      unit TEXT DEFAULT '',
      date TEXT DEFAULT '',
      weather TEXT DEFAULT '',
      temp_high TEXT DEFAULT '',
      temp_low TEXT DEFAULT '',
      wind TEXT DEFAULT '',
      location TEXT DEFAULT '',
      incident TEXT DEFAULT '',
      production_record TEXT DEFAULT '',
      tech_quality_safety TEXT DEFAULT '',
      manager TEXT DEFAULT '',
      recorder TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  rawDb.run(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
  rawDb.run(`CREATE INDEX IF NOT EXISTS idx_logs_project ON logs(project_id)`);
  rawDb.run(`CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date)`);

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS daily_task_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      log_date TEXT DEFAULT '',
      content TEXT DEFAULT '',
      worker_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_daily_task_logs_project ON daily_task_logs(project_id)');
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_daily_task_logs_task ON daily_task_logs(task_id)');
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_daily_task_logs_date ON daily_task_logs(log_date)');

  saveDb();

  // 包装数据库方法，使其兼容 better-sqlite3 风格 API
  const wrapper = {
    prepare(sql) {
      return {
        all(...params) {
          const stmt = rawDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        get(...params) {
          const stmt = rawDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          let row = null;
          if (stmt.step()) row = stmt.getAsObject();
          stmt.free();
          return row;
        },
        run(...params) {
          if (params.length > 0) {
            rawDb.run(sql, params);
          } else {
            rawDb.run(sql);
          }
          saveDb();
          return { changes: rawDb.getRowsModified() };
        }
      };
    },
    exec(sql) {
      rawDb.run(sql);
      saveDb();
    }
  };

  // 将 wrapper 赋值给全局 db，让 getDb() 返回 wrapper
  db = wrapper;
  return wrapper;
}

// 程序退出时保存
process.on('exit', () => saveDb());
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

module.exports = { initDb, getDb, saveDb };
