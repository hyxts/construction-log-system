# 施工日志系统 - PythonAnywhere 部署指南

## 项目结构
```
装修测试软件/
├── app.py              # Flask 后端（主入口，含日志系统 + 排工系统）
├── index.html           # 排工考勤系统前端页面（独立子系统）
├── requirements.txt    # Python 依赖
├── data.db             # 日志系统 SQLite 数据库（自动创建）
├── paiban.db           # 排工系统 SQLite 数据库（自动创建，与日志数据隔离）
└── public/
    └── index.html      # 日志系统前端页面
```

## 访问地址

部署成功后可访问两个独立系统：
- **日志系统**: `https://你的用户名.pythonanywhere.com/`
- **排工考勤**: `https://你的用户名.pythonanywhere.com/paiban`

两个系统数据完全隔离、互不交叉。

## 在 PythonAnywhere 上部署步骤

### 1. 注册 PythonAnywhere 账号
访问 https://www.pythonanywhere.com 注册免费账号（Beginner 账号即可）

### 2. 上传代码
**方式一：Git 上传（推荐）**
```bash
# 在 PythonAnywhere 的 Bash Console 中执行：
git clone <你的仓库地址>
```

**方式二：手动上传**
在 PythonAnywhere 的 Files 页面逐个上传文件

### 3. 创建 Web 应用
1. 进入 **Web** 标签页 → **Add a new web app**
2. 选择 **Flask** 框架
3. Python 版本选择 **Python 3.10+**
4. 路径填写项目目录（如 `/home/你的用户名/装修测试软件`）

### 4. 配置 WSGI 文件
编辑自动生成的 WSGI 文件（通常在 `/var/www/你的用户名_pythonanywhere_com_wsgi.py`），替换为：

```python
import sys
import os

# 添加项目路径
project_home = '/home/你的用户名/装修测试软件'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# 导入 Flask app
from app import app as application
```

### 5. 安装依赖
在 Bash Console 中执行：
```bash
cd ~/装修测试软件
pip3 install --user -r requirements.txt
```

### 6. 重新加载
在 Web 标签页点击绿色 **Reload** 按钮

### 7. 访问
你的应用会部署在：`https://你的用户名.pythonanywhere.com`

## 本地测试
```bash
# 安装依赖
pip install -r requirements.txt

# 运行
python app.py

# 访问 http://localhost:5000
```

## 注意事项
- **免费账号限制**：只能访问白名单内的外部 API（天气 API `wttr.in` 需要申请加入白名单）
- **数据库**：使用 SQLite，数据存储在 `data.db` 文件中
- **静态文件**：放在 `public/` 目录下，Flask 会自动托管
