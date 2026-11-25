/**
 * CAPA DE ASSETS VISUALES v3.3 (core/assets.js)
 * - Carga salas y edificio desde ./assets/rooms/<id>.(jpg|png|webp)
 * - Carga personajes Cozy 3D desde ./assets/avatars/<id>.(jpg|png|webp)
 * - Recorta automáticamente fondos sólidos (verde #00FF00, magenta #FF00FF, etc.)
 *   a sprites con transparencia nítida, despill de bordes y auto-encuadre en los pies.
 */

import { ROOM_TEMPLATES, BUILDING_FLOORPLAN } from '../config/rooms.js?v=3.8';
import { AVATAR_TEMPLATES } from '../config/avatars.js?v=3.8';

const LS_KEY_CUSTOM_ROOMS = 'menachaos_os_custom_rooms_v3';
const LS_KEY_CUSTOM_AVATARS = 'menachaos_os_custom_avatars_v3';

export class RoomAssetManager {
  constructor(onAssetLoaded) {
    this.onAssetLoaded = onAssetLoaded;
    this.cache = new Map();
    this.customOverrides = this.loadMap(LS_KEY_CUSTOM_ROOMS);
    this.customAvatars = this.loadMap(LS_KEY_CUSTOM_AVATARS);
    this.preloadBuiltInTemplates();
  }

  loadMap(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  }

  saveMap(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { console.warn('localStorage full:', e); }
  }

  preloadBuiltInTemplates() {
    this.resolveRoomById(BUILDING_FLOORPLAN.id, BUILDING_FLOORPLAN.fileBase);
    Object.values(ROOM_TEMPLATES).forEach((tpl) => this.resolveRoomById(tpl.id, tpl.fileBase));
    Object.values(AVATAR_TEMPLATES).forEach((av) => this.resolveAvatarById(av.id, av.fileBase));
  }

  // ---- Salas & Edificio ----
  setCustomRoomImage(assetId, dataUrl) {
    if (!dataUrl) delete this.customOverrides[assetId];
    else this.customOverrides[assetId] = dataUrl;
    this.saveMap(LS_KEY_CUSTOM_ROOMS, this.customOverrides);
    this.cache.delete('tpl:' + assetId);
    const fileBase = assetId === BUILDING_FLOORPLAN.id
      ? BUILDING_FLOORPLAN.fileBase
      : (ROOM_TEMPLATES[assetId]?.fileBase || assetId);
    this.resolveRoomById(assetId, fileBase);
  }

  getTemplateStatus(assetId) {
    const entry = this.cache.get('tpl:' + assetId);
    return entry ? entry.status : 'missing';
  }

  getTemplateSrc(assetId) {
    const entry = this.cache.get('tpl:' + assetId);
    return entry && entry.status === 'loaded' ? entry.src : null;
  }

