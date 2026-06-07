# 国标装修工装施工日志系统 v2.0

基于标准表A9格式的施工日志管理系统，支持工程管理、任务计划、施工日志填写与打印。

## 功能特性

- **首页看板**：工程概览、今日待办、到期提醒、最近日志
- **新建日志**：标准表A9格式，一键智能填充（天气+施工计划），连续录入
- **日志列表**：搜索筛选（关键词+日期范围），详情查看（表格格式），打印
- **工程与数据**：工程CRUD、施工任务管理（按阶段分组/列表+甘特图双视图）

## 技术栈

- 后端：Node.js + Express
- 数据库：SQLite（better-sqlite3）
- 前端：原生 HTML/CSS/JS（单文件，零构建）

## 快速开始

```bash
npm install
npm start
```

浏览器打开 `http://localhost:3000`

## 部署教程

### 方案一：EdgeOne Pages（推荐，免费）

适合不想管理服务器的情况，但注意：EdgeOne Pages 是静态托管，需要先把后端 API 拆到云函数。**如果是纯静态部署**，请参考方案二。

### 方案二：腾讯云轻量应用服务器（推荐）

**步骤 1：购买服务器**

1. 打开 [腾讯云轻量应用服务器](https://cloud.tencent.com/product/lighthouse)
2. 选择「宝塔Linux面板」镜像（省去手动安装环境）
3. 最低配置：1核1G 即可（约40元/月）

**步骤 2：登录服务器**

```bash
# 获取服务器 IP 和密码后，用 SSH 登录
ssh root@你的服务器IP
```

**步骤 3：安装 Node.js**

```bash
# 如果用了宝塔镜像，可以在宝塔面板「软件商店」搜索安装 Node.js 版本管理器
# 也可以手动安装：
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v   # 确认版本 >= 16
```

**步骤 4：上传项目文件**

在本地项目目录执行（PowerShell）：

```powershell
# 先打包项目（排除 node_modules 和 .db 数据文件）
Compress-Archive -Path server.js,package.json,package-lock.json,db.js,routes,public -DestinationPath deploy.zip -Force

# 用 SCP 上传到服务器（替换为你的服务器IP）
scp deploy.zip root@你的服务器IP:/root/
```

在服务器上解压：

```bash
cd /root
mkdir construction-log && cd construction-log
unzip ../deploy.zip
```

**步骤 5：安装依赖并启动**

```bash
cd /root/construction-log
npm install --production
node server.js
# 看到 "Server running on port 3000" 说明成功
```

**步骤 6：使用 PM2 守护进程**

```bash
npm install -g pm2
pm2 start server.js --name "construction-log"
pm2 save
pm2 startup   # 设置开机自启，按提示执行输出的命令
```

**步骤 7：配置 Nginx 反向代理（可选）**

如果装了宝塔面板，在面板里添加网站，设置反向代理：

- 目标URL：`http://127.0.0.1:3000`
- 发送域名：`$host`

或者手动配置 Nginx：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**步骤 8：开放防火墙端口**

```bash
# 腾讯云控制台 → 轻量应用服务器 → 防火墙 → 添加规则
# 开放端口：80（HTTP）和 3000（如果不用Nginx）
```

完成后，浏览器访问 `http://你的服务器IP` 即可使用。

### 方案三：Cloud Studio 快速部署

1. 点击 IDE 顶部 **Integration** 菜单
2. 选择 **Cloud Studio**，授权登录
3. 按照指引完成部署，几分钟即可上线

---

## 日常维护

```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart construction-log

# 查看日志
pm2 logs construction-log

# 备份数据库（重要！）
cp /root/construction-log/data.db /root/backup/data_$(date +%Y%m%d).db
```

建议设置定时备份：
```bash
# 编辑 crontab
crontab -e
# 添加一行：每天凌晨2点备份数据库
0 2 * * * cp /root/construction-log/data.db /root/backup/data_$(date +\%Y\%m\%d).db
```

## 目录结构

```
├── server.js          # Express 服务入口
├── db.js              # SQLite 数据库初始化
├── package.json
├── start.bat          # Windows 本地启动脚本
├── routes/
│   ├── projects.js    # 工程 API
│   ├── tasks.js       # 任务 API
│   └── logs.js        # 日志 API
└── public/
    └── index.html     # 前端 SPA（单文件）
```

## 数据存储

- 数据文件：`data.db`（SQLite 数据库，部署后首次运行自动创建）
- 草稿数据：浏览器 localStorage
- 备份：直接复制 `data.db` 文件即可
