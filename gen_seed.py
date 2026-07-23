# -*- coding: utf-8 -*-
"""生成数据库种子数据"""
import os, base64

BASE = os.path.dirname(os.path.abspath(__file__))
output = os.path.join(BASE, 'routes', 'seed_data.py')

lines = ['# -*- coding: utf-8 -*-', '# 自动生成的数据库种子数据', 'import os, base64', '']

dbs = [('倒计时/countdown.db', 'countdown'), ('绩点/gpa.db', 'gpa')]
for rel_path, label in dbs:
    path = os.path.join(BASE, rel_path)
    if not os.path.exists(path):
        print(f'WARN: {path} 不存在')
        continue
    with open(path, 'rb') as f:
        data = base64.b64encode(f.read()).decode('ascii')
    lines.append(f'SEED_{label} = {repr(data)}')
    lines.append('')

lines.append('')
lines.append('def _has_data(db_path):')
lines.append('    try:')
lines.append('        import sqlite3')
lines.append('        conn = sqlite3.connect(db_path)')
lines.append('        for t in [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'").fetchall()]:')
lines.append('            if conn.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0] > 0:')
lines.append('                conn.close()')
lines.append('                return True')
lines.append('        conn.close()')
lines.append('        return False')
lines.append('    except Exception:')
lines.append('        return False')
lines.append('')
lines.append('def restore_seed_dbs(base_dir):')
lines.append('    """恢复种子数据库到目标目录（仅当目标文件无数据时）"""')
lines.append('    seeds = {')
for rel_path, label in dbs:
    lines.append(f"        os.path.join(base_dir, '{rel_path}'): SEED_{label},")
lines.append('    }')
lines.append('    for path, data in seeds.items():')
lines.append('        if os.path.exists(path) and _has_data(path):')
lines.append('            continue  # 已有数据，不覆盖')
lines.append('        os.makedirs(os.path.dirname(path), exist_ok=True)')
lines.append('        with open(path, "wb") as f:')
lines.append('            f.write(base64.b64decode(data))')

content = '\n'.join(lines)
with open(output, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'已生成: {output} ({len(content)} chars)')
