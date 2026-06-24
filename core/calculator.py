"""材料缺口计算器 —— 根据配队结果计算升阶/升级/技能的材料需求（不含体力）"""
from models.plan import PerSinnerMaterial

# 角色职业 → 各阶源质材料 ID 映射
# t1=一阶(绿), t2=二阶(蓝), t3=三阶(紫)
ROLE_SOURCE_ESSENCE = {
    "异能": {"t1": "mat_003", "t2": "mat_002", "t3": "mat_001"},
    "启迪": {"t1": "mat_006", "t2": "mat_005", "t3": "mat_004"},
    "坚韧": {"t1": "mat_009", "t2": "mat_008", "t3": "mat_007"},
    "狂暴": {"t1": "mat_012", "t2": "mat_011", "t3": "mat_010"},
    "精准": {"t1": "mat_015", "t2": "mat_014", "t3": "mat_013"},
    "诡秘": {"t1": "mat_018", "t2": "mat_017", "t3": "mat_016"},
}

# 技能升级固定材料映射（符号键 → mat_XXX）
SKILL_FIXED_MATS = {
    "skill_module_I": "mat_067",
    "skill_module_II": "mat_068",
    "skill_module_III": "mat_069",
    "skill_module_IV": "mat_070",
    "consciousness_crystal": "mat_074",
}

# 技能升级角色专属材料键（需从 skill_materials 按角色名查找）
SKILL_CHAR_MATS = {
    "grey_material": "灰",
    "green_material": "绿",
    "blue_material": "蓝",
    "purple_material": "紫",
    "inner_sea": "内海",
}


