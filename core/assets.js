/**
 * CAPA DE ASSETS VISUALES (core/assets.js)
 * Carga automáticamente las ilustraciones de salas desde ./assets/rooms/<id>.(jpg|png|webp),
 * además de permitir sobrescribir cualquier sala con una imagen cargada localmente o una URL.
 */

import { ROOM_TEMPLATES } from '../config/rooms.js';

const LS_KEY_CUSTOM_ROOMS = 'menachaos_os_custom_rooms_v3';

export class RoomAssetManager {
  constructor(onAssetLoaded) {
    this.onAssetLoaded = onAssetLoaded;
    this.cache = new Map(); // key -> { status: 'loading'|'loaded'|'missing', img, src }
    this.customOverrides = this.loadLocalOverrides();
    this.preloadBuiltInTemplates();
  }

  loadLocalOverrides() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY_CUSTOM_ROOMS) || '{}');
    } catch {
      return {};
    }
  }

  saveLocalOverrides() {
    try {
      localStorage.setItem(LS_KEY_CUSTOM_ROOMS, JSON.stringify(this.customOverrides));
    } catch (e) {
      console.warn('No se pudo guardar override local (cuota excedida):', e);
    }
  }

  preloadBuiltInTemplates() {
    Object.values(ROOM_TEMPLATES).forEach((tpl) => {
      this.resolveTemplateImage(tpl.id);
    });
  }

  setCustomRoomImage(roomId, dataUrl) {
    if (!dataUrl) {
      delete this.customOverrides[roomId];
    } else {
      this.customOverrides[roomId] = dataUrl;
    }
    this.saveLocalOverrides();
    this.cache.delete('tpl:' + roomId);
    this.resolveTemplateImage(roomId);
  }

  getTemplateStatus(roomId) {
    const entry = this.cache.get('tpl:' + roomId);
    return entry ? entry.status : 'missing';
  }

  getTemplateSrc(roomId) {
    const entry = this.cache.get('tpl:' + roomId);
    return entry && entry.status === 'loaded' ? entry.src : null;
  }

  resolveTemplateImage(roomId) {
    const key = 'tpl:' + roomId;
    if (this.cache.has(key)) return this.cache.get(key);

    // 1. Si el usuario subió un override local en el navegador
    if (this.customOverrides[roomId]) {
      return this.loadImageKey(key, [this.customOverrides[roomId]]);
    }

    // 2. Intentar cargar desde assets/rooms/<fileBase>.(jpg|png|webp)
    const tpl = ROOM_TEMPLATES[roomId];
    if (!tpl) return { status: 'missing', img: null, src: null };
    const candidates = [
      `./assets/rooms/${tpl.fileBase}.jpg`,
      `./assets/rooms/${tpl.fileBase}.png`,
      `./assets/rooms/${tpl.fileBase}.webp`
    ];
    return this.loadImageKey(key, candidates);
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
    const entry = this.resolveTemplateImage(roomStyleId);
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

/**
 * Comprime una imagen subida por el usuario a JPEG ligero (~90KB)
 * para poder guardarla al instante en localStorage como vista previa.
 */
export function compressImageFileToDataUrl(file, maxSize = 680, quality = 0.84) {
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
