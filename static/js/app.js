/* ================================================================
   主控制器 — 全局状态、Tab切换、初始化
   ================================================================ */

const App = {
    /** 全局状态 */
    state: {
        sinners: [],        // 禁闭者图鉴列表
        roster: [],         // 用户BOX列表
        teamResult: null,   // 配队结果
        planResult: null,   // 规划结果（含配队+材料+体力）
    },

    /** 初始化 */
    async init() {
        this._bindTabs();
        this._bindActions();
        this._bindModal();
        try {
            await RosterModule.init();
        } finally {
            document.getElementById('loadingOverlay').classList.add('hidden');
        }
    },

    // ---------- Tab切换 ----------
    _bindTabs() {
        document.querySelectorAll('#tabNav .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab);
            });
        });
    },

    // ---------- 全局操作绑定 ----------
    _bindActions() {
        // 清空BOX
        document.getElementById('btnClearBox').addEventListener('click', () => {
            RosterModule.clearRoster();
        });

        // 导出BOX
        document.getElementById('btnExportBox').addEventListener('click', () => {
            RosterModule.exportRosterJSON();
        });

        // 计算培养（独立，不配队）
        document.getElementById('btnCalcCultivate').addEventListener('click', () => {
            PlanModule.calculateFromRoster();
        });

        // 开始配队
        document.getElementById('btnStartPlan').addEventListener('click', () => {
            TeamModule.buildTeam();
        });

        // 重新配队
        document.getElementById('btnRebuild').addEventListener('click', () => {
            TeamModule.buildTeam();
        });

        // 复制培养报告
        document.getElementById('btnCopyPlan').addEventListener('click', () => {
            PlanModule.exportText();
        });
    },

    // ---------- 弹窗事件 ----------
    _bindModal() {
        document.getElementById('btnModalCancel').addEventListener('click', () => {
            RosterModule.closeModal();
        });
        document.getElementById('btnModalConfirm').addEventListener('click', () => {
            RosterModule.confirmModal();
        });
        // 点击遮罩关闭
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) RosterModule.closeModal();
        });
    },
};

/** 切换Tab页 */
function switchTab(tabId) {
    document.querySelectorAll('[role="tab"]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('[role="tabpanel"]').forEach(p => {
        p.classList.remove('active');
    });

    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    const panel = document.getElementById(`panel${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);

    if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
    }
    if (panel) panel.classList.add('active');
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
