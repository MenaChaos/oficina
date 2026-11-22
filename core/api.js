/**
 * CAPA DE CONEXIÓN / API (core/api.js)
 * Habla directamente con backend/Code.gs en Google Apps Script sin modificarlo.
 */

export class BridgeAPI {
  constructor(url, secret) {
    this.url = (url || '').trim();
    this.secret = (secret || '').trim();
  }

  setCredentials(url, secret) {
    this.url = (url || '').trim();
    this.secret = (secret || '').trim();
  }

  isConfigured() {
    return Boolean(this.url && this.secret);
  }

  async get(action, extraParams = {}) {
    if (!this.url) throw new Error('URL del puente no configurada.');
    const u = new URL(this.url);
    u.searchParams.set('action', action);
    u.searchParams.set('key', this.secret);
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    });

    const res = await fetch(u.toString(), { method: 'GET', redirect: 'follow' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error en respuesta del puente.');
    return json;
  }

  async post(action, payload = {}) {
    if (!this.url) throw new Error('URL del puente no configurada.');
    const body = JSON.stringify({
      key: this.secret,
      action,
      ...payload
    });

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow'
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error ejecutando acción.');
    return json;
  }

  ping() { return this.get('ping'); }
  bootstrap(force = false) { return this.get('bootstrap', force ? { force: '1' } : {}); }
  sync(force = false) { return this.get('sync', force ? { force: '1' } : {}); }
  saveConfig(config) { return this.post('save_config', { config }); }
  markBillStatus(tabName, status, sheetId) { return this.post('mark_bill_status', { tabName, status, sheetId }); }
  markFuelReimbursed(rowNumber, value = true, sheetId) { return this.post('mark_fuel_reimbursed', { rowNumber, value, sheetId }); }
  triggerWorkflow({ owner, repo, workflowId, branch = 'main', inputs = {} }) {
    return this.post('trigger_workflow', { owner, repo, workflowId, branch, inputs });
  }
  testAgent(agent) { return this.post('test_agent', { agent }); }
  getChatter(force = false) { return this.get('chatter', force ? { force: '1' } : {}); }
}

export function parseSteamHistoryLines(lines = []) {
  return lines
    .map((line) => {
      const parts = String(line).split(',');
      const appId = (parts[0] || '').trim();
      const date = (parts[1] || '').trim();
      if (!/^\d+$/.test(appId)) return null;
      return {
        appId,
        date,
        storeUrl: `https://store.steampowered.com/app/${appId}/`,
        imageUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
        fallbackUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
      };
    })
    .filter(Boolean);
}
