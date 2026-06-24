"""静态数据加载器 —— 启动时加载所有 JSON 数据文件到内存"""
import json
from pathlib import Path


class DataLoader:
    """加载并索引 data/ 目录下的静态 JSON 文件（不含 my_roster.json）"""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        if not self.data_dir.exists():
            raise FileNotFoundError(f"数据目录不存在: {self.data_dir}")

    def load_all(self) -> dict:
        """加载所有静态数据，返回字典供 app.state.data 使用"""
        result = {}

        # sinners.json: 列表转字典（key=id），保留原始列表
        sinners_data = self._load_json("sinners.json")
        sinners_list = sinners_data.get("sinners", [])
        result["sinners"] = sinners_list
        result["sinners_dict"] = self._index_list(sinners_list, "id")

        # team_templates.json: 保留列表（模板没有 id 字段）
        templates_data = self._load_json("team_templates.json")
        result["templates"] = templates_data.get("templates", [])

        # materials.json: 构建 material_id -> {name, category} 映射
        result["materials"] = self._load_materials_dict()

        # phase_cost, level_cost, skill_cost: 保持原样
        result["phase_cost"] = self._load_json("phase_cost.json")
        result["level_cost"] = self._load_json("level_cost.json")
        result["skill_cost"] = self._load_json("skill_cost.json")

        # 升阶怪物掉落材料（按角色名索引，按阶段品质分组）
        # 结构: {char_name: {"绿": {mat_id: count, ...}, "蓝": {...}, "紫": {...}}}
        mat_name_to_id = {v["name"]: k for k, v in result["materials"].items()}
        result["phase_materials"] = self._load_phase_materials(mat_name_to_id)

        # 技能升级材料（按角色名索引，按品质返回该角色使用的材料 ID）
        # 结构: {char_name: {"灰": mat_id, "绿": mat_id, "蓝": mat_id, "紫": mat_id, "内海": mat_id}}
        result["skill_materials"] = self._load_skill_materials(mat_name_to_id)

        return result

    def _index_list(self, items: list, key_field: str) -> dict:
        """将列表转换为以 key_field 为键的字典"""
        result = {}
        for item in items:
            k = item.get(key_field)
            if k:
                result[k] = item
        return result

    def _load_json(self, filename: str) -> dict | list:
        """加载单个 JSON 文件，文件缺失时抛出明确错误"""
        filepath = self.data_dir / filename
        if not filepath.exists():
            raise FileNotFoundError(f"数据文件缺失: {filepath}")
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_materials_dict(self) -> dict:
        """加载材料定义，构建 material_id -> {name, category} 的映射"""
        raw = self._load_json("materials.json")
        lookup = {}
        for category, items in raw.get("categories", {}).items():
            for item in items:
                lookup[item["id"]] = {
                    "name": item["name"],
                    "category": category,
                }
        return lookup

    def _load_phase_materials(self, mat_name_to_id: dict) -> dict:
        """
        从 materials_use_way.json 构建角色→升阶材料的查找表。
        返回: {char_name: {"绿": {mat_id: count, ...}, "蓝": {...}, "紫": {...}}}
        每个品质包含该角色两个家族的全部材料。
        """
        raw = self._load_json("materials_use_way.json")
        # 材料家族品质链定义（紫/蓝/绿/灰）
        families = [
            ("燃念赤晶·紫", "赤晶·蓝", "红石精矿·绿"),
            ("异化尖刺骨片·紫", "感染骨片·蓝", "原生骨片·绿"),
            ("沉雾泪晶·紫", "泪晶·蓝", "泪石精矿·绿"),
            ("繁盛曲铜晶·紫", "曲铜晶·蓝", "曲铜精矿·绿"),
            ("衰变暮辉晶·紫", "暮辉晶·蓝", "暮辉石精矿·绿"),
            ("裂生冰晶锥·紫", "冰晶·蓝", "冰石精矿·绿"),
            ("异化棘状角·紫", "感染角质·蓝", "原生角质·绿"),
            ("异化暗凝胶·紫", "感染凝胶·蓝", "原生凝胶·绿"),
            ("异化拟怪腕足·紫", "感染腕足·蓝", "原生腕足·绿"),
            ("异化诡影鞘翅·紫", "感染鞘翅·蓝", "原生鞘翅·绿"),
            ("异化真红囊胞·紫", "感染囊胞·蓝", "原生囊胞·绿"),
            ("结霜毒砂晶·紫", "毒砂晶·蓝", "毒砂精矿·绿"),
        ]
        # 构建 name → (family_index, tier) 的映射
        mat_tier_map = {}
        for fi, (purple, blue, green) in enumerate(families):
            mat_tier_map[purple] = "紫"
            mat_tier_map[blue] = "蓝"
            mat_tier_map[green] = "绿"

        result = {}
        for mat_name, mat_data in raw.items():
            tier = mat_tier_map.get(mat_name)
            if tier is None:
                continue
            mat_id = mat_name_to_id.get(mat_name)
            if mat_id is None:
                continue
            for entry in mat_data.get("用途", {}).get("升阶", []):
                char_name = entry["角色"]
                count = entry["数量"]
                if char_name not in result:
                    result[char_name] = {"绿": {}, "蓝": {}, "紫": {}}
                result[char_name][tier][mat_id] = count

        return result

    def _load_skill_materials(self, mat_name_to_id: dict) -> dict:
        """
        从 materials_use_way.json 构建角色→技能升级材料的查找表。
        利用材料族系关系：同一角色技能升级使用的灰/绿/蓝/紫材料属于同一族系，
        只需在 materials_use_way.json 中有任意一个品质的条目即可推导全部四个品质。
        返回: {char_name: {"灰": mat_id, "绿": mat_id, "蓝": mat_id, "紫": mat_id, "内海": mat_id}}
        """
        raw = self._load_json("materials_use_way.json")

        # 材料族系（紫/蓝/绿/灰 四品质），与 _load_phase_materials 中三品质族系对应
        families = [
            ("燃念赤晶·紫", "赤晶·蓝", "红石精矿·绿", "红石粗矿·灰"),
            ("异化尖刺骨片·紫", "感染骨片·蓝", "原生骨片·绿", "破损骨片·灰"),
            ("沉雾泪晶·紫", "泪晶·蓝", "泪石精矿·绿", "泪石粗矿·灰"),
            ("繁盛曲铜晶·紫", "曲铜晶·蓝", "曲铜精矿·绿", "曲铜粗矿·灰"),
            ("衰变暮辉晶·紫", "暮辉晶·蓝", "暮辉石精矿·绿", "暮辉石粗矿·灰"),
            ("裂生冰晶锥·紫", "冰晶·蓝", "冰石精矿·绿", "冰石粗矿·灰"),
            ("异化棘状角·紫", "感染角质·蓝", "原生角质·绿", "断裂角质·灰"),
            ("异化暗凝胶·紫", "感染凝胶·蓝", "原生凝胶·绿", "悬浊凝胶·灰"),
            ("异化拟怪腕足·紫", "感染腕足·蓝", "原生腕足·绿", "枯萎腕足·灰"),
            ("异化诡影鞘翅·紫", "感染鞘翅·蓝", "原生鞘翅·绿", "鞘翅残片·灰"),
            ("异化真红囊胞·紫", "感染囊胞·蓝", "原生囊胞·绿", "破损囊胞·灰"),
            ("结霜毒砂晶·紫", "毒砂晶·蓝", "毒砂精矿·绿", "毒砂粗矿·灰"),
        ]
        TIERS = ["紫", "蓝", "绿", "灰"]

        # 构建 mat_name → (family_index, tier_index) 映射
        mat_family_map = {}
        for fi, fam in enumerate(families):
            for ti, name in enumerate(fam):
                mat_family_map[name] = (fi, ti)

        inner_sea_names = {"内海狂念", "内海亡骸", "内海呓语"}

        # Phase 1: 扫描"技能升级"条目，确定每个角色的族系和内海材料
        char_family = {}       # char_name → family_index
        inner_sea_result = {}  # char_name → mat_id

        for mat_name, mat_data in raw.items():
            skill_entries = mat_data.get("用途", {}).get("技能升级", [])
            if not skill_entries:
                continue

            # 内海材料单独处理
            if mat_name in inner_sea_names:
                mat_id = mat_name_to_id.get(mat_name)
                if mat_id is None:
                    mat_id = mat_name_to_id.get(mat_name + "·紫")
                if mat_id is None:
                    continue
                for entry in skill_entries:
                    inner_sea_result[entry["角色"]] = mat_id
                continue

            # 族系材料：记录角色所属族系
            fam_info = mat_family_map.get(mat_name)
            if fam_info is None:
                continue
            fi, ti = fam_info

            for entry in skill_entries:
                char_name = entry["角色"]
                if char_name not in char_family:
                    char_family[char_name] = fi

        # Phase 2: 为每个角色填充全部 4 个品质 + 内海
        result = {}
        for char_name, fi in char_family.items():
            char_mats = {}
            for ti, tier in enumerate(TIERS):
                mat_name = families[fi][ti]
                mat_id = mat_name_to_id.get(mat_name)
                if mat_id:
                    char_mats[tier] = mat_id
            if char_name in inner_sea_result:
                char_mats["内海"] = inner_sea_result[char_name]
            result[char_name] = char_mats

        # Phase 3: 仅出现在内海材料中的角色（无族系材料条目）
        for char_name, inner_id in inner_sea_result.items():
            if char_name not in result:
                result[char_name] = {"内海": inner_id}

        return result