class MaterialCalculator:
    """计算培养角色所需的材料缺口和体力"""

    def calculate(
        self,
        teams: list,
        sinners_dict: dict,
        phase_cost: dict,
        level_cost: dict,
        skill_cost: dict,
        phase_materials: dict = None,
        skill_materials: dict = None,
    ) -> dict:
        """
        Args:
            teams: 配队结果中的 teams 列表
            sinners_dict: 禁闭者信息字典
            phase_cost: 升阶消耗数据
            level_cost: 升级消耗数据
            skill_cost: 技能消耗数据
            phase_materials: 角色升阶怪物材料查找表 {char_name: {"绿":{mat_id:count}, ...}}

        Returns:
            {"per_sinner": [...], "total_materials": {...}}
        """
        # 收集所有入队角色（去重）
        seen = set()
        assigned_chars = []
        for team in teams:
            for slot in team.get("slots", []):
                sid = slot.get("sinner_id")
                if sid and sid not in seen:
                    seen.add(sid)
                    assigned_chars.append({
                        "sinner_id": sid,
                        "sinner_name": slot.get("sinner_name", ""),
                        "rarity": slot.get("rarity", "危"),
                        "role": slot.get("role", "诡秘"),
                        "current_phase": slot.get("current_phase", 0),
                        "current_level": slot.get("current_level", 1),
                        "current_skills": slot.get("current_skills", [1, 1, 1, 1]),
                        "build_target": slot.get("build_target", {}),
                    })

        # 也检查 unassigned - 但 unassigned 不需要培养
        per_sinner = []
        total_materials = {}

        for char in assigned_chars:
            bt = char["build_target"]
            if not bt:
                continue

            target_phase = bt.get("phase", 3)
            target_level = bt.get("level", 90)
            target_skills = bt.get("skills", [7, 7, 5, 5])

            cur_phase = char["current_phase"]
            cur_level = char["current_level"]
            cur_skills = char["current_skills"]
            rarity = char["rarity"]

            # 判断是否已达标
            is_qualified = self._check_qualified(
                cur_phase, cur_level, cur_skills,
                target_phase, target_level, target_skills,
            )

            if is_qualified:
                per_sinner.append(PerSinnerMaterial(
                    sinner_id=char["sinner_id"],
                    sinner_name=char["sinner_name"],
                    rarity=rarity,
                    current={
                        "phase": cur_phase, "level": cur_level, "skills": cur_skills,
                    },
                    target={
                        "phase": target_phase, "level": target_level, "skills": target_skills,
                    },
                    is_qualified=True,
                    materials_needed={},
                ))
                continue

            # 计算升阶缺口
            role = char["role"]
            sinner_name = char["sinner_name"]
            phase_gap = self._calc_phase_gap(
                cur_phase, target_phase, rarity, role, phase_cost,
                sinner_name, phase_materials,
            )

            # 计算升级缺口（使用角色自身的 max_level_per_phase）
            sinner_data = sinners_dict.get(char["sinner_id"], {})
            raw_max_lv = sinner_data.get("max_level_per_phase", {})
            per_sinner_max = {int(k): v for k, v in raw_max_lv.items()}
            if not per_sinner_max:
                per_sinner_max = {0: 20, 1: 40, 2: 70, 3: 90}

            level_gap = self._calc_level_gap(
                cur_phase, cur_level, target_phase, target_level,
                rarity, level_cost, per_sinner_max,
            )

            # 计算技能缺口
            skill_gaps = self._calc_skill_gaps(
                cur_skills, target_skills, rarity, skill_cost,
                sinner_name=char["sinner_name"],
                skill_materials=skill_materials,
            )

            # 合并所有材料
            materials = {}
            for gap in [phase_gap, level_gap]:
                for mat_id, count in gap.items():
                    materials[mat_id] = materials.get(mat_id, 0) + count

            for sg in skill_gaps:
                for mat_id, count in sg.get("materials", {}).items():
                    materials[mat_id] = materials.get(mat_id, 0) + count

            per_sinner.append(PerSinnerMaterial(
                sinner_id=char["sinner_id"],
                sinner_name=char["sinner_name"],
                rarity=rarity,
                current={
                    "phase": cur_phase, "level": cur_level, "skills": cur_skills,
                },
                target={
                    "phase": target_phase, "level": target_level, "skills": target_skills,
                },
                is_qualified=False,
                materials_needed=materials,
                phase_gap=phase_gap,
                level_gap=level_gap,
                skill_gaps=skill_gaps,
            ))

            # 汇总到总量
            for mat_id, count in materials.items():
                total_materials[mat_id] = total_materials.get(mat_id, 0) + count

        return {
            "per_sinner": [ps.model_dump() for ps in per_sinner],
            "total_materials": total_materials,
            "qualified_count": sum(1 for ps in per_sinner if ps.is_qualified),
            "need_train_count": sum(1 for ps in per_sinner if not ps.is_qualified),
        }

    def _check_qualified(
        self, cp: int, cl: int, cs: list,
        tp: int, tl: int, ts: list,
    ) -> bool:
        """判断当前练度是否已达标"""
        if cp > tp:
            return True
        if cp == tp and cl >= tl and all(
            cs[i] >= ts[i] for i in range(4)
        ):
            return True
        return False

    def _calc_phase_gap(
        self, cur_phase: int, target_phase: int, rarity: str, role: str, phase_cost: dict,
        sinner_name: str = "", phase_materials: dict = None,
    ) -> dict:
        """计算升阶材料缺口，根据角色职业匹配对应源质，根据角色名匹配怪物材料"""
        result = {}
        rarity_costs = phase_cost.get(rarity, {})
        # 阶段→怪物材料品质的映射
        phase_tier_map = {0: "绿", 1: "蓝", 2: "紫"}

        for p in range(cur_phase, target_phase):
            key = f"{p}_to_{p + 1}"
            costs = rarity_costs.get(key, {})
            monster_tier = phase_tier_map.get(p)

            for mat_key, count in costs.items():
                if mat_key.startswith("source_essence_"):
                    tier = mat_key.split("_")[-1]
                    mat_id = ROLE_SOURCE_ESSENCE.get(role, {}).get(tier)
                    if mat_id:
                        result[mat_id] = result.get(mat_id, 0) + count
                elif mat_key.startswith("monster_"):
                    # 解析怪物掉落材料：按角色名查找对应品质的材料
                    if phase_materials and sinner_name and monster_tier:
                        char_mats = phase_materials.get(sinner_name, {}).get(monster_tier, {})
                        for mat_id, mat_count in char_mats.items():
                            result[mat_id] = result.get(mat_id, 0) + mat_count
                else:
                    result[mat_key] = result.get(mat_key, 0) + count

        return result

    def _calc_level_gap(
        self,
        cur_phase: int, cur_level: int,
        target_phase: int, target_level: int,
        rarity: str, level_cost: dict,
        max_lv_per_phase: dict = None,
    ) -> dict:
        """计算升级材料缺口（经验+狄斯币）

        支持两种数据格式：
        - 逐级（狂）：key 为 "1_to_2" 格式，按绝对等级逐一累加
        - 逐阶（危/普）：key 为 phase 字符串，每级消耗恒定
        """
        rarity_costs = level_cost.get(rarity, {})
        if not rarity_costs:
            return {}

        result = {}

        # 检测数据格式：逐级（per-level）还是逐阶（per-phase）
        sample_key = next(iter(rarity_costs.keys()))
        is_per_level = "_to_" in str(sample_key)

        if is_per_level:
            # 逐级模式：cur_level 和 target_level 为绝对等级（1-90）
            for lv in range(cur_level, target_level):
                key = f"{lv}_to_{lv + 1}"
                cost = rarity_costs.get(key, {})
                if cost:
                    result["mat_exp"] = result.get("mat_exp", 0) + cost["exp"]
                    result["mat_discoin"] = result.get("mat_discoin", 0) + cost["discoin"]
        else:
            # 逐阶模式（危/普 兼容）
            if max_lv_per_phase is None:
                max_lv_per_phase = {0: 20, 1: 40, 2: 70, 3: 90}

            if cur_phase == target_phase:
                cost = rarity_costs.get(str(cur_phase), {})
                max_lv = max_lv_per_phase.get(cur_phase, 90)
                cur_capped = min(cur_level, max_lv)
                target_capped = min(target_level, max_lv)
                levels = max(0, target_capped - cur_capped)
                if cost and levels > 0:
                    result["mat_exp"] = result.get("mat_exp", 0) + cost["exp"] * levels
                    result["mat_discoin"] = result.get("mat_discoin", 0) + cost["discoin"] * levels
            else:
                for p in range(cur_phase, target_phase + 1):
                    phase_str = str(p)
                    cost = rarity_costs.get(phase_str, {})

                    if p == cur_phase:
                        max_lv = max_lv_per_phase.get(p, 90)
                        levels = max(0, max_lv - cur_level)
                    elif p == target_phase:
                        prev_max = max_lv_per_phase.get(p - 1, 0)
                        levels = max(0, target_level - prev_max)
                    else:
                        max_lv = max_lv_per_phase.get(p, 90)
                        prev_max = max_lv_per_phase.get(p - 1, 0)
                        levels = max(0, max_lv - prev_max)

                    if cost and levels > 0:
                        result["mat_exp"] = result.get("mat_exp", 0) + cost["exp"] * levels
                        result["mat_discoin"] = result.get("mat_discoin", 0) + cost["discoin"] * levels

        return result

    def _calc_skill_gaps(
        self, cur_skills: list, target_skills: list, rarity: str, skill_cost: dict,
        sinner_name: str = "", skill_materials: dict = None,
    ) -> list:
        """计算每个技能的升级材料缺口，解析符号键为具体 mat_XXX"""
        rarity_costs = skill_cost.get(rarity, {})
        char_mats = (skill_materials or {}).get(sinner_name, {})
        gaps = []

        for i in range(4):
            c_lv = cur_skills[i]
            t_lv = target_skills[i]
            if c_lv >= t_lv:
                gaps.append({
                    "skill_index": i + 1,
                    "from_level": c_lv,
                    "to_level": t_lv,
                    "levels_needed": 0,
                    "materials": {},
                })
                continue

            materials = {}
            for lv in range(c_lv, t_lv):
                key = f"{lv}_to_{lv + 1}"
                costs = rarity_costs.get(key, {})
                for mat_key, count in costs.items():
                    mat_id = self._resolve_skill_mat_key(mat_key, char_mats)
                    if mat_id:
                        materials[mat_id] = materials.get(mat_id, 0) + count

            gaps.append({
                "skill_index": i + 1,
                "from_level": c_lv,
                "to_level": t_lv,
                "levels_needed": t_lv - c_lv,
                "materials": materials,
            })

        return gaps

    def _resolve_skill_mat_key(self, mat_key: str, char_mats: dict) -> str:
        """将技能消耗中的符号键解析为具体的 mat_XXX ID"""
        # 直接 mat_ 开头的键原样返回
        if mat_key.startswith("mat_"):
            return mat_key
        # 固定映射（技能模组、意识晶核）
        if mat_key in SKILL_FIXED_MATS:
            return SKILL_FIXED_MATS[mat_key]
        # 角色专属材料（grey_material/green_material/... → 灰/绿/蓝/紫/内海）
        if mat_key in SKILL_CHAR_MATS:
            tier = SKILL_CHAR_MATS[mat_key]
            return char_mats.get(tier, None)
        # 未知键返回 None（不会计入材料）
        return None
