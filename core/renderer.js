/**
 * MOTOR VISUAL HÍBRIDO COZY 2.5D (core/renderer.js)
 * Soporta dos modos intercambiables en vivo:
 * 1) 'cozy-rooms' (Opción B): Cada agente en su propia habitación diorama ilustrada
 *    con personaje animado, semáforo, brillo cálido, resumen en vivo y burbujas encima.
 * 2) 'open-floor': Planta abierta isométrica clásica.
 */

import { getTheme } from '../themes/themes.js';
import { getRoomTemplate } from '../config/rooms.js';

const STATUS_COLORS = {
  VERDE: '#22c55e',
  AMARILLO: '#f59e0b',
  ROJO: '#ef4444',
  PAUSADO: '#94a3b8'
};

export class OfficeRenderer {
  constructor(canvas, assetManager, onSelectAgent) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assetManager;
    this.onSelectAgent = onSelectAgent;

    this.agents = [];
    this.agentData = {};
    this.themeId = 'cozy-warm';
    this.layoutMode = 'cozy-rooms';
    this.selectedAgentId = null;

    this.cam = { x: 0, y: 0, zoom: 1 };
    this.hitBoxes = [];
    this.bubbles = new Map();
    this.remodelProgress = 1;

    // Partículas cálidas flotantes (ambiente cozy)
    this.motes = Array.from({ length: 28 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.2 + Math.random() * 2.2,
      s: 0.25 + Math.random() * 0.55,
      p: Math.random() * Math.PI * 2
    }));

    this.pointers = new Map();
    this.dragging = false;
    this.dragMoved = false;
    this.dragStart = { x: 0, y: 0, camX: 0, camY: 0 };
    this.pinchStartDist = null;
    this.pinchStartZoom = 1;

    this.t = 0;
    this.rafId = null;

    this.bindEvents();
    this.resize();
    this.startLoop();
  }

  setScene({ agents, agentData, themeId, layoutMode, selectedAgentId, triggerRemodel = false }) {
    this.agents = agents || [];
    this.agentData = agentData || {};
    if (themeId && themeId !== this.themeId) {
      this.themeId = themeId;
      this.remodelProgress = 0;
    }
    if (layoutMode && layoutMode !== this.layoutMode) {
      this.layoutMode = layoutMode;
      this.resetCamera();
      this.remodelProgress = 0;
    } else if (triggerRemodel) {
      this.remodelProgress = 0;
    }
    if (selectedAgentId !== undefined) {
      this.selectedAgentId = selectedAgentId;
    }
  }

  say(agentId, text, durationMs = 4800) {
    this.bubbles.set(agentId, { text, until: performance.now() + durationMs });
  }

  resetCamera() {
    this.cam = { x: 0, y: 0, zoom: 1 };
  }

  zoomBy(factor) {
    this.cam.zoom = Math.max(0.55, Math.min(2.2, this.cam.zoom * factor));
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(300, rect.width);
    this.height = Math.max(260, rect.height);
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1) {
        this.dragging = true;
        this.dragMoved = false;
        this.dragStart = { x: e.clientX, y: e.clientY, camX: this.cam.x, camY: this.cam.y };
      } else if (this.pointers.size === 2) {
        this.dragging = false;
        const pts = Array.from(this.pointers.values());
        this.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        this.pinchStartZoom = this.cam.zoom;
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 2 && this.pinchStartDist) {
        const pts = Array.from(this.pointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        this.cam.zoom = Math.max(0.55, Math.min(2.2, this.pinchStartZoom * (dist / this.pinchStartDist)));
        this.dragMoved = true;
        return;
      }

      if (this.dragging) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (Math.hypot(dx, dy) > 6) this.dragMoved = true;
        this.cam.x = this.dragStart.camX + dx;
        this.cam.y = this.dragStart.camY + dy;
      }
    });

    const endPointer = (e) => {
      const wasClick = this.dragging && !this.dragMoved && this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStartDist = null;
      if (this.pointers.size === 0) this.dragging = false;

      if (wasClick) {
        const rect = this.canvas.getBoundingClientRect();
        this.handleClick(e.clientX - rect.left, e.clientY - rect.top);
      }
    };

    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.09 : 0.92);
      },
      { passive: false }
    );
  }

  handleClick(px, py) {
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const hb = this.hitBoxes[i];
      if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) {
        this.selectedAgentId = hb.agentId;
        if (this.onSelectAgent) this.onSelectAgent(hb.agentId);
        return;
      }
    }
  }

  startLoop() {
    const loop = () => {
      this.t += 0.03;
      if (this.remodelProgress < 1) {
        this.remodelProgress = Math.min(1, this.remodelProgress + 0.038);
      }
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  draw() {
    const ctx = this.ctx;
    const theme = getTheme(this.themeId).canvas;
    const W = this.width;
    const H = this.height;

    // Fondo degradado suave
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Partículas ambientales cozy
    ctx.save();
    ctx.fillStyle = theme.particleColor || 'rgba(255,220,170,0.35)';
    this.motes.forEach((m) => {
      const mx = ((m.x + Math.sin(this.t * 0.25 * m.s + m.p) * 0.03 + 1) % 1) * W;
      const my = ((m.y - this.t * 0.004 * m.s) % 1 + 1) % 1 * H;
      ctx.globalAlpha = 0.22 + Math.sin(this.t * 1.4 + m.p) * 0.18;
      ctx.beginPath();
      ctx.arc(mx, my, m.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    if (this.layoutMode === 'open-floor') {
      this.drawOpenFloorMode(ctx, theme, W, H);
    } else {
      this.drawCozyRoomsMode(ctx, theme, W, H);
    }

    // Efecto de remodelación cálido al cambiar tema o vista
    if (this.remodelProgress < 1) {
      const sweepX = W * this.remodelProgress;
      ctx.save();
      const beam = ctx.createLinearGradient(sweepX - 90, 0, sweepX + 20, 0);
      beam.addColorStop(0, 'rgba(244,162,97,0)');
      beam.addColorStop(0.75, 'rgba(244,162,97,0.28)');
      beam.addColorStop(1, 'rgba(255,248,235,0.62)');
      ctx.fillStyle = beam;
      ctx.fillRect(sweepX - 90, 0, 110, H);
      ctx.restore();
    }
  }

  // ==========================================================================
  // MODO 1: SALAS COZY DIORAMA INDEPENDIENTES (OPCIÓN B — HÍBRIDO)
  // ==========================================================================
  drawCozyRoomsMode(ctx, theme, W, H) {
    this.hitBoxes = [];
    const agents = this.agents;
    const count = agents.length;
    if (count === 0) return;

    // Calcular cuadrícula equilibrada según proporción de pantalla (iPad horizontal/vertical o monitor)
    const isPortrait = H > W * 1.05;
    let cols = isPortrait ? 2 : count <= 2 ? count : count <= 4 ? 2 : count <= 6 ? 3 : 4;
    if (W < 640) cols = 1;
    const rows = Math.ceil(count / cols);

    // Espacio útil respetando HUD superior y quickbar inferior
    const padTop = 76;
    const padBottom = 80;
    const padSide = 26;
    const availW = Math.max(280, W - padSide * 2);
    const availH = Math.max(240, H - padTop - padBottom);

    const gap = 24;
    const maxCardW = (availW - gap * (cols - 1)) / cols;
    const maxCardH = (availH - gap * (rows - 1)) / rows;
    // Proporción elegante para el diorama 1:1 + pie con título y estado vivo
    const cardW = Math.max(210, Math.min(365, maxCardW, maxCardH * 0.94));
    const cardH = Math.round(cardW * 1.07);

    const totalH = rows * cardH + (rows - 1) * gap;
    const baseStartY = padTop + Math.max(0, (availH - totalH) / 2);

    ctx.save();
    ctx.translate(W / 2 + this.cam.x, H / 2 + this.cam.y);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-W / 2, -H / 2);

    agents.forEach((agent, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      // Centrar la última fila cuando tiene menos elementos (ej: 3 arriba + 2 abajo)
      const itemsInRow = row === rows - 1 ? count - row * cols : cols;
      const rowW = itemsInRow * cardW + (itemsInRow - 1) * gap;
      const startX = (W - rowW) / 2;

      const x = startX + col * (cardW + gap);
      const y = baseStartY + row * (cardH + gap);

      this.drawCozyRoomCard(ctx, x, y, cardW, cardH, agent, theme);

      // Registrar hitbox en coordenadas de pantalla transformadas
      const sx = (x - W / 2) * this.cam.zoom + W / 2 + this.cam.x;
      const sy = (y - H / 2) * this.cam.zoom + H / 2 + this.cam.y;
      this.hitBoxes.push({
        agentId: agent.id,
        x: sx,
        y: sy,
        w: cardW * this.cam.zoom,
        h: cardH * this.cam.zoom
      });
    });

    ctx.restore();
  }

  drawCozyRoomCard(ctx, x, y, w, h, agent, theme) {
    const live = this.agentData[agent.id] || {};
    const status = agent.enabled === false ? 'PAUSADO' : live.status || 'VERDE';
    const activity = agent.enabled === false ? 'idle' : live.activity || 'idle';
    const isSelected = this.selectedAgentId === agent.id;
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.VERDE;
    const tpl = getRoomTemplate(agent.roomStyle, agent);
    const accentColor = agent.roomAccent || tpl.accent;

    const r = 22;

    // Halo exterior suave (selección o alerta roja pulsante)
    if (isSelected || status === 'ROJO' || activity === 'working') {
      const pulse = 0.55 + Math.sin(this.t * 4) * 0.28;
      ctx.save();
      ctx.shadowColor = isSelected ? accentColor : statusColor;
      ctx.shadowBlur = isSelected ? 26 : 18 + pulse * 10;
      ctx.strokeStyle = isSelected ? accentColor : statusColor;
      ctx.lineWidth = isSelected ? 2.6 : 1.8;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }

    // Fondo de tarjeta sala
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = theme.roomCardBg || '#212327';
    ctx.fill();
    ctx.clip();

    // Área visual del diorama (parte superior cuadrada)
    const imgSize = w;
    const imgY = y - w * 0.04;
    const roomImg = this.assets ? this.assets.getImageForAgent(agent, tpl.id) : null;

    if (roomImg) {
      // Dibujar ilustración cozy centrada con zoom ligero para llenar bien el marco
      const drawPad = w * 0.02;
      ctx.drawImage(roomImg, x - drawPad, imgY - drawPad, imgSize + drawPad * 2, imgSize + drawPad * 2);

      // Brillo cálido sutil respirando (sensación de lámpara viva)
      const lampPulse = 0.75 + Math.sin(this.t * 1.8 + x * 0.01) * 0.25;
      const glow = ctx.createRadialGradient(
        x + w * 0.5,
        y + w * 0.45,
        w * 0.06,
        x + w * 0.5,
        y + w * 0.45,
        w * 0.48
      );
      glow.addColorStop(0, tpl.lampGlow || 'rgba(255, 200, 120, 0.22)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = lampPulse * 0.55;
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    } else {
      // Fallback cozy procedimental (si aún no suben el .jpg a assets/rooms/)
      this.drawCozyFallbackDiorama(ctx, x, y, w, h * 0.78, agent, tpl);
    }

    // Degradado inferior para legibilidad impecable del nombre y estado en vivo
    const footGrad = ctx.createLinearGradient(0, y + h * 0.56, 0, y + h);
    footGrad.addColorStop(0, 'rgba(18, 19, 22, 0)');
    footGrad.addColorStop(0.55, 'rgba(18, 19, 22, 0.76)');
    footGrad.addColorStop(1, 'rgba(18, 19, 22, 0.96)');
    ctx.fillStyle = footGrad;
    ctx.fillRect(x, y + h * 0.55, w, h * 0.46);

    // Personaje vivo animado sobre la sala
    const anchor = agent.charAnchor || tpl.defaultAnchor || { x: 0.5, y: 0.65 };
    const bob = activity === 'working' ? Math.abs(Math.sin(this.t * 6.5)) * 4.5 : Math.sin(this.t * 2.2 + x * 0.02) * 2;
    const cx = x + w * anchor.x;
    const cy = y + h * anchor.y - bob;
    const charScale = Math.max(0.85, Math.min(1.25, w / 285));
    this.drawCozyCharacter(ctx, cx, cy, charScale, agent.avatar, status, activity);

    // Etiqueta superior izquierda: tipo de habitación
    ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, sans-serif';
    const roomTag = `${tpl.icon} ${tpl.name}`;
    const tagW = ctx.measureText(roomTag).width + 18;
    ctx.fillStyle = 'rgba(18, 19, 22, 0.74)';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 12, tagW, 24, 999);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f5efe6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(roomTag, x + 21, y + 24);

    // Semáforo superior derecho
    const pillText = status;
    ctx.font = '800 10px -apple-system, BlinkMacSystemFont, sans-serif';
    const pillW = ctx.measureText(pillText).width + 26;
    const pillX = x + w - pillW - 12;
    ctx.fillStyle = 'rgba(18, 19, 22, 0.82)';
    ctx.beginPath();
    ctx.roundRect(pillX, y + 12, pillW, 24, 999);
    ctx.fill();
    ctx.strokeStyle = statusColor;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(pillX + 11, y + 24, status === 'ROJO' ? 4.5 + Math.sin(this.t * 6) * 1 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pillText, pillX + 20, y + 24.5);

    // Pie de la sala: Nombre del agente + dato vivo resumido
    ctx.textAlign = 'left';
    ctx.font = '800 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#fbf6ee';
    ctx.fillText(agent.name, x + 16, y + h - 38);

    const headline = this.getShortHeadline(agent, live);
    ctx.font = '500 11.8px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = status === 'ROJO' ? '#fca5a5' : status === 'AMARILLO' ? '#fcd34d' : '#c7beb2';
    ctx.fillText(this.truncateText(ctx, headline, w - 32), x + 16, y + h - 18);

    // Burbuja de diálogo temporal (cuando disparas una acción o llega alerta)
    const bubble = this.bubbles.get(agent.id);
    if (bubble && bubble.until > performance.now()) {
      ctx.font = '700 11px -apple-system, sans-serif';
      const bText = this.truncateText(ctx, bubble.text, w - 44);
      const bw = ctx.measureText(bText).width + 20;
      const bx = Math.max(x + 12, Math.min(x + w - bw - 12, cx - bw / 2));
      const by = Math.max(y + 42, cy - 52 * charScale);
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 25, 10);
      ctx.fill();
      ctx.fillStyle = '#1f1a17';
      ctx.textAlign = 'center';
      ctx.fillText(bText, bx + bw / 2, by + 13);
    }

    ctx.restore();

    // Borde sutil de la tarjeta
    ctx.strokeStyle = isSelected ? accentColor : theme.roomCardBorder || 'rgba(255,255,255,0.12)';
    ctx.lineWidth = isSelected ? 2.2 : 1.1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }

  drawCozyFallbackDiorama(ctx, x, y, w, h, agent, tpl) {
    // Mini diorama isométrico cálido mientras se suben las imágenes .jpg a assets/rooms/
    const cx = x + w / 2;
    const cy = y + h * 0.56;
    const s = w * 0.34;

    const grad = ctx.createRadialGradient(cx, cy - s * 0.25, 8, cx, cy, s * 1.45);
    grad.addColorStop(0, tpl.lampGlow || 'rgba(244,162,97,0.32)');
    grad.addColorStop(1, 'rgba(20,21,24,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Piso rombo cálido
    this.drawPoly(
      ctx,
      [
        { x: cx, y: cy - s * 0.45 },
        { x: cx + s, y: cy + s * 0.05 },
        { x: cx, y: cy + s * 0.55 },
        { x: cx - s, y: cy + s * 0.05 }
      ],
      tpl.floorColor,
      'rgba(255,240,220,0.14)',
      1.2
    );
    // Pared izquierda
    this.drawPoly(
      ctx,
      [
        { x: cx - s, y: cy + s * 0.05 },
        { x: cx, y: cy - s * 0.45 },
        { x: cx, y: cy - s * 1.18 },
        { x: cx - s, y: cy - s * 0.68 }
      ],
      tpl.wallColor,
      'rgba(0,0,0,0.2)',
      1
    );
    // Pared derecha
    this.drawPoly(
      ctx,
      [
        { x: cx, y: cy - s * 0.45 },
        { x: cx + s, y: cy + s * 0.05 },
        { x: cx + s, y: cy - s * 0.68 },
        { x: cx, y: cy - s * 1.18 }
      ],
      '#3a322c',
      'rgba(0,0,0,0.2)',
      1
    );

    // Sello de sala en espera de imagen
    ctx.font = '600 10.5px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 244, 230, 0.55)';
    ctx.textAlign = 'center';
    ctx.fillText(`assets/rooms/${tpl.fileBase}.jpg`, cx, y + h * 0.9);
  }

  drawCozyCharacter(ctx, cx, cy, scale, avatar, status, activity) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Sombra suave bajo el personaje
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 16, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aro sutil de actividad si está trabajando o en alerta
    if (activity === 'working' || status === 'ROJO') {
      ctx.strokeStyle = status === 'ROJO' ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 12, 20 + Math.sin(this.t * 5) * 2.5, 8.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bodyColors = {
      contador: '#3b82f6',
      combustible: '#dc2626',
      mecanico: '#d97706',
      perro: '#9a5b25',
      profesor: '#f1f5f9',
      bateria: '#059669',
      robot: '#7c3aed',
      servidor: '#0891b2',
      camara: '#64748b'
    };

    // Cuerpo estilo chibi cozy con contorno oscuro suave
    ctx.fillStyle = bodyColors[avatar] || '#f4a261';
    ctx.strokeStyle = 'rgba(20, 16, 14, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-10, -8, 20, 20, 8);
    ctx.fill();
    ctx.stroke();

    // Cabeza
    ctx.fillStyle = avatar === 'perro' ? '#b4692c' : avatar === 'robot' ? '#cbd5e1' : '#fde2b8';
    ctx.beginPath();
    ctx.arc(0, -16, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ojitos cozy
    ctx.fillStyle = '#1f1a17';
    ctx.beginPath();
    ctx.arc(-3.5, -16, 1.5, 0, Math.PI * 2);
    ctx.arc(3.5, -16, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Rasgos característicos
    if (avatar === 'profesor') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-7.5, -19.5, 6.2, 5.2);
      ctx.fillRect(1.3, -19.5, 6.2, 5.2);
      ctx.strokeRect(-7.5, -19.5, 6.2, 5.2);
      ctx.strokeRect(1.3, -19.5, 6.2, 5.2);
    } else if (avatar === 'perro') {
      ctx.fillStyle = '#783f15';
      ctx.beginPath();
      ctx.roundRect(-13.5, -19, 4.5, 10, 2.5);
      ctx.roundRect(9, -19, 4.5, 10, 2.5);
      ctx.fill();
      ctx.fillStyle = '#1f1a17';
      ctx.beginPath();
      ctx.arc(0, -12.5, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (avatar === 'mecanico') {
      // Gorra de mecánico
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(0, -20, 10, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-10, -21, 16, 3);
    } else if (avatar === 'robot') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -26.5);
      ctx.lineTo(0, -33);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -34, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  getShortHeadline(agent, live) {
    if (agent.enabled === false) return 'Agente pausado';
    if (!live || Object.keys(live).length === 0) return 'Esperando sincronización...';
    if (live.error) return 'Error: ' + live.error;
    if (agent.adapter === 'servicios_hogar' && live.metrics) {
      return live.metrics.pendingCount > 0
        ? `${live.metrics.pendingCount} pendiente(s) · ${live.metrics.totalPendingDisplay}`
        : 'Todas las cuentas al día ✓';
    }
    if (agent.adapter === 'combustible_copec' && live.lastReceipt) {
      return `Última: ${live.lastReceipt.combustible} ${live.lastReceipt.montoDisplay} · ${live.metrics?.pendingReimbursementsCount ?? 0} pend.`;
    }
    if (agent.adapter === 'mg6_mecanico' && live.telemetry) {
      const uv = live.telemetry.ultimoViaje || {};
      return `${live.telemetry.estadoGeneral} · ${uv.tempMaxC || '-'}°C · ${uv.voltajeMinV || '-'}V`;
    }
    return live.headline || 'Operativo';
  }

  truncateText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 4 && ctx.measureText(s + '…').width > maxW) {
      s = s.slice(0, -1);
    }
    return s + '…';
  }

  // ==========================================================================
  // MODO 2: PLANTA ABIERTA ISOMÉTRICA CLÁSICA (OPCIONAL)
  // ==========================================================================
  iso(gx, gy, gz = 0) {
    return { x: (gx - gy) * 38, y: (gx + gy) * 19 - gz };
  }

  computeOpenLayout(count) {
    const baseSlots = [
      { gx: 1.5, gy: 1.4 },
      { gx: 4.6, gy: 1.3 },
      { gx: 7.5, gy: 1.7 },
      { gx: 1.5, gy: 5.7 },
      { gx: 7.4, gy: 5.7 },
      { gx: 4.5, gy: 6.5 }
    ];
    const slots = [];
    for (let i = 0; i < count; i++) {
      if (i < baseSlots.length) slots.push(baseSlots[i]);
      else slots.push({ gx: 1.6 + ((i - 6) % 3) * 2.9, gy: 8.8 + Math.floor((i - 6) / 3) * 2.4 });
    }
    return { gridCols: 9, gridRows: count > 6 ? 11 : 8, slots };
  }

  drawOpenFloorMode(ctx, theme, W, H) {
    const layout = this.computeOpenLayout(this.agents.length);
    const scaleBase = Math.min(W / 690, H / 470);
    const scale = Math.max(0.75, Math.min(1.55, scaleBase)) * this.cam.zoom;

    const centerTile = this.iso(layout.gridCols / 2, layout.gridRows / 2, 0);
    const originX = W / 2 - centerTile.x * scale + this.cam.x;
    const originY = H / 2 - centerTile.y * scale + 26 * scale + this.cam.y;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);

    this.drawBox(ctx, 0, 0, layout.gridCols, layout.gridRows, -14, theme.floorA, theme.floorEdge, theme.floorEdge);
    for (let x = 0; x < layout.gridCols; x++) {
      for (let y = 0; y < layout.gridRows; y++) {
        this.drawPoly(
          ctx,
          [this.iso(x, y, 0), this.iso(x + 1, y, 0), this.iso(x + 1, y + 1, 0), this.iso(x, y + 1, 0)],
          (x + y) % 2 === 0 ? theme.floorA : theme.floorB,
          theme.floorGrid,
          0.8
        );
      }
    }

    const wallH = 74;
    const o = this.iso(0, 0, 0);
    const rx = this.iso(layout.gridCols, 0, 0);
    const ly = this.iso(0, layout.gridRows, 0);
    const ot = this.iso(0, 0, wallH);
    const rxt = this.iso(layout.gridCols, 0, wallH);
    const lyt = this.iso(0, layout.gridRows, wallH);
    this.drawPoly(ctx, [o, ly, lyt, ot], theme.wallLeft, 'rgba(0,0,0,0.2)', 1);
    this.drawPoly(ctx, [o, rx, rxt, ot], theme.wallRight, 'rgba(0,0,0,0.2)', 1);

    this.hitBoxes = [];
    const drawList = this.agents.map((agent, idx) => ({ agent, pos: layout.slots[idx] || { gx: 2, gy: 2 } }));
    drawList.sort((a, b) => a.pos.gx + a.pos.gy - (b.pos.gx + b.pos.gy));

    drawList.forEach(({ agent, pos }) => {
      const live = this.agentData[agent.id] || {};
      const status = agent.enabled === false ? 'PAUSADO' : live.status || 'VERDE';
      const activity = agent.enabled === false ? 'idle' : live.activity || 'idle';
      this.drawBox(ctx, pos.gx - 0.45, pos.gy - 0.3, 1.25, 0.68, 16, theme.deskTop, theme.deskSide, '#0f172a');
      const charPt = this.iso(pos.gx + 0.15, pos.gy + 0.62, 16);
      this.drawCozyCharacter(ctx, charPt.x, charPt.y, 0.85, agent.avatar, status, activity);

      const labelPt = this.iso(pos.gx + 0.15, pos.gy + 0.95, -10);
      ctx.font = '700 11px -apple-system, sans-serif';
      const tw = ctx.measureText(agent.name).width + 16;
      ctx.fillStyle = theme.labelBg;
      ctx.beginPath();
      ctx.roundRect(labelPt.x - tw / 2, labelPt.y - 10, tw, 20, 7);
      ctx.fill();
      ctx.fillStyle = theme.labelText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(agent.name, labelPt.x, labelPt.y);

      const pt = this.iso(pos.gx, pos.gy, 0);
      this.hitBoxes.push({
        agentId: agent.id,
        x: originX + pt.x * scale - 58 * scale,
        y: originY + pt.y * scale - 76 * scale,
        w: 116 * scale,
        h: 98 * scale
      });
    });

    ctx.restore();
  }

  drawPoly(ctx, pts, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  drawBox(ctx, gx, gy, w, d, h, topColor, leftColor, rightColor, stroke = null) {
    const p00 = this.iso(gx, gy, 0), p10 = this.iso(gx + w, gy, 0), p11 = this.iso(gx + w, gy + d, 0), p01 = this.iso(gx, gy + d, 0);
    const t00 = this.iso(gx, gy, h), t10 = this.iso(gx + w, gy, h), t11 = this.iso(gx + w, gy + d, h), t01 = this.iso(gx, gy + d, h);
    this.drawPoly(ctx, [p01, p11, t11, t01], leftColor, stroke, 0.7);
    this.drawPoly(ctx, [p10, p11, t11, t10], rightColor, stroke, 0.7);
    this.drawPoly(ctx, [t00, t10, t11, t01], topColor, stroke, 0.8);
  }
}
