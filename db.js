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
      client TEXT DEFAULT '',
      address TEXT DEFAULT '',
      duration INTEGER DEFAULT 0,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // 兼容旧表：添加缺失的扩展字段
  try { rawDb.run(`ALTER TABLE projects ADD COLUMN client TEXT DEFAULT ''`); } catch(e) {}
  try { rawDb.run(`ALTER TABLE projects ADD COLUMN address TEXT DEFAULT ''`); } catch(e) {}
  try { rawDb.run(`ALTER TABLE projects ADD COLUMN duration INTEGER DEFAULT 0`); } catch(e) {}
  try { rawDb.run(`ALTER TABLE projects ADD COLUMN start_date TEXT DEFAULT ''`); } catch(e) {}
  try { rawDb.run(`ALTER TABLE projects ADD COLUMN end_date TEXT DEFAULT ''`); } catch(e) {}

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
      workers INTEGER DEFAULT 0,
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
      materials TEXT DEFAULT '',
      equipments TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // 为已存在的表添加新列（如果不存在）
  try { rawDb.run(`ALTER TABLE logs ADD COLUMN materials TEXT DEFAULT ''`); } catch(e) {}
  try { rawDb.run(`ALTER TABLE logs ADD COLUMN equipments TEXT DEFAULT ''`); } catch(e) {}

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
      weather TEXT DEFAULT '',
      team TEXT DEFAULT '',
      worker_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_daily_task_logs_project ON daily_task_logs(project_id)');
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_daily_task_logs_task ON daily_task_logs(task_id)');
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_daily_task_logs_date ON daily_task_logs(log_date)');

  // 施工班组表
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      leader TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      specialty TEXT DEFAULT '',
      worker_count INTEGER DEFAULT 0,
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_teams_project ON teams(project_id)');

  // 迁移：为旧teams表添加worker_count字段（如果不存在）
  try { rawDb.run('ALTER TABLE teams ADD COLUMN worker_count INTEGER DEFAULT 0'); } catch(e) {}

  // 材料管理表
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      spec TEXT DEFAULT '',
      unit TEXT DEFAULT '',
      quantity REAL DEFAULT 0,
      supplier TEXT DEFAULT '',
      status TEXT DEFAULT 'in_stock',
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id)');

  // 设备管理表
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS equipments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      model TEXT DEFAULT '',
      count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'normal',
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_equipments_project ON equipments(project_id)');

  // 收方计量表
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS acceptances (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      location TEXT DEFAULT '',
      unit TEXT DEFAULT '',
      basis TEXT DEFAULT '',
      design_qty REAL DEFAULT 0,
      actual_qty REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      calc_formula TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      date TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_acceptances_project ON acceptances(project_id)');
  // 迁移：为旧acceptances表添加basis、calc_formula字段（如果不存在）
  try { rawDb.run("ALTER TABLE acceptances ADD COLUMN basis TEXT DEFAULT ''"); } catch(e) {}
  try { rawDb.run("ALTER TABLE acceptances ADD COLUMN calc_formula TEXT DEFAULT ''"); } catch(e) {}

  // 施工人员表（保留空表兼容，不再使用）
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      team_id TEXT DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      role TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      id_card TEXT DEFAULT '',
      entry_date TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // 迁移：为新字段添加列（如果不存在）
  try { rawDb.run('ALTER TABLE daily_task_logs ADD COLUMN weather TEXT DEFAULT \'\''); } catch(e) {}
  try { rawDb.run('ALTER TABLE daily_task_logs ADD COLUMN team TEXT DEFAULT \'\''); } catch(e) {}
  try { rawDb.run('ALTER TABLE daily_task_logs ADD COLUMN worker_count INTEGER DEFAULT 0'); } catch(e) {}
  try { rawDb.run('ALTER TABLE daily_task_logs ADD COLUMN materials TEXT DEFAULT \'\''); } catch(e) {}
  try { rawDb.run('ALTER TABLE daily_task_logs ADD COLUMN equipments TEXT DEFAULT \'\''); } catch(e) {}
  try { rawDb.run('ALTER TABLE tasks ADD COLUMN workers INTEGER DEFAULT 0'); } catch(e) {}

  // 返工相关字段
  try { rawDb.run("ALTER TABLE tasks ADD COLUMN is_rework INTEGER DEFAULT 0"); } catch(e) {}
  try { rawDb.run("ALTER TABLE tasks ADD COLUMN rework_reason TEXT DEFAULT ''"); } catch(e) {}
  try { rawDb.run("ALTER TABLE tasks ADD COLUMN rework_source_task_id TEXT DEFAULT ''"); } catch(e) {}
  try { rawDb.run("ALTER TABLE tasks ADD COLUMN demolish_qty REAL DEFAULT 0"); } catch(e) {}
  try { rawDb.run("ALTER TABLE tasks ADD COLUMN demolish_unit TEXT DEFAULT ''"); } catch(e) {}
  try { rawDb.run("ALTER TABLE tasks ADD COLUMN rebuild_desc TEXT DEFAULT ''"); } catch(e) {}

  // 收方表关联返工任务
  try { rawDb.run("ALTER TABLE acceptances ADD COLUMN rework_task_id TEXT DEFAULT ''"); } catch(e) {}
  try { rawDb.run("ALTER TABLE acceptances ADD COLUMN quantity_type TEXT DEFAULT ''"); } catch(e) {}
  // 收方表泛化关联任务（支持正常任务和返工任务）
  try { rawDb.run("ALTER TABLE acceptances ADD COLUMN task_id TEXT DEFAULT ''"); } catch(e) {}
  // 收方表增加类型字段：normal(正常收方) / rework(返工收方)
  try { rawDb.run("ALTER TABLE acceptances ADD COLUMN acceptance_type TEXT DEFAULT 'normal'"); } catch(e) {}

  // 任务表增加验收状态字段
  try { rawDb.run("ALTER TABLE tasks ADD COLUMN inspection_status TEXT DEFAULT 'pending'"); } catch(e) {}

  // 施工日志表增加关联每日打卡ID字段
  try { rawDb.run("ALTER TABLE logs ADD COLUMN daily_task_log_ids TEXT DEFAULT ''"); } catch(e) {}

  // 材料表增加最低库存预警字段
  try { rawDb.run("ALTER TABLE materials ADD COLUMN min_quantity REAL DEFAULT 0"); } catch(e) {}

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
