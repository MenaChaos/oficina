/**
 * MOTOR VISUAL HÍBRIDO COZY 2.5D v3.2 (core/renderer.js)
 * Dos vistas 100% Cozy intercambiables:
 * 1) 'open-floor' -> EDIFICIO COZY COMPLETO: Una única planta arquitectónica isométrica
 *    con pasillos, tabiques de madera/vidrio, cubículos y garage integrados (edificio-cozy.jpg),
 *    con todos tus agentes animados y placas en vivo dentro de cada estancia.
 * 2) 'cozy-rooms' -> SALAS SEPARADAS: Cada agente en su propia tarjeta diorama independiente.
 */

import { getTheme } from '../themes/themes.js';
import { getRoomTemplate, BUILDING_FLOORPLAN } from '../config/rooms.js?v=3.6';
import { getAvatarTemplate } from '../config/avatars.js?v=3.6';

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

    this.office = null;
    this.agents = [];
    this.agentData = {};
    this.themeId = 'cozy-warm';
    this.layoutMode = 'open-floor';
    this.selectedAgentId = null;

    this.cam = { x: 0, y: 0, zoom: 1 };
    this.hitBoxes = [];
    this.bubbles = new Map();
    this.agentMotion = new Map();
    this.motionEnabled = true;
    this.remodelProgress = 1;

    // Partículas ambientales cálidas
    this.motes = Array.from({ length: 28 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.2 + Math.random() * 2.0,
      s: 0.25 + Math.random() * 0.5,
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

  setScene({ office, agents, agentData, themeId, layoutMode, selectedAgentId, motionEnabled, triggerRemodel = false }) {
    if (motionEnabled !== undefined) this.motionEnabled = motionEnabled;
    if (office !== undefined) this.office = office;
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

  say(agentId, text, durationMs = 5400, tone = 'chat', targetAgentId = null) {
    const now = performance.now();
    this.bubbles.set(agentId, {
      text: String(text || ''),
      since: now,
      until: now + durationMs,
      tone,
      targetAgentId
    });
  }

  resetCamera() {
    this.cam = { x: 0, y: 0, zoom: 1 };
  }

  zoomBy(factor) {
    this.cam.zoom = Math.max(0.6, Math.min(2.4, this.cam.zoom * factor));
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
        this.cam.zoom = Math.max(0.6, Math.min(2.4, this.pinchStartZoom * (dist / this.pinchStartDist)));
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

    const grad = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Partículas ambientales cálidas
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
      this.drawUnifiedBuildingMode(ctx, theme, W, H);
    } else {
      this.drawCozyRoomsMode(ctx, theme, W, H);
    }

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
  // MODO 1: EDIFICIO COZY COMPLETO (UNA SOLA PLANTA ARQUITECTÓNICA CON PASILLOS)
  // ==========================================================================
  drawUnifiedBuildingMode(ctx, theme, W, H) {
    this.hitBoxes = [];
    const buildingImg = this.assets ? this.assets.getBuildingImage(this.office) : null;

    // Calcular caja de dibujo generosa respetando HUD y quickbar
    const padTop = 50;
    const padBottom = 68;
    const availW = Math.max(320, W - 24);
    const availH = Math.max(240, H - padTop - padBottom);

    const ratio = buildingImg && buildingImg.naturalWidth
      ? buildingImg.naturalWidth / buildingImg.naturalHeight
      : BUILDING_FLOORPLAN.aspectRatio;

    let drawW = availW;
    let drawH = drawW / ratio;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * ratio;
    }

    // Aprovechar un poquito más el ancho en pantallas 4:3 / iPad (recortando solo margen carbón sobrante)
    const fillBoost = 1.08;
    drawW *= fillBoost;
    drawH *= fillBoost;

    const left = (W - drawW) / 2;
    const top = padTop + (availH - drawH) / 2 - 4;

    ctx.save();
    ctx.translate(W / 2 + this.cam.x, H / 2 + this.cam.y);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-W / 2, -H / 2);

    if (buildingImg) {
      ctx.drawImage(buildingImg, left, top, drawW, drawH);

      // Fusión suave en los bordes externos para que el fondo carbón se integre sin costuras
      const edgeGlow = ctx.createRadialGradient(
        left + drawW * 0.5,
        top + drawH * 0.52,
        Math.min(drawW, drawH) * 0.34,
        left + drawW * 0.5,
        top + drawH * 0.52,
        Math.max(drawW, drawH) * 0.54
      );
      edgeGlow.addColorStop(0, 'rgba(30, 32, 36, 0)');
      edgeGlow.addColorStop(0.82, 'rgba(30, 32, 36, 0)');
      edgeGlow.addColorStop(1, theme.bgBottom || '#1c1d20');
      ctx.fillStyle = edgeGlow;
      ctx.fillRect(left - 2, top - 2, drawW + 4, drawH + 4);

      // Respiración sutil de luz cálida en el edificio
      const pulse = 0.65 + Math.sin(this.t * 1.5) * 0.35;
      const warmAmbient = ctx.createRadialGradient(
        left + drawW * 0.5,
        top + drawH * 0.5,
        drawW * 0.05,
        left + drawW * 0.5,
        top + drawH * 0.5,
        drawW * 0.42
      );
      warmAmbient.addColorStop(0, 'rgba(255, 206, 130, 0.09)');
      warmAmbient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = warmAmbient;
      ctx.fillRect(left, top, drawW, drawH);
      ctx.globalAlpha = 1;
    } else {
      // Fallback arquitectónico con pasillos y cubículos si aún no suben edificio-cozy.jpg
      this.drawFallbackBuildingPlan(ctx, left, top, drawW, drawH, theme);
    }

    // Asignar cada agente a su cubículo/estancia sin solapar jamás
    const usedSpotKeys = new Set();
    let extraIdx = 0;
    const placements = this.agents.map((agent) => {
      const tpl = getRoomTemplate(agent.roomStyle, agent);
      let spot = null;

      if (agent.buildingSpot && typeof agent.buildingSpot.x === 'number') {
        spot = agent.buildingSpot;
      } else if (BUILDING_FLOORPLAN.roomSpots[tpl.id] && !usedSpotKeys.has(tpl.id)) {
        usedSpotKeys.add(tpl.id);
        spot = BUILDING_FLOORPLAN.roomSpots[tpl.id];
      } else {
        // Buscar primer roomSpot libre o usar extraSpots
        const freeKey = Object.keys(BUILDING_FLOORPLAN.roomSpots).find((k) => !usedSpotKeys.has(k));
        if (freeKey) {
          usedSpotKeys.add(freeKey);
          spot = BUILDING_FLOORPLAN.roomSpots[freeKey];
        } else {
          spot = BUILDING_FLOORPLAN.extraSpots[extraIdx % BUILDING_FLOORPLAN.extraSpots.length];
          extraIdx++;
        }
      }

      return { agent, tpl, spot };
    });

    // Ordenar por profundidad vertical (de atrás hacia adelante)
    placements.sort((a, b) => a.spot.y - b.spot.y);

    const charScale = Math.max(0.72, Math.min(1.12, drawW / 1080));

    // Calcular posición animada de cada personaje para poder trazar arcos de conversación y ordenar por Y
    const computed = placements.map(({ agent, tpl, spot }) => {
      const anim = this.getAnimatedSpot(agent, spot, true);
      const ax = left + drawW * anim.x;
      const ay = top + drawH * anim.y;
      return { agent, tpl, spot, anim, ax, ay };
    });
    computed.sort((a, b) => a.ay - b.ay);
    const byIdPos = Object.fromEntries(computed.map((c) => [c.agent.id, c]));

    // Arco sutil luminoso entre dos colegas cuando están conversando
    const nowMs = performance.now();
    computed.forEach(({ agent, ax, ay }) => {
      const b = this.bubbles.get(agent.id);
      if (b && b.until > nowMs && b.targetAgentId && byIdPos[b.targetAgentId]) {
        const tgt = byIdPos[b.targetAgentId];
        ctx.save();
        ctx.strokeStyle = 'rgba(244, 162, 97, 0.42)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -this.t * 14;
        ctx.beginPath();
        const midX = (ax + tgt.ax) / 2;
        const midY = Math.min(ay, tgt.ay) - 42 * charScale;
        ctx.moveTo(ax, ay - 36 * charScale);
        ctx.quadraticCurveTo(midX, midY, tgt.ax, tgt.ay - 36 * charScale);
        ctx.stroke();
        ctx.restore();
      }
    });

    const bubblesToDraw = [];

    computed.forEach(({ agent, tpl, spot, anim, ax, ay }) => {
      const live = this.agentData[agent.id] || {};
      const status = agent.enabled === false ? 'PAUSADO' : live.status || 'VERDE';
      const activity = agent.enabled === false ? 'idle' : live.activity || 'idle';
      const isSelected = this.selectedAgentId === agent.id;
      const statusColor = STATUS_COLORS[status] || STATUS_COLORS.VERDE;
      const accentColor = agent.roomAccent || tpl.accent;

      const bubble = this.bubbles.get(agent.id);
      const isSpeaking = Boolean(bubble && bubble.until > nowMs);

      const walkHop = anim.isWalking ? Math.abs(Math.sin(this.t * 9.5)) * 6.5 : 0;
      const talkHop = isSpeaking ? Math.abs(Math.sin(this.t * 6.0)) * 3.0 : 0;
      const idleBob = activity === 'working' ? Math.abs(Math.sin(this.t * 5.8)) * 3.8 : Math.sin(this.t * 2.2 + spot.x * 12) * 1.4;
      const bob = Math.max(walkHop, talkHop, idleBob);

      // Halo sutil de selección o alerta en el piso de la estancia
      if (isSelected || status === 'ROJO' || activity === 'working') {
        const ringPulse = 0.65 + Math.sin(this.t * 4.5) * 0.35;
        ctx.save();
        ctx.strokeStyle = isSelected ? accentColor : statusColor;
        ctx.fillStyle = isSelected ? accentColor : statusColor;
        ctx.globalAlpha = 0.16 * ringPulse;
        ctx.beginPath();
        ctx.ellipse(ax, ay + 6 * charScale, 36 * charScale, 18 * charScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.82;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Personaje vivo caminando/trabajando dentro de su estancia
      this.drawCozyCharacter(ctx, ax, ay, bob, charScale, agent, status, activity, true, anim);

      // Icono flotante discreto de "trabajando" cuando NO hay globo de diálogo activo
      if (this.motionEnabled && !isSpeaking && !anim.isWalking && agent.enabled !== false) {
        const iconPhase = Math.sin(this.t * 1.7 + spot.x * 15);
        if (iconPhase > 0.15) {
          ctx.save();
          ctx.globalAlpha = Math.min(0.88, (iconPhase - 0.15) * 1.2);
          const floatY = ay - (78 + iconPhase * 8) * charScale;
          ctx.fillStyle = 'rgba(20, 21, 25, 0.72)';
          ctx.beginPath();
          ctx.arc(ax + 24 * charScale, floatY, 11 * charScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = `${Math.round(11 * charScale)}px -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(anim.workIcon || '✨', ax + 24 * charScale, floatY + 1);
          ctx.restore();
        }
      }

      // Placa fija en el centro del cubículo (no rebota mientras camina el personaje)
      const plateAnchorX = left + drawW * spot.x;
      const plateAnchorY = top + drawH * spot.y + 24 * charScale;
      const shortInfo = this.getShortHeadline(agent, live);
      ctx.font = '800 11.2px -apple-system, BlinkMacSystemFont, sans-serif';
      const titleW = ctx.measureText(agent.name).width;
      ctx.font = '500 9.6px -apple-system, BlinkMacSystemFont, sans-serif';
      const subText = this.truncateText(ctx, shortInfo, 152);
      const subW = ctx.measureText(subText).width;
      const plateW = Math.min(182, Math.max(titleW + 32, subW + 22, 114));
      const plateH = 34;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(20, 21, 25, 0.90)';
      ctx.beginPath();
      ctx.roundRect(plateAnchorX - plateW / 2, plateAnchorY - plateH / 2, plateW, plateH, 10);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = isSelected ? accentColor : status === 'ROJO' ? statusColor : 'rgba(244, 162, 97, 0.34)';
      ctx.lineWidth = isSelected || status === 'ROJO' ? 1.8 : 1;
      ctx.stroke();

      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(plateAnchorX - plateW / 2 + 12, plateAnchorY - 6, status === 'ROJO' ? 4.1 + Math.sin(this.t * 6) * 0.9 : 3.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '800 11.2px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#fbf6ee';
      ctx.fillText(this.truncateText(ctx, agent.name, plateW - 26), plateAnchorX - plateW / 2 + 21, plateAnchorY - 6);

      ctx.font = '500 9.6px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = status === 'ROJO' ? '#fca5a5' : status === 'AMARILLO' ? '#fcd34d' : '#c5bbb0';
      ctx.fillText(subText, plateAnchorX - plateW / 2 + 11, plateAnchorY + 8);
      ctx.restore();

      if (isSpeaking) {
        bubblesToDraw.push({ ax, ay: ay - 78 * charScale, bubble });
      }

      // Hitbox generosa que cubre al personaje y su placa
      const hitW = Math.max(plateW, 134 * charScale);
      const hitH = 140 * charScale;
      const hx = Math.min(ax, plateAnchorX) - hitW * 0.42;
      const hy = Math.min(ay - 84 * charScale, plateAnchorY - 50 * charScale);
      const sx = (hx - W / 2) * this.cam.zoom + W / 2 + this.cam.x;
      const sy = (hy - H / 2) * this.cam.zoom + H / 2 + this.cam.y;
      this.hitBoxes.push({
        agentId: agent.id,
        x: sx,
        y: sy,
        w: hitW * this.cam.zoom,
        h: hitH * this.cam.zoom
      });
    });

    // Dibujar los globos de texto en la capa más alta para que nunca queden tapados por otra placa
    bubblesToDraw.forEach(({ ax, ay, bubble }) => {
      this.drawCozySpeechBubble(ctx, ax, ay, bubble, 16, W - 16, 62);
    });

    ctx.restore();
  }

  drawFallbackBuildingPlan(ctx, left, top, w, h, theme) {
    // Plano arquitectónico de respaldo mientras suben assets/rooms/edificio-cozy.jpg
    const cx = left + w / 2;
    const cy = top + h / 2;
    const rx = w * 0.42;
    const ry = h * 0.36;

    this.drawPoly(
      ctx,
      [
        { x: cx, y: cy - ry },
        { x: cx + rx, y: cy },
        { x: cx, y: cy + ry },
        { x: cx - rx, y: cy }
      ],
      theme.floorA || '#3b332d',
      theme.wallTrim || '#f4a261',
      2
    );

    // Pasillos internos en cruz
    ctx.strokeStyle = 'rgba(244, 162, 97, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.5, cy - ry * 0.5);
    ctx.lineTo(cx + rx * 0.5, cy + ry * 0.5);
    ctx.moveTo(cx + rx * 0.5, cy - ry * 0.5);
    ctx.lineTo(cx - rx * 0.5, cy + ry * 0.5);
    ctx.stroke();

    ctx.font = '600 12px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 240, 220, 0.65)';
    ctx.textAlign = 'center';
    ctx.fillText('Sube assets/rooms/edificio-cozy.jpg para activar el plano Cozy ilustrado', cx, top + h - 22);
  }

  // ==========================================================================
  // MODO 2: TARJETAS DE SALAS COZY SEPARADAS
  // ==========================================================================
  drawCozyRoomsMode(ctx, theme, W, H) {
    this.hitBoxes = [];
    const agents = this.agents;
    const count = agents.length;
    if (count === 0) return;

    const isPortrait = H > W * 1.05;
    let cols = isPortrait ? 2 : count <= 2 ? count : count <= 4 ? 2 : count <= 6 ? 3 : 4;
    if (W < 640) cols = 1;
    const rows = Math.ceil(count / cols);

    const padTop = 74;
    const padBottom = 94;
    const padSide = 28;
    const availW = Math.max(280, W - padSide * 2);
    const availH = Math.max(220, H - padTop - padBottom);

    const gap = 18;
    const maxCardW = (availW - gap * (cols - 1)) / cols;
    const maxCardH = (availH - gap * (rows - 1)) / rows;
    const cardW = Math.max(195, Math.min(350, maxCardW, maxCardH * 0.94));
    const cardH = Math.round(cardW * 1.05);

    const totalH = rows * cardH + (rows - 1) * gap;
    const baseStartY = padTop + Math.max(0, (availH - totalH) / 2);

    ctx.save();
    ctx.translate(W / 2 + this.cam.x, H / 2 + this.cam.y);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-W / 2, -H / 2);

    agents.forEach((agent, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const itemsInRow = row === rows - 1 ? count - row * cols : cols;
      const rowW = itemsInRow * cardW + (itemsInRow - 1) * gap;
      const startX = (W - rowW) / 2;

      const x = startX + col * (cardW + gap);
      const y = baseStartY + row * (cardH + gap);

      this.drawCozyRoomCard(ctx, x, y, cardW, cardH, agent, theme);

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

    const r = 20;

    if (isSelected || status === 'ROJO' || activity === 'working') {
      const pulse = 0.55 + Math.sin(this.t * 4) * 0.28;
      ctx.save();
      ctx.shadowColor = isSelected ? accentColor : statusColor;
      ctx.shadowBlur = isSelected ? 24 : 16 + pulse * 8;
      ctx.strokeStyle = isSelected ? accentColor : statusColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.7;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = theme.roomCardBg || '#212327';
    ctx.fill();
    ctx.clip();

    const imgSize = w;
    const imgY = y - w * 0.04;
    const roomImg = this.assets ? this.assets.getImageForAgent(agent, tpl.id) : null;

    if (roomImg) {
      const drawPad = w * 0.02;
      ctx.drawImage(roomImg, x - drawPad, imgY - drawPad, imgSize + drawPad * 2, imgSize + drawPad * 2);

      const lampPulse = 0.75 + Math.sin(this.t * 1.8 + x * 0.01) * 0.25;
      const glow = ctx.createRadialGradient(x + w * 0.5, y + w * 0.45, w * 0.06, x + w * 0.5, y + w * 0.45, w * 0.48);
      glow.addColorStop(0, tpl.lampGlow || 'rgba(255, 200, 120, 0.22)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = lampPulse * 0.52;
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    } else {
      this.drawCozyFallbackDiorama(ctx, x, y, w, h * 0.78, agent, tpl);
    }

    const footGrad = ctx.createLinearGradient(0, y + h * 0.58, 0, y + h);
    footGrad.addColorStop(0, 'rgba(18, 19, 22, 0)');
    footGrad.addColorStop(0.55, 'rgba(18, 19, 22, 0.78)');
    footGrad.addColorStop(1, 'rgba(18, 19, 22, 0.96)');
    ctx.fillStyle = footGrad;
    ctx.fillRect(x, y + h * 0.55, w, h * 0.46);

    const anchor = agent.charAnchor || tpl.defaultAnchor || { x: 0.5, y: 0.65 };
    const anim = this.getAnimatedSpot(agent, anchor, false);
    const bubbleNow = this.bubbles.get(agent.id);
    const isSpeaking = Boolean(bubbleNow && bubbleNow.until > performance.now());
    const walkHop = anim.isWalking ? Math.abs(Math.sin(this.t * 9.5)) * 5.5 : 0;
    const talkHop = isSpeaking ? Math.abs(Math.sin(this.t * 6.0)) * 2.8 : 0;
    const bob = Math.max(walkHop, talkHop, activity === 'working' ? Math.abs(Math.sin(this.t * 6.0)) * 3.8 : Math.sin(this.t * 2.2 + x * 0.02) * 1.6);
    const cx = x + w * anim.x;
    const cy = y + h * anim.y;
    const charScale = Math.max(0.78, Math.min(1.18, w / 290));
    this.drawCozyCharacter(ctx, cx, cy, bob, charScale, agent, status, activity, false, anim);

    const pillText = status;
    ctx.font = '800 9.5px -apple-system, BlinkMacSystemFont, sans-serif';
    const pillW = ctx.measureText(pillText).width + 24;
    const pillX = x + w - pillW - 10;
    ctx.fillStyle = 'rgba(18, 19, 22, 0.84)';
    ctx.beginPath();
    ctx.roundRect(pillX, y + 10, pillW, 22, 999);
    ctx.fill();
    ctx.strokeStyle = statusColor;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(pillX + 10, y + 21, status === 'ROJO' ? 4 + Math.sin(this.t * 6) * 0.9 : 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, pillX + 18, y + 21.5);

    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, sans-serif';
    const maxTagW = Math.max(64, pillX - (x + 10) - 8);
    const rawTag = `${tpl.icon} ${tpl.shortName || tpl.name}`;
    const roomTag = this.truncateText(ctx, rawTag, maxTagW - 16);
    const tagW = Math.min(maxTagW, ctx.measureText(roomTag).width + 16);
    ctx.fillStyle = 'rgba(18, 19, 22, 0.78)';
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, tagW, 22, 999);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f5efe6';
    ctx.fillText(roomTag, x + 18, y + 21.5);

    ctx.textAlign = 'left';
    ctx.font = '800 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#fbf6ee';
    ctx.fillText(this.truncateText(ctx, agent.name, w - 28), x + 14, y + h - 35);

    const headline = this.getShortHeadline(agent, live);
    ctx.font = '500 11.2px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = status === 'ROJO' ? '#fca5a5' : status === 'AMARILLO' ? '#fcd34d' : '#c7beb2';
    ctx.fillText(this.truncateText(ctx, headline, w - 28), x + 14, y + h - 16);

    const bubble = this.bubbles.get(agent.id);
    if (bubble && bubble.until > performance.now()) {
      this.drawCozySpeechBubble(ctx, cx, cy - 78 * charScale, bubble, x + 8, x + w - 8, y + 36);
    }

    ctx.restore();

    ctx.strokeStyle = isSelected ? accentColor : theme.roomCardBorder || 'rgba(255,255,255,0.12)';
    ctx.lineWidth = isSelected ? 2.2 : 1.1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }

  drawCozyFallbackDiorama(ctx, x, y, w, h, agent, tpl) {
    const cx = x + w / 2;
    const cy = y + h * 0.56;
    const s = w * 0.34;
    const grad = ctx.createRadialGradient(cx, cy - s * 0.25, 8, cx, cy, s * 1.45);
    grad.addColorStop(0, tpl.lampGlow || 'rgba(244,162,97,0.32)');
    grad.addColorStop(1, 'rgba(20,21,24,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    this.drawPoly(ctx, [{ x: cx, y: cy - s * 0.45 }, { x: cx + s, y: cy + s * 0.05 }, { x: cx, y: cy + s * 0.55 }, { x: cx - s, y: cy + s * 0.05 }], tpl.floorColor, 'rgba(255,240,220,0.14)', 1.2);
    this.drawPoly(ctx, [{ x: cx - s, y: cy + s * 0.05 }, { x: cx, y: cy - s * 0.45 }, { x: cx, y: cy - s * 1.18 }, { x: cx - s, y: cy - s * 0.68 }], tpl.wallColor, 'rgba(0,0,0,0.2)', 1);
    this.drawPoly(ctx, [{ x: cx, y: cy - s * 0.45 }, { x: cx + s, y: cy + s * 0.05 }, { x: cx + s, y: cy - s * 0.68 }, { x: cx, y: cy - s * 1.18 }], '#3a322c', 'rgba(0,0,0,0.2)', 1);
  }

  drawCozyCharacter(ctx, footX, footY, bob, scale, agent, status, activity, isBuildingMode, anim = null) {
    const avatar = agent.avatar || 'robot';
    const avTpl = getAvatarTemplate(avatar);
    const sprite = this.assets ? this.assets.getAvatarSpriteForAgent(agent) : null;
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.VERDE;
    const isSelected = this.selectedAgentId === agent.id;

    ctx.save();
    ctx.translate(footX, footY);

    // Anillo luminoso en el suelo estilo Cozy / Sims
    const ringR = (isBuildingMode ? 24 : 26) * scale;
    const pulse = 0.65 + Math.sin(this.t * (status === 'ROJO' || activity === 'working' ? 5.5 : 2.2)) * 0.35;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * scale, ringR * 0.85, ringR * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aro de estado suave en los pies
    ctx.strokeStyle = isSelected ? '#fbf6ee' : statusColor;
    ctx.globalAlpha = isSelected ? 0.92 : status === 'ROJO' ? 0.88 * pulse : 0.45 * pulse;
    ctx.lineWidth = isSelected || status === 'ROJO' ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 2 * scale, ringR, ringR * 0.44, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (sprite) {
      // Dibujar sprite 3D Cozy Fantasía recortado con respiración suave y sombra
      const baseH = (isBuildingMode ? 76 : 82) * scale * (avTpl.scaleBoost || 1);
      const sw = sprite.width || sprite.naturalWidth || 100;
      const sh = sprite.height || sprite.naturalHeight || 100;
      const aspect = sw / sh;
      const breathe = 1 + Math.sin(this.t * 2.4 + footX * 0.03) * 0.018;
      const drawH = baseH * breathe;
      const drawW = drawH * aspect;

      const facing = anim && anim.facing ? anim.facing : 1;
      const tilt = anim && anim.isWalking ? Math.sin(this.t * 9.5) * 0.065 : 0;
      ctx.save();
      ctx.translate(0, -bob);
      ctx.rotate(tilt);
      if (facing < 0) ctx.scale(-1, 1);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(sprite, -drawW / 2, -drawH + 4 * scale, drawW, drawH);
      ctx.restore();

      ctx.restore();
      return;
    }

    // Fallback Cozy estilizado mientras suben las imágenes a assets/avatars/
    ctx.translate(0, -12 * scale - bob);
    ctx.scale(scale, scale);

    ctx.fillStyle = avTpl.bodyColor || '#f4a261';
    ctx.strokeStyle = 'rgba(20, 16, 14, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-10, -8, 20, 20, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = avatar === 'perro' ? '#b4692c' : avatar === 'robot' ? '#cbd5e1' : '#fde2b8';
    ctx.beginPath();
    ctx.arc(0, -16, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1f1a17';
    ctx.beginPath();
    ctx.arc(-3.5, -16, 1.5, 0, Math.PI * 2);
    ctx.arc(3.5, -16, 1.5, 0, Math.PI * 2);
    ctx.fill();

    if (avatar === 'profesor') {
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath();
      ctx.moveTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(0, -37); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (avatar === 'contador') {
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.moveTo(-11, -22); ctx.lineTo(11, -22); ctx.lineTo(-2, -35); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (avatar === 'mecanico') {
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(0, -20, 10, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-10, -21, 16, 3);
    } else if (avatar === 'perro' || avatar === 'combustible') {
      ctx.fillStyle = avatar === 'combustible' ? '#ea580c' : '#783f15';
      ctx.beginPath();
      ctx.roundRect(-13.5, -19, 4.5, 10, 2.5);
      ctx.roundRect(9, -19, 4.5, 10, 2.5);
      ctx.fill();
    }

    ctx.restore();
  }


  getAnimatedSpot(agent, baseSpot, isBuildingMode) {
    const patrol = isBuildingMode && Array.isArray(baseSpot.patrol) && baseSpot.patrol.length > 0
      ? baseSpot.patrol
      : [{ x: baseSpot.x, y: baseSpot.y, icon: '✨' }];

    if (!this.motionEnabled || agent.enabled === false) {
      return { x: baseSpot.x, y: baseSpot.y, isWalking: false, facing: 1, workIcon: patrol[0].icon || '✨' };
    }

    const now = performance.now();
    let m = this.agentMotion.get(agent.id);
    if (!m || m.mode !== isBuildingMode) {
      m = {
        mode: isBuildingMode,
        x: patrol[0].x,
        y: patrol[0].y,
        fromX: patrol[0].x,
        fromY: patrol[0].y,
        targetX: patrol[0].x,
        targetY: patrol[0].y,
        wpIdx: 0,
        phase: 'work', // 'work' | 'walk'
        phaseStart: now,
        phaseDur: 3500 + Math.random() * 5500,
        facing: 1,
        workIcon: patrol[0].icon || '✨'
      };
      this.agentMotion.set(agent.id, m);
    }

    // Si está hablando ahora mismo, pausar la caminata para que se vea conversando
    const activeBubble = this.bubbles.get(agent.id);
    const isSpeaking = activeBubble && activeBubble.until > now;

    if (m.phase === 'walk') {
      const prog = Math.min(1, (now - m.phaseStart) / m.phaseDur);
      // Ease in-out suave
      const e = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
      m.x = m.fromX + (m.targetX - m.fromX) * e;
      m.y = m.fromY + (m.targetY - m.fromY) * e;
      if (prog >= 1) {
        m.phase = 'work';
        m.phaseStart = now;
        m.phaseDur = 5500 + Math.random() * 6500;
      }
      return { x: m.x, y: m.y, isWalking: true, facing: m.facing, workIcon: m.workIcon };
    }

    // En fase 'work': al terminar el tiempo y si no está hablando, caminar a otro punto de la sala
    if (!isSpeaking && now - m.phaseStart >= m.phaseDur) {
      if (isBuildingMode && patrol.length > 1) {
        let nextIdx = (m.wpIdx + 1 + Math.floor(Math.random() * (patrol.length - 1))) % patrol.length;
        const wp = patrol[nextIdx];
        m.wpIdx = nextIdx;
        m.fromX = m.x;
        m.fromY = m.y;
        m.targetX = wp.x;
        m.targetY = wp.y;
        m.workIcon = wp.icon || '✨';
        if (Math.abs(wp.x - m.x) > 0.004) m.facing = wp.x >= m.x ? 1 : -1;
        m.phase = 'walk';
        m.phaseStart = now;
        m.phaseDur = 1900 + Math.random() * 900;
      } else if (!isBuildingMode) {
        // Pequeño paseo local en tarjetas separadas
        const dx = (Math.random() - 0.5) * 0.07;
        const dy = (Math.random() - 0.5) * 0.03;
        m.fromX = m.x;
        m.fromY = m.y;
        m.targetX = Math.max(0.22, Math.min(0.78, baseSpot.x + dx));
        m.targetY = Math.max(0.56, Math.min(0.73, baseSpot.y + dy));
        if (Math.abs(m.targetX - m.x) > 0.005) m.facing = m.targetX >= m.x ? 1 : -1;
        m.phase = 'walk';
        m.phaseStart = now;
        m.phaseDur = 1800 + Math.random() * 800;
      } else {
        m.phaseStart = now;
      }
    }

    return { x: m.x, y: m.y, isWalking: false, facing: m.facing, workIcon: m.workIcon };
  }

  wrapBubbleLines(ctx, text, maxW, maxLines = 3) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (let i = 0; i < words.length; i++) {
      const test = current ? current + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width <= maxW) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = words[i];
        if (lines.length >= maxLines - 1) {
          const rest = [current, ...words.slice(i + 1)].join(' ');
          lines.push(this.truncateText(ctx, rest, maxW));
          return lines;
        }
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, maxLines);
  }

  drawCozySpeechBubble(ctx, anchorX, anchorY, bubble, minX, maxX, minY) {
    const now = performance.now();
    if (!bubble || bubble.until <= now) return;

    const age = now - (bubble.since || 0);
    const remain = bubble.until - now;
    const alpha = Math.min(1, age / 220, remain / 320);
    const popScale = age < 220 ? 0.88 + 0.12 * (age / 220) : 1;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';

    const maxInnerW = Math.min(205, Math.max(120, (maxX - minX) - 26));
    const lines = this.wrapBubbleLines(ctx, bubble.text, maxInnerW, 3);
    const lineH = 14.5;
    let widest = 0;
    lines.forEach((l) => { widest = Math.max(widest, ctx.measureText(l).width); });

    const padX = 11;
    const padY = 7;
    const bw = Math.max(72, Math.min(maxInnerW + padX * 2, widest + padX * 2));
    const bh = lines.length * lineH + padY * 2;

    const bx = Math.max(minX, Math.min(maxX - bw, anchorX - bw / 2));
    const by = Math.max(minY, anchorY - bh - 10);
    const tailX = Math.max(bx + 14, Math.min(bx + bw - 14, anchorX));

    ctx.translate(tailX, by + bh);
    ctx.scale(popScale, popScale);
    ctx.translate(-tailX, -(by + bh));

    const isAlert = bubble.tone === 'alert';
    const isHighlight = bubble.tone === 'highlight';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = isAlert ? '#fef2f2' : '#fffaf0';
    ctx.strokeStyle = isAlert ? '#ef4444' : isHighlight ? '#f59e0b' : '#e6ccb2';
    ctx.lineWidth = isAlert || isHighlight ? 2 : 1.4;

    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Colita del globo apuntando al personaje
    ctx.fillStyle = isAlert ? '#fef2f2' : '#fffaf0';
    ctx.beginPath();
    ctx.moveTo(tailX - 6, by + bh - 1);
    ctx.lineTo(tailX + 6, by + bh - 1);
    ctx.lineTo(tailX, by + bh + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isAlert ? '#ef4444' : isHighlight ? '#f59e0b' : '#e6ccb2';
    ctx.beginPath();
    ctx.moveTo(tailX - 6, by + bh);
    ctx.lineTo(tailX, by + bh + 7);
    ctx.lineTo(tailX + 6, by + bh);
    ctx.stroke();

    // Texto centrado nítido
    ctx.fillStyle = isAlert ? '#7f1d1d' : '#261d17';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, idx) => {
      ctx.fillText(line, bx + bw / 2, by + padY + lineH * (idx + 0.5));
    });

    ctx.restore();
  }

  getShortHeadline(agent, live) {
    if (agent.enabled === false) return 'Agente pausado';
    if (!live || Object.keys(live).length === 0) return 'Esperando sincronización...';
    if (live.error) return 'Error: ' + live.error;
    if (agent.adapter === 'servicios_hogar' && live.metrics) {
      return live.metrics.pendingCount > 0
        ? `${live.metrics.pendingCount} pend. · ${live.metrics.totalPendingDisplay}`
        : 'Cuentas al día ✓';
    }
    if (agent.adapter === 'combustible_copec' && live.lastReceipt) {
      return `${live.lastReceipt.combustible} ${live.lastReceipt.montoDisplay} · ${live.metrics?.pendingReimbursementsCount ?? 0} pend.`;
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
    while (s.length > 3 && ctx.measureText(s + '…').width > maxW) {
      s = s.slice(0, -1);
    }
    return s + '…';
  }

  drawPoly(ctx, pts, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
}
