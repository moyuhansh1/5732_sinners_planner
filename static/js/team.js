/* ================================================================
   配队展示模块 — 含手动调整 + 导出
   ================================================================ */

const TeamModule = {
    _pickerEl: null,  // 当前打开的选人弹窗 DOM

    /** 执行配队 */
    async buildTeam() {
        const { roster } = App.state;
        if (roster.length === 0) {
            showToast('请先在BOX中添加角色', 'error');
            return;
        }
        if (this._building) return;
        this._building = true;

        // 禁用按钮
        const btnPlan = document.getElementById('btnStartPlan');
        const btnRebuild = document.getElementById('btnRebuild');
        [btnPlan, btnRebuild].forEach(b => {
            if (b) { b.disabled = true; b.textContent = '⏳ 配队中...'; }
        });

        try {
            const res = await API.fullPlan(roster);
            App.state.planResult = res.data;
            App.state.teamResult = res.data.team_result;

            this.render();
            PlanModule.render();
            switchTab('team');
            showToast('配队完成!', 'success');
        } catch (e) {
            showToast('配队失败: ' + e.message, 'error');
        } finally {
            // 恢复按钮
            [btnPlan, btnRebuild].forEach(b => {
                if (b) { b.disabled = false; b.textContent = b === btnRebuild ? '🔄 重新配队' : '🚀 开始配队'; }
            });
            this._building = false;
        }
    },

    /** 渲染配队结果 */
    render() {
        const grid = document.getElementById('teamGrid');
        const tr = App.state.teamResult;

        if (!tr || !tr.teams || tr.teams.length === 0) {
            grid.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;">暂无配队结果</div>';
            return;
        }

        grid.innerHTML = tr.teams.map((team, teamIdx) => {
            return `
            <div class="team-card" data-team-index="${teamIdx}">
                <div class="team-card-header">
                    <h3>${team.team_name}</h3>
                    <button class="btn-sm copy-team-btn" title="复制该队阵容" data-action="copy-team" data-team-index="${teamIdx}">📋</button>
                    <div class="team-owned-count">已拥有: ${team.slots.filter(s => s.sinner_id).length}/6</div>
                </div>
                <div class="team-slots">
                    ${(team.slots || []).map((slot, slotIdx) => this._renderSlot(slot, teamIdx, slotIdx)).join('')}
                </div>
            </div>`;
        }).join('');

        // 未分配角色提示
        if (tr.unassigned && tr.unassigned.length > 0) {
            const names = tr.unassigned.map(c => c.name || c.sinner_id).join('、');
            grid.insertAdjacentHTML('afterend',
                `<div class="empty-hint" style="margin-top:12px;">未分配角色: ${names}</div>`);
        }

        // 绑定槽位点击事件
        this._bindSlotClicks();
        // 绑定复制按钮
        this._bindCopyButtons();
        // 全局点击关闭弹窗
        this._bindOutsideClick();
    },

    _renderSlot(slot, teamIdx, slotIdx) {
        const notOwned = !!slot.not_owned;
        const hasChar = !!slot.sinner_id;
        const iconMap = {
            'required': '🔒', 'optional': '🔓',
            'main_dps': '⚔️', 'sub_dps': '🗡️', 'breaker': '🔨',
            'buffer': '✨', 'flex': '🔧', 'healer': '💚', 'support': '🛡️',
        };
        const icon = iconMap[slot.role_type] || '❓';

        if (notOwned) {
            return `
            <div class="team-slot not-owned" data-team-index="${teamIdx}" data-slot-index="${slotIdx}" data-has-char="0" title="未拥有此角色">
                <span class="slot-icon">❌</span>
                <div class="slot-info">
                    <span class="slot-label">${slot.label}</span>
                    <div class="slot-sinner-name vacant">未拥有</div>
                </div>
            </div>`;
        }

        return `
        <div class="team-slot ${hasChar ? 'filled' : 'vacant-slot'}" data-team-index="${teamIdx}" data-slot-index="${slotIdx}" data-has-char="${hasChar ? '1' : '0'}" title="${hasChar ? '点击更换角色' : '点击添加角色'}">
            <span class="slot-icon">${icon}</span>
            <div class="slot-info">
                <span class="slot-label">${slot.label}</span>
                <div class="slot-sinner-name ${hasChar ? '' : 'vacant'}">
                    ${hasChar ? slot.sinner_name : '[空缺]'}
                </div>
                ${hasChar ? `
                <div class="slot-meta">
                    <span class="slot-rarity ${slot.rarity}">${slot.rarity}</span>
                    · ${slot.role || '-'} · <span class="damage-badge ${slot.damage_type === '物理' ? 'phys' : slot.damage_type === '法术' ? 'magic' : ''}">${slot.damage_type || '-'}</span>
                    ${slot.breaker_count > 0 ? ` · 🔨×${slot.breaker_count}` : ''}
                </div>` : ''}
            </div>
        </div>`;
    },

    // ---------- 槽位点击 ----------
    _bindSlotClicks() {
        document.querySelectorAll('.team-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                // 如果点击的是复制按钮则不触发
                if (e.target.closest('[data-action="copy-team"]')) return;
                const teamIdx = parseInt(slot.dataset.teamIndex);
                const slotIdx = parseInt(slot.dataset.slotIndex);
                this._openSlotPicker(teamIdx, slotIdx, slot);
            });
        });
    },

    _bindCopyButtons() {
        document.querySelectorAll('[data-action="copy-team"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const teamIdx = parseInt(btn.dataset.teamIndex);
                this._copyTeamText(teamIdx);
            });
        });
    },

    // ---------- 选人弹窗 ----------
    _openSlotPicker(teamIdx, slotIdx, anchorEl) {
        // 关闭已有弹窗
        this._dismissPicker();

        const teams = App.state.teamResult.teams;
        const targetSlot = teams[teamIdx].slots[slotIdx];
        const currentSinnerId = targetSlot.sinner_id;

        // 收集可选角色：未分配 + 其他槽位已有角色（排除当前槽位）
        const available = [];
        const seen = new Set();

        // 从未分配列表
        const unassigned = App.state.teamResult.unassigned || [];
        unassigned.forEach(c => {
            const sid = c.sinner_id || c.id;
            if (sid && !seen.has(sid)) {
                seen.add(sid);
                available.push({
                    sinner_id: sid,
                    sinner_name: c.name || c.sinner_name || sid,
                    rarity: c.rarity || '普',
                    role: c.role || '',
                    breaker_count: c.breaker_count || 0,
                    source: 'unassigned',
                });
            }
        });

        // 从其他槽位（排除当前槽位）
        teams.forEach((t, ti) => {
            (t.slots || []).forEach((s, si) => {
                if (s.sinner_id && !(ti === teamIdx && si === slotIdx) && !seen.has(s.sinner_id)) {
                    seen.add(s.sinner_id);
                    available.push({
                        sinner_id: s.sinner_id,
                        sinner_name: s.sinner_name || s.sinner_id,
                        rarity: s.rarity || '普',
                        role: s.role || '',
                        breaker_count: s.breaker_count || 0,
                        source: 'other_slot',
                        source_team: ti,
                        source_slot: si,
                    });
                }
            });
        });

        // 如果有当前角色，添加"移除"选项
        if (currentSinnerId) {
            available.unshift({
                sinner_id: '__remove__',
                sinner_name: '🗑️ 移除此角色',
                rarity: '',
                role: '',
                breaker_count: 0,
                source: 'action',
            });
        }

        if (available.length === 0) {
            showToast('没有可用的角色', 'error');
            return;
        }

        // 创建弹窗
        const picker = document.createElement('div');
        picker.className = 'slot-picker';
        picker.innerHTML = available.map(c => `
            <div class="slot-picker-item ${c.source === 'action' ? 'picker-remove' : ''}" data-sinner-id="${c.sinner_id}" data-source="${c.source}" data-source-team="${c.source_team || ''}" data-source-slot="${c.source_slot || ''}">
                ${c.sinner_id !== '__remove__' ? `<span class="picker-rarity ${c.rarity}">${c.rarity}</span>` : ''}
                <span class="picker-name">${c.sinner_name}</span>
                ${c.role ? `<span class="picker-role">${c.role}</span>` : ''}
                ${c.breaker_count > 0 ? `<span class="picker-breaker">🔨${c.breaker_count}</span>` : ''}
            </div>
        `).join('');

        // 定位在锚点元素旁边
        const anchorRect = anchorEl.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.top = Math.min(anchorRect.bottom + 4, window.innerHeight - 300) + 'px';
        picker.style.left = Math.min(anchorRect.left, window.innerWidth - 200) + 'px';

        // 点击选项
        picker.querySelectorAll('.slot-picker-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sinnerId = item.dataset.sinnerId;
                this._dismissPicker();

                if (sinnerId === '__remove__') {
                    await this._removeFromSlot(teamIdx, slotIdx);
                } else {
                    const sourceInfo = {
                        source: item.dataset.source,
                        sourceTeam: item.dataset.sourceTeam ? parseInt(item.dataset.sourceTeam) : -1,
                        sourceSlot: item.dataset.sourceSlot ? parseInt(item.dataset.sourceSlot) : -1,
                    };
                    await this._swapCharacter(teamIdx, slotIdx, sinnerId, sourceInfo);
                }
            });
        });

        document.body.appendChild(picker);
        this._pickerEl = picker;

        // Escape 关闭
        this._pickerEsc = (e) => {
            if (e.key === 'Escape') this._dismissPicker();
        };
        document.addEventListener('keydown', this._pickerEsc);
    },

    _dismissPicker() {
        if (this._pickerEl) {
            this._pickerEl.remove();
            this._pickerEl = null;
        }
        if (this._pickerEsc) {
            document.removeEventListener('keydown', this._pickerEsc);
            this._pickerEsc = null;
        }
    },

    _bindOutsideClick() {
        if (this._outsideBound) return;
        this._outsideBound = true;
        document.addEventListener('click', (e) => {
            if (this._pickerEl && !this._pickerEl.contains(e.target)) {
                // 检查是否点击在槽位上（槽位自己会重新打开）
                if (!e.target.closest('.team-slot')) {
                    this._dismissPicker();
                }
            }
        });
    },

    // ---------- 交换逻辑 ----------
    async _swapCharacter(teamIdx, slotIdx, newSinnerId, sourceInfo) {
        const teams = App.state.teamResult.teams;
        const targetSlot = teams[teamIdx].slots[slotIdx];
        const oldSinnerId = targetSlot.sinner_id;

        // 从 App.state.sinners 查找新角色完整信息
        const sinnerInfo = (App.state.sinners || []).find(s => s.id === newSinnerId);
        if (!sinnerInfo && sourceInfo.source === 'unassigned') {
            // 从 unassigned 列表找
            const uc = (App.state.teamResult.unassigned || []).find(
                c => (c.sinner_id || c.id) === newSinnerId
            );
            if (uc) {
                targetSlot.sinner_id = uc.sinner_id || uc.id;
                targetSlot.sinner_name = uc.name || uc.sinner_name || newSinnerId;
                targetSlot.rarity = uc.rarity || '普';
                targetSlot.role = uc.role || '';
                targetSlot.breaker_count = uc.breaker_count || 0;
                targetSlot.damage_type = uc.damage_type || '';
                targetSlot.build_target = uc.build_target || null;
            }
        } else if (sinnerInfo) {
            // 从全图鉴找
            targetSlot.sinner_id = sinnerInfo.id;
            targetSlot.sinner_name = sinnerInfo.name;
            targetSlot.rarity = sinnerInfo.rarity;
            targetSlot.role = sinnerInfo.role;
            targetSlot.damage_type = sinnerInfo.damage_type;
            targetSlot.breaker_count = sinnerInfo.breaker_count || 0;
            // build_target 保持为空，由后端重算
            targetSlot.build_target = null;
        }

        // 处理来源：如果是从其他槽位来的，清空那个槽位
        if (sourceInfo.source === 'other_slot' && sourceInfo.sourceTeam >= 0) {
            const srcSlot = teams[sourceInfo.sourceTeam].slots[sourceInfo.sourceSlot];
            srcSlot.sinner_id = null;
            srcSlot.sinner_name = null;
            srcSlot.rarity = null;
            srcSlot.role = null;
            srcSlot.damage_type = null;
            srcSlot.breaker_count = 0;
            srcSlot.build_target = null;
        }

        // 处理被移走的旧角色：放到未分配列表
        if (oldSinnerId) {
            const unassigned = App.state.teamResult.unassigned || [];
            const oldSinner = (App.state.sinners || []).find(s => s.id === oldSinnerId);
            if (oldSinner && !unassigned.some(u => (u.sinner_id || u.id) === oldSinnerId)) {
                unassigned.push({
                    sinner_id: oldSinner.id,
                    name: oldSinner.name,
                    rarity: oldSinner.rarity,
                    role: oldSinner.role,
                    damage_type: oldSinner.damage_type,
                    breaker_count: oldSinner.breaker_count || 0,
                });
                App.state.teamResult.unassigned = unassigned;
            }
        }

        // 如果新角色是从未分配来的，从未分配列表中移除
        if (sourceInfo.source === 'unassigned') {
            App.state.teamResult.unassigned = (App.state.teamResult.unassigned || [])
                .filter(u => (u.sinner_id || u.id) !== newSinnerId);
        }

        // 重新计算各队破核数
        teams.forEach(team => {
            team.total_breaker = (team.slots || []).reduce((sum, s) => sum + (s.breaker_count || 0), 0);
        });

        // 调用后端重新计算
        await this._recalculateAfterSwap(teams);
    },

    async _removeFromSlot(teamIdx, slotIdx) {
        const teams = App.state.teamResult.teams;
        const targetSlot = teams[teamIdx].slots[slotIdx];
        const oldSinnerId = targetSlot.sinner_id;
        if (!oldSinnerId) return;

        // 放回未分配
        const oldSinner = (App.state.sinners || []).find(s => s.id === oldSinnerId);
        if (oldSinner) {
            const unassigned = App.state.teamResult.unassigned || [];
            if (!unassigned.some(u => (u.sinner_id || u.id) === oldSinnerId)) {
                unassigned.push({
                    sinner_id: oldSinner.id,
                    name: oldSinner.name,
                    rarity: oldSinner.rarity,
                    role: oldSinner.role,
                    damage_type: oldSinner.damage_type,
                    breaker_count: oldSinner.breaker_count || 0,
                });
            }
            App.state.teamResult.unassigned = unassigned;
        }

        // 清空槽位
        targetSlot.sinner_id = null;
        targetSlot.sinner_name = null;
        targetSlot.rarity = null;
        targetSlot.role = null;
        targetSlot.damage_type = null;
        targetSlot.breaker_count = 0;
        targetSlot.build_target = null;

        // 重算破核
        const team = teams[teamIdx];
        team.total_breaker = (team.slots || []).reduce((sum, s) => sum + (s.breaker_count || 0), 0);

        await this._recalculateAfterSwap(teams);
    },

    async _recalculateAfterSwap(teams) {
        try {
            const res = await API.recalculatePlan(teams);
            App.state.planResult = res.data;
            // 保持 teamResult 中的队伍（含手动调整）并更新 unassigned
            App.state.teamResult = {
                teams: teams,
                unassigned: res.data.team_result.unassigned || App.state.teamResult.unassigned || [],
            };
            App.state.planResult.team_result = App.state.teamResult;

            this.render();
            PlanModule.render();
            showToast('队伍已更新', 'success');
        } catch (e) {
            showToast('重新计算失败: ' + e.message, 'error');
        }
    },

    // ---------- 复制队伍文本 ----------
    _copyTeamText(teamIdx) {
        const team = App.state.teamResult.teams[teamIdx];
        if (!team) return;

        const owned = (team.slots || []).filter(s => s.sinner_id).length;
        let text = `${team.team_name} (已拥有 ${owned}/6):\n`;
        (team.slots || []).forEach(s => {
            if (s.not_owned) {
                text += `  ${s.label}: [未拥有]\n`;
            } else if (s.sinner_id) {
                text += `  ${s.label}: ${s.sinner_name} (${s.rarity || '?'}${s.role || ''}·${s.damage_type || ''})`;
                if (s.breaker_count > 0) text += ` 🔨${s.breaker_count}`;
                text += '\n';
            } else {
                text += `  ${s.label}: [空缺]\n`;
            }
        });

        this._copyToClipboard(text);
    },

    _copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('已复制到剪贴板', 'success');
            }).catch(() => {
                this._fallbackCopy(text);
            });
        } else {
            this._fallbackCopy(text);
        }
    },

    _fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast('已复制到剪贴板', 'success'); }
        catch (e) { showToast('复制失败，请手动选择', 'error'); }
        document.body.removeChild(ta);
    },

};
