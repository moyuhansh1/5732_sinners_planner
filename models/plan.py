from pydantic import BaseModel, Field


class PerSinnerMaterial(BaseModel):
    """单个角色的材料缺口详情"""
    sinner_id: str = Field(description="角色ID")
    sinner_name: str = Field(description="角色名称")
    rarity: str = Field(description="稀有度")
    current: dict = Field(description="当前练度 {phase, level, skills}")
    target: dict = Field(description="目标练度 {phase, level, skills}")
    is_qualified: bool = Field(description="是否已达标")
    materials_needed: dict[str, int] = Field(description="材料缺口 {material_id: count}")
    # 详细缺口
    phase_gap: dict[str, int] = Field(default_factory=dict, description="升阶缺口")
    level_gap: dict[str, int] = Field(default_factory=dict, description="升级缺口")
    skill_gaps: list[dict] = Field(default_factory=list, description="各技能缺口详情")


class TotalMaterialItem(BaseModel):
    """单项材料汇总"""
    material_id: str = Field(description="材料ID")
    material_name: str = Field(description="材料名称")
    total_needed: int = Field(description="总需求数量")


class PlanData(BaseModel):
    """规划完整数据"""
    team_result: dict = Field(description="配队结果")
    per_sinner: list[PerSinnerMaterial] = Field(description="每个角色材料缺口")
    total_materials: list[TotalMaterialItem] = Field(description="材料缺口汇总")
    qualified_count: int = Field(default=0, description="已达标角色数")
    need_train_count: int = Field(default=0, description="需培养角色数")


class PlanResponse(BaseModel):
    """规划接口响应"""
    success: bool = Field(default=True)
    data: PlanData = Field(description="完整规划数据")


class RecalculateRequest(BaseModel):
    """手动调整后重新计算的请求体"""
    teams: list[dict] = Field(description="修改后的队伍列表")
    target_level: str = Field(default="optimal", description="培养目标：min / optimal")
