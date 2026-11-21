/**
 * CAPA DE ESTADO Y PERSISTENCIA (core/store.js)
 * Gestiona oficinas, agentes, tema activo, credenciales locales y sincronización con Sheets.
 */

import { DEFAULT_BRIDGE_URL, DEFAULT_CONFIG, DEMO_DATA, DEMO_ALERTS } from '../config/default-world.js';
import { BridgeAPI } from './api.js';
import { applyThemeCss } from '../themes/themes.js';

const LS_KEY_CREDS = 'menachaos_os_creds_v2';
const LS_KEY_CONFIG = 'menachaos_os_config_v2';
const LS_KEY_PREFS = 'menachaos_os_prefs_v2';

export class OfficeStore {
  constructor() {
    this.listeners = new Set();
    const creds = this.loadLocalCreds();
    this.api = new BridgeAPI(creds.url || DEFAULT_BRIDGE_URL, creds.secret || '');

    this.state = {
      mode: creds.secret ? 'connecting' : 'locked', // locked | connecting | online | demo | error
      bridgeUrl: creds.url || DEFAULT_BRIDGE_URL,
      apiSecret: creds.secret || '',
      config: this.loadLocalConfig(),
      data: {},
      systemAlerts: [],
      selectedAgentId: null,
      lastSync: null,
      isSyncing: false,
      prefs: this.loadLocalPrefs()
    };

    this.applyActiveTheme();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event = 'update', detail = null) {
    this.listeners.forEach((fn) => fn(this.state, event, detail));
  }