  resolveRoomById(assetId, fileBase) {
    const key = 'tpl:' + assetId;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.customOverrides[assetId]) {
      return this.loadImageKey(key, [this.customOverrides[assetId]], false);
    }
    const candidates = [
      `./assets/rooms/${fileBase}.jpg`,
      `./assets/rooms/${fileBase}.png`,
      `./assets/rooms/${fileBase}.webp`
    ];
    return this.loadImageKey(key, candidates, false);
  }

  getBuildingImage(office = null) {
    if (office && office.floorplanImageUrl) {
      const custom = this.resolveCustomUrl(office.floorplanImageUrl, false);
      if (custom && custom.status === 'loaded') return custom.img;
    }
    const entry = this.resolveRoomById(BUILDING_FLOORPLAN.id, BUILDING_FLOORPLAN.fileBase);
    return entry && entry.status === 'loaded' ? entry.img : null;
  }

  getImageForAgent(agent, roomStyleId) {
    if (agent && agent.roomImageUrl) {
      const custom = this.resolveCustomUrl(agent.roomImageUrl, false);
      if (custom && custom.status === 'loaded') return custom.img;
    }
    const tpl = ROOM_TEMPLATES[roomStyleId];
    if (!tpl) return null;
    const entry = this.resolveRoomById(tpl.id, tpl.fileBase);
    return entry && entry.status === 'loaded' ? entry.img : null;
  }

  // ---- Personajes Cozy (Sprites con recorte automático) ----
  setCustomAvatarImage(avatarId, dataUrl) {
    if (!dataUrl) delete this.customAvatars[avatarId];
    else this.customAvatars[avatarId] = dataUrl;
    this.saveMap(LS_KEY_CUSTOM_AVATARS, this.customAvatars);
    this.cache.delete('av:' + avatarId);
    const fileBase = AVATAR_TEMPLATES[avatarId]?.fileBase || avatarId;
    this.resolveAvatarById(avatarId, fileBase);
  }

  getAvatarStatus(avatarId) {
    const entry = this.cache.get('av:' + avatarId);
    return entry ? entry.status : 'missing';
  }

  getAvatarPreviewUrl(avatarId) {
    const entry = this.cache.get('av:' + avatarId);
    if (!entry || entry.status !== 'loaded') return null;
    return entry.previewUrl || entry.src;
  }

  resolveAvatarById(avatarId, fileBase) {
    const key = 'av:' + avatarId;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.customAvatars[avatarId]) {
      return this.loadImageKey(key, [this.customAvatars[avatarId]], true);
    }
    const candidates = [
      `./assets/avatars/${fileBase}.png`,
      `./assets/avatars/${fileBase}.jpg`,
      `./assets/avatars/${fileBase}.webp`
    ];
    return this.loadImageKey(key, candidates, true);
  }

  getAvatarSpriteForAgent(agent) {
    if (agent && agent.avatarImageUrl) {
      const custom = this.resolveCustomUrl(agent.avatarImageUrl, true);
      if (custom && custom.status === 'loaded') return custom.sprite || custom.img;
    }
    const avId = agent?.avatar || 'robot';
    const fileBase = AVATAR_TEMPLATES[avId]?.fileBase || avId;
    const entry = this.resolveAvatarById(avId, fileBase);
    return entry && entry.status === 'loaded' ? (entry.sprite || entry.img) : null;
  }

  resolveCustomUrl(url, isAvatar = false) {
    if (!url) return null;
    const key = (isAvatar ? 'avurl:' : 'url:') + url;
    if (this.cache.has(key)) return this.cache.get(key);
    return this.loadImageKey(key, [url], isAvatar);
  }

  loadImageKey(key, urls, processAsAvatar = false) {
    const entry = { status: 'loading', img: null, sprite: null, previewUrl: null, src: null };
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
        if (processAsAvatar) {
          try {
            const cut = cutoutCharacterSprite(img);
            entry.sprite = cut;
            entry.previewUrl = cut.toDataURL('image/png');
          } catch (err) {
            // Si CORS impide leer píxeles de una URL externa, usar imagen directa
            entry.sprite = img;
            entry.previewUrl = urls[idx];
          }
        }
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
 * Recorta automáticamente cualquier personaje Cozy sobre fondo sólido (verde #00FF00,
 * magenta #FF00FF u otro color uniforme) a un canvas transparente con bordes suaves
 * y auto-recorte pegado a los pies del personaje.
 */
function cutoutCharacterSprite(img) {
  const maxDim = 320;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 320, img.naturalHeight || 320));
  const w = Math.max(32, Math.round((img.naturalWidth || 320) * scale));
  const h = Math.max(32, Math.round((img.naturalHeight || 320) * scale));

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const pxAt = (x, y) => {
    const i = (y * w + x) * 4;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  };

  // 1. Si ya es un PNG transparente nativo, solo hacer auto-recorte
  const cTL = pxAt(4, 4);
  const cTR = pxAt(w - 5, 4);
  const cBL = pxAt(4, h - 5);
  const alreadyTransparent = cTL[3] < 25 && cTR[3] < 25 && cBL[3] < 25;

  if (!alreadyTransparent) {
    // Promediar 3 esquinas limpias (evitamos la inferior derecha por si trae marca de agua)
    const bgR = Math.round((cTL[0] + cTR[0] + cBL[0]) / 3);
    const bgG = Math.round((cTL[1] + cTR[1] + cBL[1]) / 3);
    const bgB = Math.round((cTL[2] + cTR[2] + cBL[2]) / 3);

    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const isUniformBg = dist(cTL, cTR) < 48 && dist(cTL, cBL) < 48;

    if (isUniformBg) {
      const isChromaGreen = bgG > bgR + 65 && bgG > bgB + 65 && bgG > 140;
      const isChromaMagenta = bgR > bgG + 65 && bgB > bgG + 65 && bgR > 140 && bgB > 140;

      const hardThresh = isChromaGreen || isChromaMagenta ? 105 : 52;
      const removed = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let qHead = 0, qTail = 0;

      const isBgPixel = (idx) => {
        const i = idx * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dr = r - bgR, dg = g - bgG, db = b - bgB;
        if (dr * dr + dg * dg + db * db <= hardThresh * hardThresh) return true;
        if (isChromaGreen && g > r + 42 && g > b + 42 && g > 105) return true;
        if (isChromaMagenta && r > g + 42 && b > g + 42 && r > 105 && b > 105) return true;
        return false;
      };

      const enqueue = (x, y) => {
        const idx = y * w + x;
        if (removed[idx]) return;
        if (isBgPixel(idx)) {
          removed[idx] = 1;
          queue[qTail++] = idx;
        }
      };

      // Limpiar esquina inferior derecha (posible marca de agua aislada del personaje centrado)
      const wmX = Math.floor(w * 0.85);
      const wmY = Math.floor(h * 0.85);
      for (let y = wmY; y < h; y++) {
        for (let x = wmX; x < w; x++) {
          const idx = y * w + x;
          removed[idx] = 1;
          queue[qTail++] = idx;
        }
      }

      // Iniciar BFS desde los 4 bordes exteriores
      for (let x = 0; x < w; x++) { enqueue(x, 0); enqueue(x, h - 1); }
      for (let y = 0; y < h; y++) { enqueue(0, y); enqueue(w - 1, y); }

      while (qHead < qTail) {
        const curr = queue[qHead++];
        const cx = curr % w;
        const cy = (curr - cx) / w;
        if (cx > 0) enqueue(cx - 1, cy);
        if (cx + 1 < w) enqueue(cx + 1, cy);
        if (cy > 0) enqueue(cx, cy - 1);
        if (cy + 1 < h) enqueue(cx, cy + 1);
      }

      // En fondos chroma puros (verde/magenta), limpiar también huecos cerrados (entre piernas/brazos)
      if (isChromaGreen || isChromaMagenta) {
        for (let idx = 0; idx < w * h; idx++) {
          if (removed[idx]) continue;
          const i = idx * 4;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (isChromaGreen && g > r + 52 && g > b + 52 && g > 125) removed[idx] = 1;
          if (isChromaMagenta && r > g + 52 && b > g + 52 && r > 125 && b > 125) removed[idx] = 1;
        }
      }

      // Aplicar transparencia a los píxeles de fondo
      for (let idx = 0; idx < w * h; idx++) {
        if (removed[idx]) d[idx * 4 + 3] = 0;
      }

      // Pasada de suavizado y eliminación de halo (despill) en el contorno de 2 píxeles
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const i = idx * 4;
            if (d[i + 3] === 0) continue;

            const touchesTrans =
              d[((y - 1) * w + x) * 4 + 3] < 40 ||
              d[((y + 1) * w + x) * 4 + 3] < 40 ||
              d[(y * w + (x - 1)) * 4 + 3] < 40 ||
              d[(y * w + (x + 1)) * 4 + 3] < 40;

            if (!touchesTrans) continue;

            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (isChromaGreen) {
              const spill = g - Math.max(r, b);
              if (spill > 10) {
                d[i + 1] = Math.max(r, b);
                if (spill > 26) d[i + 3] = Math.max(0, Math.round(d[i + 3] - spill * 2.8));
              }
            } else if (isChromaMagenta) {
              const spill = Math.min(r, b) - g;
              if (spill > 10) {
                d[i] = Math.max(0, Math.round(r - spill * 0.72));
                d[i + 2] = Math.max(0, Math.round(b - spill * 0.72));
                if (spill > 26) d[i + 3] = Math.max(0, Math.round(d[i + 3] - spill * 2.8));
              }
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }
  }

  // Auto-recorte limpio al contorno del personaje (para que sus pies queden exactos en el borde inferior)
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return c;

  const pad = 4;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(w - sx, maxX - minX + pad * 2 + 1);
  const sh = Math.min(h - sy, maxY - minY + pad * 2 + 1);

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

export function compressImageFileToDataUrl(file, maxSize = 1100, quality = 0.88) {
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
        // Si es PNG mantener PNG para conservar transparencia nativa
        const isPng = file.type === 'image/png';
        resolve(c.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
