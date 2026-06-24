"""培养规划路由 —— 一键配队 + 材料缺口 + 独立养成计算"""
from fastapi import APIRouter, HTTPException, Request

from models.roster import RosterRequest
from models.plan import PlanResponse, RecalculateRequest, TotalMaterialItem
from core.team_builder import TeamBuilder
from core.calculator import MaterialCalculator

router = APIRouter(prefix="/api", tags=["培养规划"])

# 等阶-等级约束（与 roster.py 保持一致）
PHASE_MAX_LEVEL = {0: 20, 1: 40, 2: 70, 3: 90}
PHASE_MIN_LEVEL = {0: 1, 1: 21, 2: 41, 3: 71}


def _validate_phase_level(phase: int, level: int, label: str = "等级"):
    """校验等阶-等级约束"""
    max_lv = PHASE_MAX_LEVEL.get(phase, 90)
    min_lv = PHASE_MIN_LEVEL.get(phase, 1)
    if level < min_lv or level > max_lv:
        raise HTTPException(
            status_code=400,
            detail=f"{label} {level} 超出等阶 {phase} 的范围（{min_lv}-{max_lv}）"
        )


def _run_calc(teams: list, data: dict, unassigned: list = None) -> dict:
    """共享的材料计算流程"""
    if unassigned is None:
        unassigned = []

    calc = MaterialCalculator()
    mat_result = calc.calculate(
        teams=teams,
        sinners_dict=data["sinners_dict"],
        phase_cost=data["phase_cost"],
        level_cost=data["level_cost"],
        skill_cost=data["skill_cost"],
        phase_materials=data.get("phase_materials", {}),
        skill_materials=data.get("skill_materials", {}),
    )

    return {
        "success": True,
        "data": {
            "team_result": {
                "teams": teams,
                "unassigned": unassigned,
            },
            "per_sinner": mat_result["per_sinner"],
            "total_materials": [
                TotalMaterialItem(
                    material_id=mid,
                    material_name=data["materials"].get(mid, {}).get("name", mid),
                    total_needed=count,
                )
                for mid, count in mat_result["total_materials"].items()
            ],
            "qualified_count": mat_result["qualified_count"],
            "need_train_count": mat_result["need_train_count"],
        },
    }


@router.post("/plan/cultivate", response_model=PlanResponse)
async def cultivate_plan(request: Request, body: RosterRequest):
    """独立养成计算：不配队，直接根据 BOX 中每个角色的当前/目标练度计算材料缺口"""
    data = request.app.state.data
    sinners_dict = data["sinners_dict"]

    # 构造单队 wrapper：每个角色作为一个 slot
    slots = []
    for item in body.roster:
        sid = item.sinner_id
        sinner = sinners_dict.get(sid)
        if not sinner:
            continue

        # 校验等阶-等级约束
        _validate_phase_level(item.current_phase, item.current_level, f"{sinner['name']} 当前等级")
        _validate_phase_level(item.target_phase, item.target_level, f"{sinner['name']} 目标等级")

        slots.append({
            "sinner_id": sid,
            "sinner_name": sinner["name"],
            "rarity": sinner["rarity"],
            "role": sinner["role"],
            "current_phase": item.current_phase,
            "current_level": item.current_level,
            "current_skills": item.current_skills,
            "build_target": {
                "phase": item.target_phase,
                "level": item.target_level,
                "skills": item.target_skills,
            },
        })

    if not slots:
        raise HTTPException(status_code=400, detail="BOX 中没有有效的角色")

    fake_team = {
        "team_name": "手动培养",
        "target_boss": "",
        "description": "",
        "slots": slots,
        "total_breaker": 0,
        "recommended_breaker": 0,
    }

    try:
        return _run_calc([fake_team], data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"养成计算失败: {str(e)}")


@router.post("/plan/full", response_model=PlanResponse)
async def full_plan(request: Request, body: RosterRequest):
    """一键配队 + 培养规划（含材料缺口和体力优化）"""
    data = request.app.state.data

    roster_dicts = [item.model_dump() for item in body.roster]

    try:
        # Step 1: 配队
        builder = TeamBuilder()
        team_result = builder.build(
            roster=roster_dicts,
            templates=data["templates"],
            sinners_dict=data["sinners_dict"],
            target_level=body.target_level or "optimal",
        )

        # Step 2-3: 材料计算 + 体力优化
        return _run_calc(
            teams=team_result["teams"],
            data=data,
            unassigned=team_result["unassigned"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"规划失败: {str(e)}")


@router.post("/plan/recalculate", response_model=PlanResponse)
async def recalculate_plan(request: Request, body: RecalculateRequest):
    """手动调整配队后重新计算材料缺口和体力（跳过自动配队）"""
    data = request.app.state.data

    try:
        return _run_calc(
            teams=body.teams,
            data=data,
            unassigned=[],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重新计算失败: {str(e)}")