  loadLocalCreds() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY_CREDS) || '{}');
    } catch {
      return {};
    }
  }

  saveLocalCreds(url, secret) {
    const cleanUrl = (url || DEFAULT_BRIDGE_URL).trim();
    const cleanSecret = (secret || '').trim();
    localStorage.setItem(LS_KEY_CREDS, JSON.stringify({ url: cleanUrl, secret: cleanSecret }));
    this.state.bridgeUrl = cleanUrl;
    this.state.apiSecret = cleanSecret;
    this.api.setCredentials(cleanUrl, cleanSecret);
  }

  loadLocalConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY_CONFIG) || 'null');
      if (saved && Array.isArray(saved.offices) && saved.offices.length > 0) {
        return saved;
      }
    } catch {}
    return structuredClone(DEFAULT_CONFIG);
  }

  saveLocalConfig() {
    localStorage.setItem(LS_KEY_CONFIG, JSON.stringify(this.state.config));
  }

  loadLocalPrefs() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY_PREFS) || '{"dim":false}');
    } catch {
      return { dim: false };
    }
  }

  saveLocalPrefs() {
    localStorage.setItem(LS_KEY_PREFS, JSON.stringify(this.state.prefs));
  }

  getActiveOffice() {
    const offices = this.state.config.offices || [];
    return offices.find((o) => o.id === this.state.config.activeOfficeId) || offices[0];
  }

  getActiveThemeId() {
    const office = this.getActiveOffice();
    return (office && office.themeOverride) || this.state.config.activeTheme || 'cyber-studio';
  }

  applyActiveTheme() {
    applyThemeCss(this.getActiveThemeId());
  }

  async connectAndBootstrap(url, secret, force = false) {
    if (url !== undefined || secret !== undefined) {
      this.saveLocalCreds(url ?? this.state.bridgeUrl, secret ?? this.state.apiSecret);
    }

    this.state.isSyncing = true;
    this.emit('sync_start');

    try {
      const res = await this.api.bootstrap(force);
      if (res.config && Array.isArray(res.config.offices) && res.config.offices.length > 0) {
        this.state.config = res.config;
        this.saveLocalConfig();
      }
      this.state.data = res.data || {};
      this.state.systemAlerts = res.systemAlerts || [];
      this.state.mode = 'online';
      this.state.lastSync = new Date();
      this.applyActiveTheme();
      this.state.isSyncing = false;
      this.emit('synced');
      return res;
    } catch (err) {
      this.state.isSyncing = false;
      this.state.mode = 'error';
      this.emit('sync_error', err);
      throw err;
    }
  }

  async syncData(force = false) {
    if (this.state.mode === 'demo') {
      this.state.lastSync = new Date();
      this.emit('synced');
      return;
    }
    this.state.isSyncing = true;
    this.emit('sync_start');
    try {
      const res = await this.api.sync(force);
      this.state.data = res.data || {};
      this.state.systemAlerts = res.systemAlerts || [];
      this.state.mode = 'online';
      this.state.lastSync = new Date();
      this.state.isSyncing = false;
      this.emit('synced');
    } catch (err) {
      this.state.isSyncing = false;
      this.emit('sync_error', err);
      throw err;
    }
  }

  enterDemoMode() {
    this.state.mode = 'demo';
    this.state.data = structuredClone(DEMO_DATA);
    this.state.systemAlerts = structuredClone(DEMO_ALERTS);
    this.state.lastSync = new Date();
    this.applyActiveTheme();
    this.emit('synced');
  }

  async persistConfigToCloud() {
    this.saveLocalConfig();
    if (this.state.mode === 'online' && this.api.isConfigured()) {
      await this.api.saveConfig(this.state.config);
    }
  }

  // ---- Gestión de Oficinas ----
  setActiveOffice(officeId) {
    this.state.config.activeOfficeId = officeId;
    this.state.selectedAgentId = null;
    this.applyActiveTheme();
    this.saveLocalConfig();
    this.emit('office_changed');
  }

  async upsertOffice({ id, name, subtitle, icon }) {
    const offices = this.state.config.offices;
    if (id) {
      const existing = offices.find((o) => o.id === id);
      if (existing) {
        existing.name = name;
        existing.subtitle = subtitle;
        existing.icon = icon || '🏢';
      }
    } else {
      const newId = 'oficina-' + Date.now().toString(36);
      offices.push({
        id: newId,
        name,
        subtitle: subtitle || '',
        icon: icon || '🏢',
        themeOverride: null,
        agents: []
      });
      this.state.config.activeOfficeId = newId;
    }
    await this.persistConfigToCloud();
    this.applyActiveTheme();
    this.emit('config_changed');
  }

  async deleteOffice(officeId) {
    if (this.state.config.offices.length <= 1) {
      throw new Error('Debes mantener al menos una oficina activa.');
    }
    this.state.config.offices = this.state.config.offices.filter((o) => o.id !== officeId);
    if (this.state.config.activeOfficeId === officeId) {
      this.state.config.activeOfficeId = this.state.config.offices[0].id;
    }
    await this.persistConfigToCloud();
    this.applyActiveTheme();
    this.emit('config_changed');
  }

  // ---- Gestión de Agentes ----
  async upsertAgent(agentObj) {
    const office = this.getActiveOffice();
    const idx = office.agents.findIndex((a) => a.id === agentObj.id);
    if (idx >= 0) {
      office.agents[idx] = { ...office.agents[idx], ...agentObj };
    } else {
      agentObj.deskSlot = office.agents.length;
      office.agents.push(agentObj);
    }
    await this.persistConfigToCloud();
    this.emit('agent_changed', { agentId: agentObj.id });
    if (this.state.mode === 'online') {
      await this.syncData(true);
    }
  }

  async deleteAgent(agentId) {
    const office = this.getActiveOffice();
    office.agents = office.agents.filter((a) => a.id !== agentId);
    office.agents.forEach((a, i) => (a.deskSlot = i));
    if (this.state.selectedAgentId === agentId) {
      this.state.selectedAgentId = null;
    }
    await this.persistConfigToCloud();
    this.emit('config_changed');
  }

  // ---- Gestión de Diseño / Temas ----
  async setTheme(themeId, scope = 'global') {
    if (scope === 'office') {
      const office = this.getActiveOffice();
      if (office) office.themeOverride = themeId;
    } else {
      this.state.config.activeTheme = themeId;
      const office = this.getActiveOffice();
      if (office) office.themeOverride = null;
    }
    this.applyActiveTheme();
    await this.persistConfigToCloud();
    this.emit('theme_changed', { themeId });
  }

  async setRefreshMinutes(mins) {
    this.state.config.refreshMinutes = Number(mins);
    await this.persistConfigToCloud();
    this.emit('config_changed');
  }

  async replaceFullConfig(newConfig) {
    if (!newConfig || !Array.isArray(newConfig.offices) || newConfig.offices.length === 0) {
      throw new Error('JSON de configuración inválido.');
    }
    this.state.config = newConfig;
    this.applyActiveTheme();
    await this.persistConfigToCloud();
    this.emit('config_changed');
    if (this.state.mode === 'online') await this.syncData(true);
  }

  async resetToDefaults() {
    await this.replaceFullConfig(structuredClone(DEFAULT_CONFIG));
  }
}
