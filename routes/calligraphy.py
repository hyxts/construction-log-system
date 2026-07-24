# -*- coding: utf-8 -*-
"""
字帖设计模块（纯前端生成，后端仅提供页面）
"""
from flask import Blueprint

bp = Blueprint('calligraphy', __name__)


@bp.route('/calligraphy')
@bp.route('/calligraphy/')
def calligraphy_index():
    from flask import send_from_directory
    return send_from_directory('字帖', 'index.html')
