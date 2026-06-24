/* ================================================================
   培养规划展示模块
   ================================================================ */

const PlanModule = {
    /** 独立培养计算（不配队） */
    async calculateFromRoster() {
        const { roster } = App.state;
        if (roster.length === 0) {
            showToast('请先在BOX中添加角色', 'error');
            return;
        }
        try {
            const res = await API.cultivatePlan(roster);
            App.state.planResult = res.data;
            App.state.teamResult = null; // 独立培养无配队结果
            this.render();
            switchTab('plan');
            showToast('培养计算完成!', 'success');
        } catch (e) {
            showToast('计算失败: ' + e.message, 'error');
        }
    },

    /** 渲染规划结果全部内容 */
    render() {
        const pr = App.state.planResult;
        const btnCopy = document.getElementById('btnCopyPlan');

        if (!pr) {
            document.getElementById('overviewCards').innerHTML = '';
            document.getElementById('materialChart').innerHTML =
                '<div class="empty-hint">暂无培养规划数据，请先完成配队或计算培养</div>';
            document.getElementById('sinnerDetails').innerHTML = '';
            if (btnCopy) btnCopy.style.display = 'none';
            return;
        }

        if (btnCopy) btnCopy.style.display = 'inline-block';
        this._renderOverview(pr);
        this._renderMaterialChart(pr);
        this._renderSinnerDetails(pr);
    },

    /** 复制培养规划报告为文本 */
    exportText() {
        const pr = App.state.planResult;
        if (!pr) { showToast('暂无规划数据', 'error'); return; }

        const tr = App.state.teamResult;

        let text = '═══════════════════════════════\n';
        text += '  无期迷途 · 培养规划报告\n';
        text += '═══════════════════════════════\n\n';

        // 配队阵容（仅当有配队结果时）
        if (tr && tr.teams) {
            text += '【配队阵容】\n';
            tr.teams.forEach(t => {
                const names = (t.slots || []).filter(s => s.sinner_id).map(s => s.sinner_name).join('、') || '(未满)';
                text += `  ▸ ${t.team_name} (破核 ${t.total_breaker}/${t.recommended_breaker}): ${names}\n`;
            });
            text += '\n';
        } else {
            text += '【手动培养】\n\n';
        }

        // 材料缺口
        const materials = [...(pr.total_materials || [])];
        materials.sort((a, b) => b.total_needed - a.total_needed);
        text += '【材料缺口汇总】\n';
        materials.forEach(m => {
            text += `  ${m.material_name} × ${formatNum(m.total_needed)}\n`;
        });
        text += '\n';

        text += '═══════════════════════════════\n';

        // 复制到剪贴板
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

    // ---------- 概览卡片 ----------
    _renderOverview(pr) {
        const cards = document.getElementById('overviewCards');

        const items = [
            { label: '需培养角色', value: pr.need_train_count || 0, cls: 'training' },
            { label: '已达标角色', value: pr.qualified_count || 0, cls: 'qualified' },
        ];

        cards.innerHTML = items.map(i => `
            <div class="overview-card ${i.cls}">
                <div class="oc-value">${i.value}</div>
                <div class="oc-label">${i.label}</div>
            </div>
        `).join('');
    },

    // ---------- 材料缺口柱状图（纯CSS） ----------
    _renderMaterialChart(pr) {
        const container = document.getElementById('materialChart');
        const materials = [...(pr.total_materials || [])];

        if (materials.length === 0) {
            container.innerHTML = '<div class="empty-hint all-done"><span class="done-icon">🎉</span>所有角色已达标，无需培养</div>';
            return;
        }

        // 按需求量降序排列
        materials.sort((a, b) => b.total_needed - a.total_needed);

        // 对数刻度：避免狄斯币等巨量材料挤扁其他柱子
        const logMax = Math.log10(Math.max(...materials.map(m => m.total_needed), 1));

        container.innerHTML = materials.map(m => {
            const logVal = Math.log10(Math.max(m.total_needed, 1));
            const pct = logMax > 0 ? Math.round((logVal / logMax) * 100) : 0;
            // 根据material_id前缀判断类别
            let cat = 'category-general';
            if (m.material_id && m.material_id.startsWith('mat_01')) cat = 'category-skill_up';
            else if (m.material_id && /^mat_00[1-9]\b/.test(m.material_id)) cat = 'category-phase_up';
            else if (m.material_id === 'mat_discoin' || m.material_id === 'mat_exp') cat = 'category-general';

            return `
            <div class="chart-row">
                <span class="chart-label" title="${m.material_name}">${m.material_name}</span>
                <div class="chart-bar-wrap">
                    <div class="chart-bar ${cat}" style="width:${pct}%"></div>
                </div>
                <span class="chart-value">${formatNum(m.total_needed)}</span>
            </div>`;
        }).join('');
    },

    // ---------- 角色详情折叠面板 ----------
    _renderSinnerDetails(pr) {
        const container = document.getElementById('sinnerDetails');
        const list = pr.per_sinner || [];

        if (list.length === 0) {
            container.innerHTML = '<div class="empty-hint">暂无角色数据</div>';
            return;
        }

        // 构建 material_id → name 映射
        const matNames = {};
        (pr.total_materials || []).forEach(m => {
            matNames[m.material_id] = m.material_name;
        });

        container.innerHTML = list.map((ps, idx) => {
            if (ps.is_qualified) {
                return this._renderQualifiedCard(ps);
            }
            return this._renderTrainingCard(ps, idx, matNames);
        }).join('');

        // 绑定折叠事件（含键盘支持）
        container.querySelectorAll('.detail-header').forEach(header => {
            header.setAttribute('tabindex', '0');
            header.setAttribute('role', 'button');
            header.setAttribute('aria-expanded', 'false');

            const toggleOpen = () => {
                const card = header.parentElement;
                const isOpen = card.classList.toggle('open');
                header.setAttribute('aria-expanded', String(isOpen));
            };

            header.addEventListener('click', toggleOpen);
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleOpen();
                }
            });
        });
    },

    _renderQualifiedCard(ps) {
        const cur = ps.current || {};
        return `
        <div class="detail-card">
            <div class="detail-header">
                <span class="dh-arrow">▶</span>
                <span class="dh-name">✅ ${ps.sinner_name}</span>
                <span class="dh-qualified">已达标</span>
            </div>
            <div class="detail-body">
                <div class="db-section">
                    当前练度：${cur.phase || '-'}阶${cur.level || '-'}级
                    技能 ${(cur.skills || []).join('/')}
                </div>
            </div>
        </div>`;
    },

    _renderTrainingCard(ps, idx, matNames) {
        const cur = ps.current || {};
        const tgt = ps.target || {};
        const pg = ps.phase_gap || {};
        const lg = ps.level_gap || {};
        const skillGaps = ps.skill_gaps || [];

        // Helper: resolve material ID to human-readable name
        const matName = (mid) => matNames && matNames[mid] ? matNames[mid] : mid;

        // 材料缺口展示（芯片形式）
        const matChips = Object.entries(ps.materials_needed || {})
            .map(([mid, count]) => `<span class="mat-chip">${matName(mid)} ×${formatNum(count)}</span>`)
            .join('');

        // 技能差距
        const skillLines = skillGaps
            .filter(sg => sg.levels_needed > 0)
            .map(sg => `技${sg.skill_index}[${sg.from_level}→${sg.to_level}]`)
            .join(' ');

        return `
        <div class="detail-card">
            <div class="detail-header">
                <span class="dh-arrow">▶</span>
                <span class="dh-name">🔶 ${ps.sinner_name}</span>
            </div>
            <div class="detail-body">
                <div class="db-section">
                    <strong>当前：</strong>${cur.phase || 0}阶${cur.level || 1}级
                    技能 ${(cur.skills || []).join('/')}
                </div>
                <div class="db-section">
                    <strong>目标：</strong>${tgt.phase || 3}阶${tgt.level || 90}级
                    技能 ${(tgt.skills || []).join('/')}
                </div>
                ${Object.keys(pg).length > 0 ? `
                <div class="db-section">
                    <strong>升阶需求：</strong>${Object.entries(pg).map(([k,v]) => `${matName(k)} ×${v}`).join('、')}
                </div>` : ''}
                ${Object.keys(lg).length > 0 ? `
                <div class="db-section">
                    <strong>升级需求：</strong>${Object.entries(lg).map(([k,v]) => `${matName(k)} ×${v}`).join('、')}
                </div>` : ''}
                ${skillLines ? `
                <div class="db-section">
                    <strong>技能升级：</strong>${skillLines}
                </div>` : ''}
                ${matChips ? `
                <div class="db-section" style="margin-top:6px;">
                    <strong>材料缺口：</strong><br>${matChips}
                </div>` : ''}
            </div>
        </div>`;
    },
};
