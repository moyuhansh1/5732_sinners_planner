# 无期迷途 · 配队养成规划器

为《无期迷途》构建的 Web 工具。玩家输入拥有的角色（BOX）及手动设定的培养目标，系统可直接计算升阶/升级/技能的材料缺口。

## 1. 方法1：exe 直接运行

### 用法

1. 下载 `siner_planner.exe`（dist文件夹下）
2. 双击运行，弹出终端窗口，显示 `已加载 153 个禁闭者` 即启动成功
3. 浏览器访问 **http://localhost:8000**

### 操作流程

1. **📋 角色BOX** — 在图鉴网格中找到拥有的角色，点击 **[添加]**，在弹出的窗口中设置当前练度和目标练度
2. **📊 计算培养** — 点击右侧 **[计算培养]** 按钮，跳转到培养规划页面查看材料缺口
3. 结果页包含：需培养角色数、材料缺口柱状图、每个角色的详细缺口（展开查看升阶/升级/技能材料）

> 配队功能暂时禁用，配队模板改良中...

### 提示

- 关闭终端窗口即可退出程序，端口自动释放
- 添加的角色数据保存在 exe 同目录下的 `my_roster.json`
- 如端口被占用，运行 `netstat -ano | findstr ":8000"` 查看，然后 `taskkill /F /PID <PID>` 释放

---

## 2. 方法2：Python 打开

### 环境要求

- Python 3.10+
- Windows

### 依赖安装

```bash
pip install fastapi uvicorn pydantic
```

依赖及已验证版本：

| 包 | 版本 |
|---|---|
| fastapi | 0.115.6 |
| uvicorn | 0.34.0 |
| pydantic | 2.10.3 |

> 项目数据存储在本地 JSON 文件中。

### 启动

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 或直接运行
python main.py
# 或双击start.bat
```

启动后浏览器访问 **http://localhost:8000**

### 数据文件

所有数据文件在 `data/` 目录下：

| 文件 | 说明 |
|---|---|
| `sinners.json` | 153 个禁闭者静态数据 |
| `materials.json` | 76 个材料定义 |
| `phase_cost.json` / `level_cost.json` / `skill_cost.json` | 升阶/升级/技能消耗表 |
| `team_templates.json` | 配队模板（改良中） |
| `materials_use_way.json` | 角色→材料查找表（仅狂级完整）危级和普级暂时未收集 |
| `my_roster.json` | 用户 BOX 数据（运行时读写） |

---

## 打包为 exe

```bash
pip install pyinstaller
pyinstaller siner_planner.spec
```

产物在 `dist/siner_planner.exe`。打包配置见 `siner_planner.spec`。

---

## 项目结构

```
main.py              # FastAPI 入口，lifespan 加载数据
run.py               # PyInstaller 打包入口
siner_planner.spec   # PyInstaller 打包配置
routers/             # API 路由（roster / sinners / team / plan）
core/                # 业务逻辑（data_loader / team_builder / calculator）
models/              # Pydantic v2 数据模型
data/                # JSON 数据文件
static/              # 前端
dist/                # 打包产物
```
