# -*- coding: utf-8 -*-
"""共享工具函数：时区、时间、日志、数据库连接、密码编码、CSRF提取等"""
import os, re, sqlite3, base64, hashlib
from datetime import datetime, timedelta, timezone

TZ = timezone(timedelta(hours=8))  # 北京时间 UTC+8

# 中文/英文目录映射
FOLDER_MAP = {
    'countdown': '倒计时', 'gpa': '绩点', 'hsgrades': '成绩',
    'paiban': '排班', 'pa': '服务器', 'renqing': '人情', 'deploy': '部署',
    'accounting': '记账',
}


def _now():
    return datetime.now(TZ)


def _size_str(b):
    """字节数转可读字符串"""
    if b < 1024:
        return f'{b}B'
    if b < 1048576:
        return f'{b/1024:.1f}KB'
    return f'{b/1048576:.1f}MB'


def make_logger(log_file):
    """返回一个绑定到指定日志文件的日志函数"""
    def _log(msg):
        ts = _now().strftime('%Y-%m-%d %H:%M:%S')
        try:
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f'[{ts}] {msg}\n')
        except Exception:
            pass
    return _log


def make_db(db_file):
    """返回一个绑定到指定数据库文件的连接工厂"""
    def _get_db():
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA busy_timeout=5000")
        return conn
    return _get_db


def db_has_data(db_path):
    """检查 SQLite 数据库是否有实际数据"""
    try:
        conn = sqlite3.connect(db_path)
        tables = [t[0] for t in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()]
        for t in tables:
            if conn.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0] > 0:
                conn.close()
                return True
        conn.close()
        return False
    except Exception:
        return False


def extract_csrf(html_text):
    """从PA页面提取CSRF token: 优先 hidden input，其次 script 变量"""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_text, 'html.parser')
        inp = soup.find('input', {'name': 'csrfmiddlewaretoken'})
        if inp:
            return inp.get('value', '')
        for script in soup.find_all('script'):
            if script.string:
                m = re.search(r'Anywhere\.csrfToken\s*=\s*"([^"]+)"', script.string)
                if m:
                    return m.group(1)
    except Exception:
        pass
    return None


def encode_pw(plain, salt_path):
    """简单混淆编码密码，防数据库泄露时明文暴露"""
    if not plain:
        return ''
    key = hashlib.sha256(salt_path.encode()).digest()[:16]
    data = plain.encode('utf-8')
    encoded = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    return base64.b64encode(encoded).decode('ascii')


def decode_pw(encoded, salt_path):
    """简单混淆解码密码"""
    if not encoded:
        return ''
    try:
        data = base64.b64decode(encoded)
        key = hashlib.sha256(salt_path.encode()).digest()[:16]
        return bytes(b ^ key[i % len(key)] for i, b in enumerate(data)).decode('utf-8')
    except Exception:
        return ''
