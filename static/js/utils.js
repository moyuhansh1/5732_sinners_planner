/* ================================================================
   工具函数
   ================================================================ */

const RARITY_LABEL = { '狂': '狂', '危': '危', '普': '普' };
const RARITY_COLOR = { '狂': '#ffd700', '危': '#c77dff', '普': '#7ec8e3' };

const ROLE_ICON = {
    '狂暴': '🔴', '精准': '🎯', '异能': '🔮',
    '启迪': '✨', '诡秘': '🗡️', '坚韧': '🛡️',
};

const DAMAGE_LABEL = { '物理': '物理', '法术': '法术', '无': '无' };

const PHASE_MAX_LEVEL = { 0: 20, 1: 40, 2: 70, 3: 90 };
const PHASE_MIN_LEVEL = { 0: 1, 1: 21, 2: 41, 3: 71 };

/**
 * HTML 转义（防止XSS）
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 显示 Toast 消息
 */
function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    // Force re-announcement for screen readers
    toast.textContent = '';
    requestAnimationFrame(() => {
        toast.textContent = msg;
        toast.className = 'toast show ' + type;
    });
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/**
 * 格式化数字（加千分位）
 */
function formatNum(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return n.toLocaleString('zh-CN');
}

/**
 * 获取角色练度摘要文本
 */
function getLevelSummary(item) {
    const skills = item.current_skills || [1,1,1,1];
    return `${item.current_phase}阶${item.current_level}级 技能${skills.join('/')}`;
}

/**
 * 判断角色是否已在BOX中
 */
function isInRoster(sinnerId, roster) {
    return roster.some(r => r.sinner_id === sinnerId);
}

/**
 * 根据sinner_id从图鉴中查找角色信息
 */
function findSinner(sinnerId, sinners) {
    return sinners.find(s => s.id === sinnerId) || null;
}

/**
 * 获取等阶对应的等级范围 [minLevel, maxLevel]
 */
function getLevelRangeForPhase(phase) {
    const maxLv = PHASE_MAX_LEVEL[phase] || 90;
    const minLv = PHASE_MIN_LEVEL[phase] || 1;
    return [minLv, maxLv];
}

/**
 * 根据目标等级自动推算最低等阶
 */
function getMinPhaseForLevel(level) {
    for (let p = 0; p <= 3; p++) {
        if (level <= PHASE_MAX_LEVEL[p]) return p;
    }
    return 3;
}

/**
 * 校验等阶-等级约束，返回错误信息或 null
 */
function validatePhaseLevel(phase, level) {
    const [minLv, maxLv] = getLevelRangeForPhase(phase);
    if (level < minLv || level > maxLv) {
        return `等阶${phase}的等级范围为 ${minLv}-${maxLv}`;
    }
    return null;
}

/**
 * 获取角色练度摘要（含目标）
 */
function getLevelSummaryWithTarget(item) {
    const cur = getLevelSummary(item);
    if (item.target_phase === undefined) return cur;
    const tgtSkills = item.target_skills || [7, 7, 7, 7];
    return `${cur} → ${item.target_phase}阶${item.target_level}级 技能${tgtSkills.join('/')}`;
}
