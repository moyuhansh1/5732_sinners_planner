/* ================================================================
   API请求封装
   ================================================================ */

const API = {
    baseURL: '/api',

    async _fetch(url, options = {}) {
        try {
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || '请求失败');
            }
            return res.json();
        } catch (e) {
            if (e.message.includes('Failed to fetch')) {
                throw new Error('无法连接服务器，请确认后端已启动');
            }
            throw e;
        }
    },

    // ========== BOX管理 ==========
    async getRoster() {
        const res = await this._fetch(`${this.baseURL}/roster`);
        return res.data.roster || [];
    },

    async addToRoster(data) {
        return this._fetch(`${this.baseURL}/roster/add`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async updateRoster(data) {
        return this._fetch(`${this.baseURL}/roster/update`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async removeFromRoster(sinnerId) {
        return this._fetch(`${this.baseURL}/roster/remove?sinner_id=${encodeURIComponent(sinnerId)}`, {
            method: 'DELETE',
        });
    },

    async clearRoster() {
        return this._fetch(`${this.baseURL}/roster/clear`, { method: 'DELETE' });
    },

    // ========== 图鉴 ==========
    async getSinners() {
        const res = await this._fetch(`${this.baseURL}/sinners`);
        return res.data.sinners || [];
    },

    // ========== 配队规划 ==========
    async buildTeam(roster) {
        return this._fetch(`${this.baseURL}/team/build`, {
            method: 'POST',
            body: JSON.stringify({ roster }),
        });
    },

    async fullPlan(roster) {
        return this._fetch(`${this.baseURL}/plan/full`, {
            method: 'POST',
            body: JSON.stringify({ roster }),
        });
    },

    async recalculatePlan(teams) {
        return this._fetch(`${this.baseURL}/plan/recalculate`, {
            method: 'POST',
            body: JSON.stringify({ teams }),
        });
    },

    async cultivatePlan(roster) {
        return this._fetch(`${this.baseURL}/plan/cultivate`, {
            method: 'POST',
            body: JSON.stringify({ roster }),
        });
    },
};
