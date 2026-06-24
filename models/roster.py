from typing import Optional
from pydantic import BaseModel, Field


class RosterItem(BaseModel):
    """BOX中的单个角色（含当前练度和目标练度）"""
    sinner_id: str = Field(description="禁闭者ID")
    current_phase: int = Field(ge=0, le=3, description="当前等阶 0-3")
    current_level: int = Field(ge=1, le=90, description="当前等级 1-90")
    current_skills: list[int] = Field(min_length=4, max_length=4, description="4个技能当前等级 1-10")
    target_phase: int = Field(default=3, ge=0, le=3, description="目标等阶 0-3")
    target_level: int = Field(default=90, ge=1, le=90, description="目标等级 1-90")
    target_skills: list[int] = Field(default=[7, 7, 7, 7], min_length=4, max_length=4, description="4个技能目标等级 1-10")

    class Config:
        json_schema_extra = {
            "example": {
                "sinner_id": "sinner_001",
                "current_phase": 2,
                "current_level": 40,
                "current_skills": [5, 4, 4, 5],
                "target_phase": 3,
                "target_level": 90,
                "target_skills": [10, 7, 7, 7]
            }
        }


class RosterRequest(BaseModel):
    """配队/规划请求（包含BOX，target_level 已废弃）"""
    roster: list[RosterItem] = Field(description="当前BOX列表")
    target_level: Optional[str] = Field(default=None, description="已废弃：培养目标现由每个角色的 target_* 字段指定")

    class Config:
        json_schema_extra = {
            "example": {
                "roster": [
                    {
                        "sinner_id": "sinner_001",
                        "current_phase": 3, "current_level": 70, "current_skills": [7, 7, 5, 5],
                        "target_phase": 3, "target_level": 90, "target_skills": [10, 7, 7, 7]
                    }
                ]
            }
        }
