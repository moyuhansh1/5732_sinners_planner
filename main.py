"""《无期迷途》配队养成规划器 —— FastAPI应用入口"""
import sys
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from core.data_loader import DataLoader
from routers import roster, sinners, team, plan


def _get_base_dir() -> Path:
    """开发时返回项目根目录，PyInstaller冻结时返回临时解压目录"""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时加载静态数据到 app.state"""
    print("[启动] 正在加载数据文件...")
    data_dir = _get_base_dir() / "data"
    loader = DataLoader(str(data_dir))
    app.state.data = loader.load_all()
    sinner_count = len(app.state.data.get("sinners_dict", {}))
    template_count = len(app.state.data.get("templates", []))
    print(f"[启动] 已加载 {sinner_count} 个禁闭者, {template_count} 个配队模板")
    yield
    print("[关闭] 应用已停止")


app = FastAPI(
    title="无期迷途配队规划器",
    description="智能配队 + 培养规划一站式工具",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理：返回结构化JSON而非原始traceback"""
    print(f"[ERROR] {request.method} {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "服务器内部错误，请稍后重试",
            "detail": str(exc),
        },
    )


# CORS（开发环境）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册API路由
app.include_router(roster.router)
app.include_router(sinners.router)
app.include_router(team.router)
app.include_router(plan.router)

# 挂载静态文件（前端页面），必须在路由之后
static_dir = _get_base_dir() / "static"
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
