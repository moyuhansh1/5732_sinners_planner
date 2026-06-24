"""配队路由 —— 根据BOX和模板自动匹配三队阵容"""
from fastapi import APIRouter, HTTPException, Request

from models.roster import RosterRequest
from models.team import TeamBuildResponse
from core.team_builder import TeamBuilder

router = APIRouter(prefix="/api", tags=["配队"])


@router.post("/team/build", response_model=TeamBuildResponse)
async def build_team(request: Request, body: RosterRequest):
    """根据BOX和培养目标生成三队阵容"""
    try:
        data = request.app.state.data
        builder = TeamBuilder()

        roster_dicts = [item.model_dump() for item in body.roster]
        result = builder.build(
            roster=roster_dicts,
            templates=data["templates"],
            sinners_dict=data["sinners_dict"],
            target_level=body.target_level,
        )

        return {
            "success": True,
            "data": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配队失败: {str(e)}")
