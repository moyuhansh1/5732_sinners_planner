from pydantic import BaseModel, Field, field_validator


class BuildTargetInfo(BaseModel):
    """培养目标信息"""
    phase: int = Field(description="目标等阶")
    level: int = Field(description="目标等级")
    skills: list[int] = Field(description="4个技能目标等级")


class TeamSlotResult(BaseModel):
    """单个队伍槽位的配队结果"""
    label: str = Field(description="槽位标签：主C/副C/破核/增伤/灵活/治疗")
    role_type: str = Field(description="槽位类型：main_dps/sub_dps/breaker/buffer/flex/healer")
    required: bool = Field(description="是否必须填满")
    # 角色信息（空缺时为 None）
    sinner_id: str | None = Field(default=None, description="分配到该位置的角色ID")
    sinner_name: str | None = Field(default=None, description="角色名称")
    rarity: str | None = Field(default=None, description="稀有度")
    role: str | None = Field(default=None, description="职业")
    damage_type: str | None = Field(default=None, description="伤害类型")
    breaker_count: int = Field(default=0, description="破核数")
    not_owned: bool = Field(default=False, description="用户未拥有该必选角色")
    build_target: BuildTargetInfo | None = Field(default=None, description="培养目标")


class TeamResult(BaseModel):
    """单队配队结果"""
    team_name: str = Field(description="队伍名称：物理队/法术队/功能队")
    target_boss: str = Field(description="适用Boss类型")
    description: str = Field(description="队伍说明")
    slots: list[TeamSlotResult] = Field(description="6个槽位配队结果")
    total_breaker: int = Field(default=0, description="队伍总破核数")
    recommended_breaker: int = Field(default=0, description="推荐破核数")


class TeamBuildResponse(BaseModel):
    """配队接口响应"""
    success: bool = Field(default=True)
    data: dict = Field(description="包含 teams 和 unassigned")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "teams": [],
                    "unassigned": []
                }
            }
        }
