"""BOX管理路由 —— 读写 data/my_roster.json"""
import json
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException

from models.roster import RosterItem

router = APIRouter(prefix="/api", tags=["BOX管理"])


def _get_roster_path() -> Path:
    """获取 my_roster.json 路径（exe 模式下放在 exe 同级目录）"""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent / "my_roster.json"
    return Path("data/my_roster.json")


ROSTER_FILE = _get_roster_path()

# 等阶-等级约束
PHASE_MAX_LEVEL = {0: 20, 1: 40, 2: 70, 3: 90}
PHASE_MIN_LEVEL = {0: 1, 1: 21, 2: 41, 3: 71}
DEFAULT_TARGET = {"target_phase": 3, "target_level": 90, "target_skills": [7, 7, 7, 7]}


def _validate_phase_level(phase: int, level: int, label: str = "等级"):
    """校验等阶-等级约束，不满足则抛出 400"""
    max_lv = PHASE_MAX_LEVEL.get(phase, 90)
    min_lv = PHASE_MIN_LEVEL.get(phase, 1)
    if level < min_lv or level > max_lv:
        raise HTTPException(
            status_code=400,
            detail=f"{label} {level} 超出等阶 {phase} 的范围（{min_lv}-{max_lv}）"
        )


def _normalize_roster_item(item: dict) -> dict:
    """为旧数据（无 target 字段）补默认值"""
    for key, default in DEFAULT_TARGET.items():
        if key not in item:
            item[key] = default
    return item


def read_roster() -> dict:
    """读取 my_roster.json，不存在则返回空BOX"""
    if not ROSTER_FILE.exists():
        return {"roster": []}
    try:
        with open(ROSTER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="BOX数据文件损坏，请检查 data/my_roster.json")


def write_roster(data: dict):
    """写入 my_roster.json"""
    ROSTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ROSTER_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/roster")
async def get_roster():
    """获取当前BOX（对旧数据补默认 target 字段）"""
    try:
        data = read_roster()
        for item in data.get("roster", []):
            _normalize_roster_item(item)
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取BOX失败: {str(e)}")


@router.post("/roster/add")
async def add_to_roster(item: RosterItem):
    """添加角色到BOX（检查重复，校验等阶-等级约束）"""
    try:
        # 校验等阶-等级约束
        _validate_phase_level(item.current_phase, item.current_level, "当前等级")
        _validate_phase_level(item.target_phase, item.target_level, "目标等级")

        data = read_roster()
        for existing in data["roster"]:
            if existing["sinner_id"] == item.sinner_id:
                raise HTTPException(status_code=400, detail="该角色已在BOX中")
        data["roster"].append(item.model_dump())
        write_roster(data)
        return {"success": True, "message": f"已添加 {item.sinner_id}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加失败: {str(e)}")


@router.put("/roster/update")
async def update_roster(item: RosterItem):
    """更新BOX中角色练度"""
    try:
        # 校验等阶-等级约束
        _validate_phase_level(item.current_phase, item.current_level, "当前等级")
        _validate_phase_level(item.target_phase, item.target_level, "目标等级")

        data = read_roster()
        for i, existing in enumerate(data["roster"]):
            if existing["sinner_id"] == item.sinner_id:
                data["roster"][i] = item.model_dump()
                write_roster(data)
                return {"success": True, "message": "已更新"}
        raise HTTPException(status_code=404, detail="该角色不在BOX中")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/roster/remove")
async def remove_from_roster(sinner_id: str):
    """从BOX中删除角色"""
    try:
        data = read_roster()
        original_len = len(data["roster"])
        data["roster"] = [r for r in data["roster"] if r["sinner_id"] != sinner_id]
        if len(data["roster"]) == original_len:
            raise HTTPException(status_code=404, detail="该角色不在BOX中")
        write_roster(data)
        return {"success": True, "message": "已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.delete("/roster/clear")
async def clear_roster():
    """清空BOX"""
    try:
        write_roster({"roster": []})
        return {"success": True, "message": "已清空"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")
