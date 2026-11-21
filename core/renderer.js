/**
 * MOTOR VISUAL ISOMÉTRICO 2.5D (core/renderer.js)
 * Totalmente agnóstico a los datos: dibuja cualquier número de agentes,
 * en cualquier oficina y con cualquier tema de themes/themes.js.
 */

import { getTheme } from '../themes/themes.js';

const STATUS_COLORS = {
  VERDE: '#22c55e',
  AMARILLO: '#f59e0b',
  ROJO: '#ef4444',
  PAUSADO: '#94a3b8'
};

export class OfficeRenderer {
  constructor(canvas, onSelectAgent) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelectAgent = onSelectAgent;

    this.agents = [];
    this.agentData = {};
    this.themeId = 'cyber-studio';
    this.selectedAgentId = null;

    // Cámara interactiva
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.hitBoxes = [];
    this.bubbles = new Map(); // agentId -> { text, until }
    this.remodelProgress = 1; // < 1 dispara barrido visual de remodelación

    // Estado de arrastre y pellizco táctil
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

  setScene({ agents, agentData, themeId, selectedAgentId, triggerRemodel = false }) {
    this.agents = agents || [];
    this.agentData = agentData || {};
    if (themeId && themeId !== this.themeId) {
      this.themeId = themeId;
      this.remodelProgress = 0;
    } else if (triggerRemodel) {
      this.remodelProgress = 0;
    }
    if (selectedAgentId !== undefined) {
      this.selectedAgentId = selectedAgentId;
    }
  }

  say(agentId, text, durationMs = 4500) {
    this.bubbles.set(agentId, { text, until: performance.now() + durationMs });
  }

  resetCamera() {
    this.cam = { x: 0, y: 0, zoom: 1 };
  }

