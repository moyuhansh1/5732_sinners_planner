# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 打包配置 —— 生成 siner_planner.exe"""

a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[
        ('D:/Anaconda/envs/pytorch_2.51/Library/bin/libexpat.dll', '.'),
    ],
    datas=[
        # 静态前端文件
        ('static', 'static'),
        # 只读数据文件（排除 my_roster.json，它是用户运行时数据）
        ('data/sinners.json', 'data'),
        ('data/materials.json', 'data'),
        ('data/materials_use_way.json', 'data'),
        ('data/phase_cost.json', 'data'),
        ('data/level_cost.json', 'data'),
        ('data/skill_cost.json', 'data'),
        ('data/team_templates.json', 'data'),
    ],
    hiddenimports=[
        'fastapi',
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'starlette',
        'pydantic',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='siner_planner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
