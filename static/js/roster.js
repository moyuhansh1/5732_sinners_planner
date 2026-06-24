/* ================================================================
   BOX管理模块
   ================================================================ */

const RosterModule = {
    filters: { rarity: 'all', role: 'all', damage: 'all' },
    modalMode: 'add',      // 'add' | 'edit'
    modalSinnerId: null,

    /** 加载图鉴和BOX */
    async init() {
        try {
            App.state.sinners = await API.getSinners();
            App.state.roster = await API.getRoster();
            // 向后兼容：旧数据补默认 target 字段
            App.state.roster.forEach(item => {
                if (item.target_phase === undefined) item.target_phase = 3;
                if (item.target_level === undefined) item.target_level = 90;
                if (item.target_skills === undefined) item.target_skills = [7, 7, 7, 7];
            });
            this.render();
            this._bindFilterDelegation();
        } catch (e) {
            document.getElementById('catalogGrid').innerHTML =
                `<div class="empty-hint" style="grid-column:1/-1;">
                    <p>❌ 加载数据失败: ${escapeHtml(e.message)}</p>
                    <button class="btn btn-primary" onclick="RosterModule.retry()" style="margin-top:12px;">🔄 重试</button>
                </div>`;
            document.getElementById('rosterList').innerHTML =
                '<div class="empty-hint">⚠️ 数据加载失败，请点击重试</div>';
        }
    },

    /** 重试加载 */
    retry() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
        this.init().finally(() => {
            document.getElementById('loadingOverlay').classList.add('hidden');
        });
    },

    /** 渲染全部 */
    render() {
        this.renderCatalog();
        this.renderRoster();
    },

    // ---------- 图鉴渲染 ----------
    renderCatalog() {
        const grid = document.getElementById('catalogGrid');
        const { sinners, roster } = App.state;

        let filtered = sinners;
        if (this.filters.rarity !== 'all') {
            filtered = filtered.filter(s => s.rarity === this.filters.rarity);
        }
        if (this.filters.role !== 'all') {
            filtered = filtered.filter(s => s.role === this.filters.role);
        }
        if (this.filters.damage !== 'all') {
            filtered = filtered.filter(s => s.damage_type === this.filters.damage);
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;">没有匹配的禁闭者</div>';
            return;
        }

        grid.innerHTML = filtered.map(s => {
            const inBox = isInRoster(s.id, roster);
            return `
            <div class="sinner-card ${inBox ? 'in-roster' : ''}" data-sinner-id="${s.id}" data-rarity="${s.rarity}">
                <div class="card-rarity ${s.rarity}">${s.rarity}级</div>
                <div class="card-name">${s.name}</div>
                <div class="card-meta">${ROLE_ICON[s.role] || ''} ${s.role} · <span class="damage-badge ${s.damage_type === '物理' ? 'phys' : s.damage_type === '法术' ? 'magic' : ''}">${s.damage_type}</span></div>
                <div class="card-tags">${s.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
                ${s.breaker_count > 0 ? `<div class="card-breaker">🔨 破核×${s.breaker_count}</div>` : ''}
                <button class="btn-add" data-action="add" data-sinner-id="${s.id}">
                    ${inBox ? '✏️ 编辑' : '➕ 添加'}
                </button>
            </div>`;
        }).join('');

        // 绑定添加按钮事件
        grid.querySelectorAll('[data-action="add"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openModal(btn.dataset.sinnerId);
            });
        });
    },

    // ---------- 筛选（事件委托，只绑定一次） ----------
    _bindFilterDelegation() {
        const bar = document.getElementById('filterBar');
        if (!bar._filterBound) {
            bar.addEventListener('click', (e) => {
                const btn = e.target.closest('.filter-btn');
                if (!btn) return;
                const group = btn.closest('.filter-group');
                group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filters[btn.dataset.filter] = btn.dataset.value;
                this.renderCatalog();
            });
            bar._filterBound = true;
        }
    },

    // ---------- BOX渲染 ----------
    renderRoster() {
        const list = document.getElementById('rosterList');
        const count = document.getElementById('boxCount');
        const { roster, sinners } = App.state;

        count.textContent = `${roster.length}个角色`;

        if (roster.length === 0) {
            list.innerHTML = '<div class="empty-hint">👆 点击上方图鉴中的 [添加] 按钮将角色加入BOX</div>';
            return;
        }

        list.innerHTML = roster.map(r => {
            const s = findSinner(r.sinner_id, sinners);
            if (!s) {
                const fallbackSkills = (r.current_skills || [1, 1, 1, 1]).join('/');
                return `
                <div class="roster-item roster-item-unknown">
                    <span class="ri-rarity">?</span>
                    <span class="ri-name" title="该数据可能已过期">${r.sinner_id} (未知)</span>
                    <span class="ri-role">数据缺失</span>
                    <span class="ri-levels">${r.current_phase}阶${r.current_level}级 技能${fallbackSkills}</span>
                    <div class="ri-actions">
                        <button class="btn-sm danger" data-action="remove-roster" data-sinner-id="${r.sinner_id}">🗑️ 删除</button>
                    </div>
                </div>`;
            }
            const icon = ROLE_ICON[s.role] || '';
            const skills = r.current_skills || [1, 1, 1, 1];
            const skillDots = skills.map(sv => {
                let dotCls = 'low';
                if (sv >= 7) dotCls = 'high';
                else if (sv >= 4) dotCls = 'mid';
                return `<span class="skill-dot ${dotCls}"></span>`;
            }).join('');
            const maxPhaseLv = PHASE_MAX_LEVEL[r.current_phase] || 90;
            const lvPct = Math.round((r.current_level / maxPhaseLv) * 100);
            return `
            <div class="roster-item phase-${r.current_phase}">
                <span class="ri-rarity ${s.rarity}">${s.rarity}</span>
                <span class="ri-name">${s.name}</span>
                <span class="ri-role">${icon} ${s.role}</span>
                <span class="ri-levels">
                    ${getLevelSummaryWithTarget(r)}
                    <span class="skill-dots">${skillDots}</span>
                    <span class="level-bar-wrap"><span class="level-bar-fill" style="width:${lvPct}%"></span></span>
                </span>
                <div class="ri-actions">
                    <button class="btn-sm" data-action="edit-roster" data-sinner-id="${s.id}">✏️ 编辑</button>
                    <button class="btn-sm danger" data-action="remove-roster" data-sinner-id="${s.id}">🗑️</button>
                </div>
            </div>`;
        }).join('');

        // 绑定编辑/删除
        list.querySelectorAll('[data-action="edit-roster"]').forEach(btn => {
            btn.addEventListener('click', () => this.openModal(btn.dataset.sinnerId));
        });
        list.querySelectorAll('[data-action="remove-roster"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await this.removeFromRoster(btn.dataset.sinnerId);
            });
        });
    },

    // ---------- BOX操作 ----------
    async addToRoster(item) {
        try {
            await API.addToRoster(item);
            App.state.roster = await API.getRoster();
            this.render();
            showToast('已添加', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    async updateInRoster(item) {
        try {
            await API.updateRoster(item);
            App.state.roster = await API.getRoster();
            this.render();
            showToast('已更新', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    async removeFromRoster(sinnerId) {
        try {
            await API.removeFromRoster(sinnerId);
            App.state.roster = await API.getRoster();
            this.render();
            showToast('已删除', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    async clearRoster() {
        if (!confirm('确定要清空整个BOX吗？此操作不可撤销。')) return;
        const previousRoster = [...App.state.roster];
        try {
            await API.clearRoster();
            App.state.roster = [];
            this.render();
            showToast('BOX已清空', 'success');
        } catch (e) {
            App.state.roster = previousRoster;
            this.render();
            showToast('清空失败: ' + e.message, 'error');
        }
    },

    // ---------- 导出 ----------
    exportRosterJSON() {
        if (!App.state.roster || App.state.roster.length === 0) {
            showToast('BOX为空，无数据可导出', 'error');
            return;
        }
        const data = JSON.stringify({ roster: App.state.roster }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my_roster.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('已下载 my_roster.json', 'success');
    },

    // ---------- 弹窗 ----------
    openModal(sinnerId) {
        const sinner = findSinner(sinnerId, App.state.sinners);
        if (!sinner) return;

        const existing = App.state.roster.find(r => r.sinner_id === sinnerId);

        this.modalMode = existing ? 'edit' : 'add';
        this.modalSinnerId = sinnerId;

        document.getElementById('modalTitle').textContent = existing ? '编辑角色练度' : '添加角色到BOX';
        document.getElementById('modalSinnerName').textContent = `${sinner.name} (${sinner.rarity}${sinner.role})`;

        // 填充当前练度
        document.getElementById('modalPhase').value = existing ? existing.current_phase : 0;
        document.getElementById('modalLevel').value = existing ? existing.current_level : 1;

        const curSkills = existing ? existing.current_skills : [1, 1, 1, 1];
        document.querySelectorAll('.skill-lv:not(.target-skill)').forEach((inp, i) => {
            inp.value = curSkills[i];
        });

        // 填充目标练度
        document.getElementById('modalTargetPhase').value = existing ? existing.target_phase : 3;
        document.getElementById('modalTargetLevel').value = existing ? existing.target_level : 90;

        const tgtSkills = existing ? existing.target_skills : [7, 7, 7, 7];
        document.querySelectorAll('.target-skill').forEach((inp, i) => {
            inp.value = tgtSkills[i];
        });

        // 更新当前等级输入框范围
        this._updateModalLevelRange();
        // 更新目标等级输入框范围
        this._updateModalTargetLevelRange();

        // 绑定等阶变化事件（只绑一次）
        if (!this._phaseBoundsBound) {
            this._phaseBoundsBound = true;
            document.getElementById('modalPhase').addEventListener('change', () => this._updateModalLevelRange());
            document.getElementById('modalTargetPhase').addEventListener('change', () => this._updateModalTargetLevelRange());
            document.getElementById('modalTargetLevel').addEventListener('change', () => this._onTargetLevelChange());
        }

        const overlay = document.getElementById('modalOverlay');
        overlay.classList.add('show');

        // Store previously focused element for restore
        this._previousFocus = document.activeElement;

        // Focus first focusable element in modal
        const firstFocusable = overlay.querySelector('select, input, button');
        if (firstFocusable) setTimeout(() => firstFocusable.focus(), 50);

        // Escape key handler
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.closeModal();
        };
        document.addEventListener('keydown', this._escHandler);

        // Focus trap: keep Tab within modal
        this._focusTrapHandler = (e) => {
            if (e.key !== 'Tab') return;
            const focusable = overlay.querySelectorAll(
                'select:not([disabled]), input:not([disabled]), button:not([disabled])'
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', this._focusTrapHandler);
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('show');
        this.modalSinnerId = null;

        // Remove event listeners
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        if (this._focusTrapHandler) {
            document.removeEventListener('keydown', this._focusTrapHandler);
            this._focusTrapHandler = null;
        }

        // Restore focus
        if (this._previousFocus) {
            this._previousFocus.focus();
            this._previousFocus = null;
        }
    },

    confirmModal() {
        const phase = parseInt(document.getElementById('modalPhase').value) || 0;
        const level = parseInt(document.getElementById('modalLevel').value) || 1;
        const tgtPhase = parseInt(document.getElementById('modalTargetPhase').value) || 3;
        const tgtLevel = parseInt(document.getElementById('modalTargetLevel').value) || 90;

        // 校验当前等阶-等级
        const curErr = validatePhaseLevel(phase, level);
        if (curErr) { showToast('当前' + curErr, 'error'); return; }

        // 校验目标等阶-等级
        const tgtErr = validatePhaseLevel(tgtPhase, tgtLevel);
        if (tgtErr) { showToast('目标' + tgtErr, 'error'); return; }

        const curSkills = [];
        document.querySelectorAll('.skill-lv:not(.target-skill)').forEach(inp => {
            const v = parseInt(inp.value) || 1;
            curSkills.push(Math.max(1, Math.min(10, v)));
        });

        const tgtSkills = [];
        document.querySelectorAll('.target-skill').forEach(inp => {
            const v = parseInt(inp.value) || 1;
            tgtSkills.push(Math.max(1, Math.min(10, v)));
        });

        const item = {
            sinner_id: this.modalSinnerId,
            current_phase: phase,
            current_level: level,
            current_skills: curSkills,
            target_phase: tgtPhase,
            target_level: tgtLevel,
            target_skills: tgtSkills,
        };

        if (this.modalMode === 'add') {
            this.addToRoster(item);
        } else {
            this.updateInRoster(item);
        }

        this.closeModal();
    },

    /** 更新当前等级输入框的范围（基于当前等阶） */
    _updateModalLevelRange() {
        const phase = parseInt(document.getElementById('modalPhase').value) || 0;
        const [minLv, maxLv] = getLevelRangeForPhase(phase);
        const inp = document.getElementById('modalLevel');
        inp.min = minLv;
        inp.max = maxLv;
        document.getElementById('modalLevelHint').textContent = `范围: ${minLv}-${maxLv}`;
        if (parseInt(inp.value) < minLv) inp.value = minLv;
        if (parseInt(inp.value) > maxLv) inp.value = maxLv;
    },

    /** 更新目标等级输入框的范围（基于目标等阶） */
    _updateModalTargetLevelRange() {
        const phase = parseInt(document.getElementById('modalTargetPhase').value) || 3;
        const [minLv, maxLv] = getLevelRangeForPhase(phase);
        const inp = document.getElementById('modalTargetLevel');
        inp.min = minLv;
        inp.max = maxLv;
        document.getElementById('modalTargetLevelHint').textContent = `范围: ${minLv}-${maxLv}`;
        if (parseInt(inp.value) < minLv) inp.value = minLv;
        if (parseInt(inp.value) > maxLv) inp.value = maxLv;
    },

    /** 目标等级变化时自动调整等阶下限 */
    _onTargetLevelChange() {
        const level = parseInt(document.getElementById('modalTargetLevel').value) || 1;
        const minPhase = getMinPhaseForLevel(level);
        const currentPhase = parseInt(document.getElementById('modalTargetPhase').value) || 0;
        if (currentPhase < minPhase) {
            document.getElementById('modalTargetPhase').value = minPhase;
            this._updateModalTargetLevelRange();
        }
    },
};
