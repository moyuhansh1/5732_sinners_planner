"""禁闭者图鉴路由"""
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api", tags=["禁闭者图鉴"])


@router.get("/sinners")
async def get_sinners(request: Request):
    """获取所有禁闭者图鉴（从 app.state 读取静态数据）"""
    try:
        data = request.app.state.data
        sinners_list = data.get("sinners", [])
        return {
            "success": True,
            "data": {
                "sinners": sinners_list,
                "total": len(sinners_list),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取图鉴失败: {str(e)}")