  zoomBy(factor) {
    this.cam.zoom = Math.max(0.55, Math.min(2.1, this.cam.zoom * factor));
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
        this.cam.zoom = Math.max(0.55, Math.min(2.1, this.pinchStartZoom * (dist / this.pinchStartDist)));
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
        const factor = e.deltaY < 0 ? 1.09 : 0.92;
        this.zoomBy(factor);
      },
      { passive: false }
    );
  }

  handleClick(px, py) {
    // Recorrer de adelante hacia atrás para respetar profundidad isométrica
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const hb = this.hitBoxes[i];
      if (px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h) {
        this.selectedAgentId = hb.agentId;
        if (this.onSelectAgent) this.onSelectAgent(hb.agentId);
        return;
      }
    }
  }

  // Proyección isométrica estándar
  iso(gx, gy, gz = 0) {
    const tileW = 76;
    const tileH = 38;
    const x = (gx - gy) * (tileW / 2);
    const y = (gx + gy) * (tileH / 2) - gz;
    return { x, y };
  }

  /**
   * Genera dinámicamente posiciones en la planta según cuántos agentes tenga la oficina.
   */
  computeLayout(count) {
    const baseSlots = [
      { gx: 1.5, gy: 1.4 },
      { gx: 4.5, gy: 1.4 },
      { gx: 7.4, gy: 1.6 },
      { gx: 1.5, gy: 5.5 },
      { gx: 7.4, gy: 5.5 },
      { gx: 4.5, gy: 6.4 },
      { gx: 1.5, gy: 8.6 },
      { gx: 4.5, gy: 8.8 },
      { gx: 7.4, gy: 8.6 }
    ];

    const gridCols = 9;
    const gridRows = count > 6 ? 11 : 8;

    const slots = [];
    for (let i = 0; i < count; i++) {
      if (i < baseSlots.length) {
        slots.push(baseSlots[i]);
      } else {
        const extra = i - baseSlots.length;
        slots.push({ gx: 1.6 + (extra % 3) * 2.9, gy: 10 + Math.floor(extra / 3) * 2.5 });
      }
    }

    return { gridCols, gridRows: Math.max(gridRows, Math.ceil((count > 9 ? 13 : gridRows))), slots };
  }

  startLoop() {
    const loop = () => {
      this.t += 0.032;
      if (this.remodelProgress < 1) {
        this.remodelProgress = Math.min(1, this.remodelProgress + 0.035);
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

    // Fondo degradado
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const layout = this.computeLayout(this.agents.length);
    const scaleBase = Math.min(W / 860, H / 560);
    const scale = Math.max(0.58, Math.min(1.32, scaleBase)) * this.cam.zoom;

    const centerTile = this.iso(layout.gridCols / 2, layout.gridRows / 2, 0);
    const originX = W / 2 - centerTile.x * scale + this.cam.x;
    const originY = H / 2 - centerTile.y * scale + 28 * scale + this.cam.y;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);

    // 1. Piso isométrico + paredes traseras
    this.drawFloorAndWalls(ctx, layout.gridCols, layout.gridRows, theme);

    // 2. Patio central (cafetera con vapor + rack de servidores)
    this.drawCentralHub(ctx, 4.4, 3.6, theme);

    // 3. Estaciones de agentes ordenadas por profundidad (gx + gy)
    this.hitBoxes = [];
    const drawList = this.agents.map((agent, idx) => ({
      agent,
      pos: layout.slots[idx] || { gx: 2, gy: 2 }
    }));
    drawList.sort((a, b) => a.pos.gx + a.pos.gy - (b.pos.gx + b.pos.gy));

    drawList.forEach(({ agent, pos }) => {
      const live = this.agentData[agent.id] || {};
      const status = agent.enabled === false ? 'PAUSADO' : live.status || 'VERDE';
      const activity = agent.enabled === false ? 'idle' : live.activity || 'idle';
      const screenPt = this.iso(pos.gx, pos.gy, 0);

      this.drawStation(ctx, pos.gx, pos.gy, agent, status, activity, theme);

      // Guardar hitbox en coordenadas reales del canvas
      const sx = originX + screenPt.x * scale;
      const sy = originY + screenPt.y * scale;
      this.hitBoxes.push({
        agentId: agent.id,
        x: sx - 58 * scale,
        y: sy - 76 * scale,
        w: 116 * scale,
        h: 98 * scale
      });
    });

    ctx.restore();

    // Efecto visual de remodelación al cambiar de diseño
    if (this.remodelProgress < 1) {
      const sweepX = W * this.remodelProgress;
      ctx.save();
      const beam = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 20, 0);
      beam.addColorStop(0, 'rgba(56,189,248,0)');
      beam.addColorStop(0.7, 'rgba(56,189,248,0.28)');
      beam.addColorStop(1, 'rgba(255,255,255,0.65)');
      ctx.fillStyle = beam;
      ctx.fillRect(sweepX - 80, 0, 100, H);
      ctx.restore();
    }
  }

  drawPoly(ctx, pts, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  drawBox(ctx, gx, gy, w, d, h, topColor, leftColor, rightColor, stroke = null) {
    const p00 = this.iso(gx, gy, 0);
    const p10 = this.iso(gx + w, gy, 0);
    const p11 = this.iso(gx + w, gy + d, 0);
    const p01 = this.iso(gx, gy + d, 0);

    const t00 = this.iso(gx, gy, h);
    const t10 = this.iso(gx + w, gy, h);
    const t11 = this.iso(gx + w, gy + d, h);
    const t01 = this.iso(gx, gy + d, h);

    this.drawPoly(ctx, [p01, p11, t11, t01], leftColor, stroke, 0.7);
    this.drawPoly(ctx, [p10, p11, t11, t10], rightColor, stroke, 0.7);
    this.drawPoly(ctx, [t00, t10, t11, t01], topColor, stroke, 0.8);
  }

  drawFloorAndWalls(ctx, cols, rows, theme) {
    // Base 3D del piso
    this.drawBox(ctx, 0, 0, cols, rows, -14, theme.floorA, theme.floorEdge, theme.floorEdge);

    // Baldosas en damero sutil
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const p0 = this.iso(x, y, 0);
        const p1 = this.iso(x + 1, y, 0);
        const p2 = this.iso(x + 1, y + 1, 0);
        const p3 = this.iso(x, y + 1, 0);
        const fill = (x + y) % 2 === 0 ? theme.floorA : theme.floorB;
        this.drawPoly(ctx, [p0, p1, p2, p3], fill, theme.floorGrid, 0.8);
      }
    }

    // Paredes traseras (izquierda y derecha)
    const wallH = 74;
    const o = this.iso(0, 0, 0);
    const rx = this.iso(cols, 0, 0);
    const ly = this.iso(0, rows, 0);
    const ot = this.iso(0, 0, wallH);
    const rxt = this.iso(cols, 0, wallH);
    const lyt = this.iso(0, rows, wallH);

    this.drawPoly(ctx, [o, ly, lyt, ot], theme.wallLeft, 'rgba(0,0,0,0.2)', 1);
    this.drawPoly(ctx, [o, rx, rxt, ot], theme.wallRight, 'rgba(0,0,0,0.2)', 1);

    // Moldura superior neón / acento
    ctx.strokeStyle = theme.wallTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lyt.x, lyt.y);
    ctx.lineTo(ot.x, ot.y);
    ctx.lineTo(rxt.x, rxt.y);
    ctx.stroke();

    // Ventana panorámica decorativa en pared trasera
    const w1 = this.iso(2.4, 0, 20);
    const w2 = this.iso(6.4, 0, 20);
    const w3 = this.iso(6.4, 0, 56);
    const w4 = this.iso(2.4, 0, 56);
    this.drawPoly(ctx, [w1, w2, w3, w4], 'rgba(56, 189, 248, 0.14)', theme.wallTrim, 1.2);
  }

  drawCentralHub(ctx, gx, gy, theme) {
    // Alfombra lounge
    const p0 = this.iso(gx - 0.9, gy - 0.8, 0.5);
    const p1 = this.iso(gx + 1.3, gy - 0.8, 0.5);
    const p2 = this.iso(gx + 1.3, gy + 1.2, 0.5);
    const p3 = this.iso(gx - 0.9, gy + 1.2, 0.5);
    this.drawPoly(ctx, [p0, p1, p2, p3], theme.loungeRug, theme.loungeBorder, 1.5);

    // Mini Rack de Servidores con LEDs parpadeando
    this.drawBox(ctx, gx - 0.55, gy - 0.45, 0.55, 0.55, 36, '#334155', '#1e293b', '#0f172a', 'rgba(255,255,255,0.12)');
    for (let i = 0; i < 4; i++) {
      const ledPt = this.iso(gx - 0.1, gy - 0.3 + i * 0.1, 28 - i * 5);
      const on = Math.sin(this.t * 3.2 + i * 1.7) > -0.2;
      ctx.fillStyle = on ? (i === 0 ? '#38bdf8' : '#22c55e') : '#1e293b';
      ctx.beginPath();
      ctx.arc(ledPt.x, ledPt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mesita + cafetera con vapor animado
    this.drawBox(ctx, gx + 0.35, gy + 0.15, 0.65, 0.55, 14, theme.deskTop, theme.deskSide, '#0f172a');
    this.drawBox(ctx, gx + 0.5, gy + 0.25, 0.28, 0.28, 26, '#475569', '#334155', '#1e293b');
    const steamBase = this.iso(gx + 0.64, gy + 0.38, 28);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.4;
    for (let s = 0; s < 2; s++) {
      const phase = (this.t * 1.4 + s * 1.6) % 2;
      ctx.beginPath();
      ctx.moveTo(steamBase.x + s * 5 - 2, steamBase.y - phase * 6);
      ctx.quadraticCurveTo(
        steamBase.x + s * 5 + Math.sin(this.t * 3 + s) * 4,
        steamBase.y - phase * 10 - 5,
        steamBase.x + s * 5 - 2,
        steamBase.y - phase * 13 - 10
      );
      ctx.stroke();
    }
  }

  drawStation(ctx, gx, gy, agent, status, activity, theme) {
    const isSelected = this.selectedAgentId === agent.id;
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.VERDE;

    // Halo de selección o alerta en el suelo
    if (isSelected || status === 'ROJO' || activity === 'working') {
      const pulse = 0.55 + Math.sin(this.t * 4) * 0.25;
      const ringColor = isSelected ? theme.deskAccent : statusColor;
      const r0 = this.iso(gx - 0.8, gy - 0.7, 1);
      const r1 = this.iso(gx + 1.2, gy - 0.7, 1);
      const r2 = this.iso(gx + 1.2, gy + 1.1, 1);
      const r3 = this.iso(gx - 0.8, gy + 1.1, 1);
      ctx.save();
      ctx.globalAlpha = isSelected ? 0.9 : pulse * 0.65;
      this.drawPoly(ctx, [r0, r1, r2, r3], 'transparent', ringColor, isSelected ? 2.6 : 1.8);
      ctx.restore();
    }

    // Mobiliario temático según tipo de avatar
    if (agent.avatar === 'mecanico') {
      // Sedán MG 6 simplificado + terminal OBD-II
      this.drawBox(ctx, gx - 0.45, gy - 0.25, 1.35, 0.72, 13, theme.carColor, '#9f1239', '#881337');
      this.drawBox(ctx, gx - 0.15, gy - 0.18, 0.75, 0.58, 22, '#93c5fd', '#475569', '#334155');
      // Escáner OBD-II lateral
      this.drawBox(ctx, gx - 0.55, gy + 0.58, 0.45, 0.35, 20, theme.deskTop, theme.deskSide, '#0f172a');
    } else if (agent.avatar === 'combustible') {
      // Surtidor COPEC + escritorio
      this.drawBox(ctx, gx - 0.45, gy - 0.3, 1.2, 0.65, 16, theme.deskTop, theme.deskSide, '#0f172a');
      this.drawBox(ctx, gx + 0.55, gy - 0.42, 0.38, 0.34, 34, '#ef4444', '#b91c1c', '#1d4ed8');
    } else if (agent.avatar === 'profesor') {
      // Mesa de laboratorio + tubo brillante
      this.drawBox(ctx, gx - 0.45, gy - 0.3, 1.3, 0.7, 17, theme.deskTop, theme.deskSide, '#0f172a');
      this.drawBox(ctx, gx + 0.5, gy - 0.25, 0.26, 0.26, 36, '#5eead4', '#14b8a6', '#0f766e');
    } else {
      // Escritorio tech estándar con monitor
      this.drawBox(ctx, gx - 0.45, gy - 0.3, 1.25, 0.68, 16, theme.deskTop, theme.deskSide, '#0f172a');
    }

    // Monitor con brillo dinámico
    const screenColor = activity === 'working' ? '#38bdf8' : status === 'ROJO' ? '#f87171' : '#34d399';
    this.drawBox(ctx, gx - 0.22, gy - 0.2, 0.52, 0.14, 30, '#0f172a', screenColor, '#1e293b');

    // Personaje animado frente al escritorio
    const bob = activity === 'working' ? Math.abs(Math.sin(this.t * 6)) * 4 : Math.sin(this.t * 2 + gx) * 1.5;
    const charPt = this.iso(gx + 0.15, gy + 0.62, 16 + bob);

    // Cuerpo del personaje
    const bodyColors = {
      contador: '#3b82f6',
      combustible: '#ef4444',
      mecanico: '#f59e0b',
      perro: '#b45309',
      profesor: '#e2e8f0',
      bateria: '#10b981',
      robot: '#8b5cf6',
      servidor: '#06b6d4',
      camara: '#64748b'
    };
    const bodyCol = bodyColors[agent.avatar] || '#38bdf8';

    // Sombra en el piso
    const shPt = this.iso(gx + 0.15, gy + 0.62, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(shPt.x, shPt.y, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.roundRect(charPt.x - 8, charPt.y - 12, 16, 17, 6);
    ctx.fill();

    // Cabeza
    ctx.fillStyle = agent.avatar === 'perro' ? '#92400e' : agent.avatar === 'robot' ? '#cbd5e1' : '#fde68a';
    ctx.beginPath();
    ctx.arc(charPt.x, charPt.y - 19, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // Detalle simpático (lentes profesor / orejas perro / antena robot)
    if (agent.avatar === 'profesor') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(charPt.x - 6, charPt.y - 21, 5, 4);
      ctx.strokeRect(charPt.x + 1, charPt.y - 21, 5, 4);
    } else if (agent.avatar === 'perro') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(charPt.x - 10, charPt.y - 22, 3.5, 8);
      ctx.fillRect(charPt.x + 6.5, charPt.y - 22, 3.5, 8);
    } else if (agent.avatar === 'robot') {
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(charPt.x, charPt.y - 27);
      ctx.lineTo(charPt.x, charPt.y - 33);
      ctx.stroke();
    }

    // Semáforo flotante sobre el puesto
    const badgePt = this.iso(gx + 0.15, gy + 0.25, 58 + bob * 0.5);
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(badgePt.x, badgePt.y, status === 'ROJO' ? 7 + Math.sin(this.t * 6) * 1.4 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Etiqueta con nombre del agente
    const labelPt = this.iso(gx + 0.15, gy + 0.85, -8);
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
    const textW = ctx.measureText(agent.name).width;
    const padX = 8;
    ctx.fillStyle = theme.labelBg;
    ctx.beginPath();
    ctx.roundRect(labelPt.x - textW / 2 - padX, labelPt.y - 10, textW + padX * 2, 20, 7);
    ctx.fill();
    ctx.strokeStyle = isSelected ? theme.deskAccent : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = theme.labelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(agent.name, labelPt.x, labelPt.y);

    // Burbuja de diálogo temporal (acciones o alertas)
    const bubble = this.bubbles.get(agent.id);
    if (bubble && bubble.until > performance.now()) {
      const bPt = this.iso(gx + 0.15, gy + 0.25, 76);
      ctx.font = '600 10.5px -apple-system, sans-serif';
      const bw = Math.min(200, ctx.measureText(bubble.text).width + 18);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(bPt.x - bw / 2, bPt.y - 22, bw, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillText(bubble.text.slice(0, 32), bPt.x, bPt.y - 11);
    }
  }
}
