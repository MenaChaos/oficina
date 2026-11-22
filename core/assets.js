/**
 * CAPA DE ASSETS VISUALES (core/assets.js)
 * Carga automáticamente las ilustraciones de salas y del Edificio Completo
 * desde ./assets/rooms/<id>.(jpg|png|webp), además de permitir pruebas locales.
 */

import { ROOM_TEMPLATES, BUILDING_FLOORPLAN } from '../config/rooms.js';

const LS_KEY_CUSTOM_ROOMS = 'menachaos_os_custom_rooms_v3';

export class RoomAssetManager {
  constructor(onAssetLoaded) {
    this.onAssetLoaded = onAssetLoaded;
    this.cache = new Map();
    this.customOverrides = this.loadLocalOverrides();
    this.preloadBuiltInTemplates();
  }

  loadLocalOverrides() {
    try { return JSON.parse(localStorage.getItem(LS_KEY_CUSTOM_ROOMS) || '{}'); } catch { return {}; }
  }

  saveLocalOverrides() {
    try {
      localStorage.setItem(LS_KEY_CUSTOM_ROOMS, JSON.stringify(this.customOverrides));
    } catch (e) {
      console.warn('No se pudo guardar override local:', e);
    }
  }

  preloadBuiltInTemplates() {
    this.resolveAssetById(BUILDING_FLOORPLAN.id, BUILDING_FLOORPLAN.fileBase);
    Object.values(ROOM_TEMPLATES).forEach((tpl) => {
      this.resolveAssetById(tpl.id, tpl.fileBase);
    });
  }

  setCustomRoomImage(assetId, dataUrl) {
    if (!dataUrl) delete this.customOverrides[assetId];
    else this.customOverrides[assetId] = dataUrl;
    this.saveLocalOverrides();
    this.cache.delete('tpl:' + assetId);
    const fileBase = assetId === BUILDING_FLOORPLAN.id
      ? BUILDING_FLOORPLAN.fileBase
      : (ROOM_TEMPLATES[assetId]?.fileBase || assetId);
    this.resolveAssetById(assetId, fileBase);
  }

  getTemplateStatus(assetId) {
    const entry = this.cache.get('tpl:' + assetId);
    return entry ? entry.status : 'missing';
  }

  getTemplateSrc(assetId) {
    const entry = this.cache.get('tpl:' + assetId);
    return entry && entry.status === 'loaded' ? entry.src : null;
  }

  resolveAssetById(assetId, fileBase) {
    const key = 'tpl:' + assetId;
    if (this.cache.has(key)) return this.cache.get(key);

    if (this.customOverrides[assetId]) {
      return this.loadImageKey(key, [this.customOverrides[assetId]]);
    }

    const candidates = [
      `./assets/rooms/${fileBase}.jpg`,
      `./assets/rooms/${fileBase}.png`,
      `./assets/rooms/${fileBase}.webp`
    ];
    return this.loadImageKey(key, candidates);
  }

  getBuildingImage(office = null) {
    if (office && office.floorplanImageUrl) {
      const custom = this.resolveCustomUrl(office.floorplanImageUrl);
      if (custom && custom.status === 'loaded') return custom.img;
    }
    const entry = this.resolveAssetById(BUILDING_FLOORPLAN.id, BUILDING_FLOORPLAN.fileBase);
    return entry && entry.status === 'loaded' ? entry.img : null;
  }

  resolveCustomUrl(url) {
    if (!url) return null;
    const key = 'url:' + url;
    if (this.cache.has(key)) return this.cache.get(key);
    return this.loadImageKey(key, [url]);
  }

  getImageForAgent(agent, roomStyleId) {
    if (agent && agent.roomImageUrl) {
      const custom = this.resolveCustomUrl(agent.roomImageUrl);
      if (custom && custom.status === 'loaded') return custom.img;
    }
    const tpl = ROOM_TEMPLATES[roomStyleId];
    if (!tpl) return null;
    const entry = this.resolveAssetById(tpl.id, tpl.fileBase);
    return entry && entry.status === 'loaded' ? entry.img : null;
  }

  loadImageKey(key, urls) {
    const entry = { status: 'loading', img: null, src: null };
    this.cache.set(key, entry);

    const tryIndex = (idx) => {
      if (idx >= urls.length) {
        entry.status = 'missing';
        if (this.onAssetLoaded) this.onAssetLoaded(key, false);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        entry.status = 'loaded';
        entry.img = img;
        entry.src = urls[idx];
        if (this.onAssetLoaded) this.onAssetLoaded(key, true);
      };
      img.onerror = () => tryIndex(idx + 1);
      img.src = urls[idx];
    };

    tryIndex(0);
    return entry;
  }
}

export function compressImageFileToDataUrl(file, maxSize = 1100, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen inválido.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
