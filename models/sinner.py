from typing import Optional
from pydantic import BaseModel, Field


class BuildTarget(BaseModel):
    """培养目标：等阶、等级、技能等级"""
    phase: int = Field(ge=0, le=3, description="目标等阶")
    level: int = Field(ge=1, le=90, description="目标等级")
    skills: list[int] = Field(min_length=4, max_length=4, description="4个技能目标等级")


class BuildPriority(BaseModel):
    """培养优先级配置（已废弃，保留模型定义以兼容旧数据）"""
    skill_order: list[int] = Field(min_length=4, max_length=4, description="技能升级优先级顺序")
    min_target: BuildTarget = Field(description="最低培养目标")
    optimal_target: BuildTarget = Field(description="最优培养目标")


class SinnerInfo(BaseModel):
    """禁闭者基本信息（匹配 sinners.json 结构）"""
    id: str = Field(description="唯一标识，如 sinner_001")
    name: str = Field(description="角色名称")
    rarity: str = Field(description="稀有度：狂/危/普")
    role: str = Field(description="职业：狂暴/精准/异能/启迪/诡秘/坚韧")
    damage_type: str = Field(description="伤害类型：物理/法术/无")
    tags: list[str] = Field(description="能力标签")
    breaker_count: int = Field(ge=0, description="破核数")
    max_phase: int = Field(default=3, description="最高等阶")
    max_level_per_phase: dict[str, int] = Field(description="每阶最高等级")
    build_priority: Optional[BuildPriority] = Field(default=None, description="培养优先级配置（已废弃）")


class SinnerDetail(BaseModel):
    """禁闭者图鉴响应"""
    sinners: list[SinnerInfo]
    total: int
