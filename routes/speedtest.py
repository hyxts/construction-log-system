# -*- coding: utf-8 -*-
"""
网速测试路由
无数据库依赖，纯工具模块
"""
import os
import time
from flask import Blueprint, jsonify, request, Response

bp = Blueprint('speedtest', __name__)

# 预生成 64KB 随机数据缓冲区（避免每次请求实时生成）
_BUFFER = os.urandom(65536)


@bp.route('/api/speedtest/ping')
def ping():
    """延迟测试：返回极小的 JSON 响应"""
    return jsonify({'success': True, 'time': time.time()})


@bp.route('/api/speedtest/download')
def download():
    """下载速度测试：返回指定大小的二进制数据流"""
    try:
        size = request.args.get('size', 1048576, type=int)
        size = max(1024, min(size, 50 * 1024 * 1024))  # 限制 1KB ~ 50MB

        def generate():
            remaining = size
            while remaining > 0:
                chunk = _BUFFER[:min(len(_BUFFER), remaining)]
                yield chunk
                remaining -= len(chunk)

        return Response(
            generate(),
            content_type='application/octet-stream',
            headers={
                'Content-Length': str(size),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
            }
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/speedtest/upload', methods=['POST'])
def upload():
    """上传速度测试：接收任意二进制数据并返回接收大小"""
    try:
        data = request.get_data()
        return jsonify({'success': True, 'size': len(data)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def init_db():
    """网速测试无需数据库，空实现以兼容模块加载体系"""
    pass
