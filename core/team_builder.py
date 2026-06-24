"""配队引擎 —— 按角色名精确匹配，每套模板必选 + N选M"""
from models.team import TeamSlotResult, TeamResult, BuildTargetInfo


class TeamBuilder:
    """根据模板和用户BOX自动配队（按角色名匹配）"""

    def build(
        self,
        roster: list,
        templates: list,
        sinners_dict: dict,
        target_level: str = "optimal",
    ) -> dict:
        """
        核心配队方法

        Args:
            roster: 用户BOX列表 [{"sinner_id":..., "current_phase":..., ...}, ...]
            templates: 配队模板列表（每套含 required/optional_pool/optional_count）
            sinners_dict: 禁闭者信息字典 {id: info}
            target_level: 保留参数，兼容旧接口

        Returns:
            {"teams": [...], "unassigned": [...]}
        """
        # 构建可分配角色池（含练度信息）
        available = []
        for item in roster:
            sid = item["sinner_id"]
            if sid not in sinners_dict:
                continue
            sinner = sinners_dict[sid]
            available.append({
                "sinner_id": sid,
                "name": sinner["name"],
                "rarity": sinner["rarity"],
                "role": sinner["role"],
                "damage_type": sinner["damage_type"],
                "tags": sinner.get("tags", []),
                "breaker_count": sinner.get("breaker_count", 0),
                "current_phase": item["current_phase"],
                "current_level": item["current_level"],
                "current_skills": item["current_skills"],
                "target_phase": item.get("target_phase", 3),
                "target_level": item.get("target_level", 90),
                "target_skills": item.get("target_skills", [10, 10, 10, 10]),
            })

        # name → sinner_id 反向索引（用于模板中的角色名查找）
        name_to_sinner = {}
        for sid, sinner in sinners_dict.items():
            name_to_sinner[sinner["name"]] = sid

        # id → available_char 快速查找
        avail_by_id = {c["sinner_id"]: c for c in available}

        # 收集所有模板中引用的角色 ID
        all_template_ids = set()

        teams = []
        for template in templates:
            slots_result = []
            template_ids = set()

            # 收集本模板所有角色 ID
            for name in template["required"]:
                sid = name_to_sinner.get(name)
                if sid:
                    template_ids.add(sid)
                    all_template_ids.add(sid)

            for name in template.get("optional_pool", []):
                sid = name_to_sinner.get(name)
                if sid:
                    template_ids.add(sid)
                    all_template_ids.add(sid)

            # --- 必选角色 ---
            required_ids_in_template = set()
            for name in template["required"]:
                sid = name_to_sinner.get(name)
                char = avail_by_id.get(sid) if sid else None
                if char:
                    required_ids_in_template.add(sid)
                    build_target = self._get_build_target(char)
                    slots_result.append(TeamSlotResult(
                        label=f"必选: {name}",
                        role_type="required",
                        required=True,
                        sinner_id=char["sinner_id"],
                        sinner_name=char["name"],
                        rarity=char["rarity"],
                        role=char["role"],
                        damage_type=char["damage_type"],
                        breaker_count=char["breaker_count"],
                        build_target=build_target,
                    ))
                else:
                    slots_result.append(TeamSlotResult(
                        label=f"必选: {name}",
                        role_type="required",
                        required=True,
                        not_owned=True,
                    ))

            # --- 可选角色 ---
            optional_chars = []
            for name in template.get("optional_pool", []):
                sid = name_to_sinner.get(name)
                if sid and sid in required_ids_in_template:
                    continue  # 已在必选中，跳过
                char = avail_by_id.get(sid) if sid else None
                if char:
                    optional_chars.append(char)

            # 按当前练度降序排列
            optional_chars.sort(
                key=lambda c: c["current_phase"] * 2 + c["current_level"] // 10,
                reverse=True,
            )

            # 取前 optional_count 个
            optional_count = template.get("optional_count", 0)
            picked = optional_chars[:optional_count]

            for char in picked:
                build_target = self._get_build_target(char)
                slots_result.append(TeamSlotResult(
                    label=f"可选: {char['name']}",
                    role_type="optional",
                    required=False,
                    sinner_id=char["sinner_id"],
                    sinner_name=char["name"],
                    rarity=char["rarity"],
                    role=char["role"],
                    damage_type=char["damage_type"],
                    breaker_count=char["breaker_count"],
                    build_target=build_target,
                ))

            # 可选不足则留空
            empty_needed = optional_count - len(picked)
            for _ in range(empty_needed):
                slots_result.append(TeamSlotResult(
                    label="可选: (空缺)",
                    role_type="optional",
                    required=False,
                ))

            teams.append(TeamResult(
                team_name=template["name"],
                target_boss="",
                description=template.get("description", ""),
                slots=slots_result,
                total_breaker=0,
                recommended_breaker=0,
            ))

        # 按拥有角色数量降序排列（拥有越多越靠前）
        teams.sort(
            key=lambda t: sum(1 for s in t.slots if s.sinner_id is not None),
            reverse=True,
        )

        # 未分配角色：候选池中未被任何模板引用的角色
        unassigned = [
            char for char in available
            if char["sinner_id"] not in all_template_ids
        ]

        return {
            "teams": [t.model_dump() for t in teams],
            "unassigned": unassigned,
        }

    def _get_build_target(self, char: dict, target_level: str = None) -> BuildTargetInfo:
        """获取角色的培养目标（直接从 roster 的 target_* 字段读取）"""
        return BuildTargetInfo(
            phase=char.get("target_phase", 3),
            level=char.get("target_level", 90),
            skills=char.get("target_skills", [10, 10, 10, 10]),
        )
