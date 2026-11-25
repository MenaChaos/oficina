/**
 * CAPA DE VIDA Y DIÁLOGOS DE OFICINA v3.8 (core/chatter.js)
 * - Sincronizado en tiempo real con los datos vivos de cada agente mediante huella de estado (fingerprint).
 * - Si pagas una cuenta, reembolsas COPEC, llega un nuevo viaje del MG 6 o cambia cualquier estado,
 *   descarta al instante los diálogos antiguos y regenera un lote fresco con OpenAI automáticamente.
 * - Renueva los diálogos cada 30 min aunque el iPad quede abierto todo el día en Modo Kiosco.
 */

export class OfficeChatterEngine {
  constructor({ store, renderer, onStatusChange }) {
    this.store = store;
    this.renderer = renderer;
    this.onStatusChange = onStatusChange;

    this.timer = null;
    this.replyTimer = null;
    this.aiPack = null; // { highlights: {}, solo: [], conversations: [], generatedAt, stateHash }
    this.aiPackFingerprint = '';
    this.lastKnownFingerprint = '';
    this.aiStatus = 'local'; // 'local' | 'loading' | 'openai' | 'error'
    this.aiLastError = '';
    this.soloCursor = 0;
    this.convCursor = 0;
    this.turnCounter = 0;
    this.lastAiFetchTs = 0;
    this.inFlight = false;
  }

  getPrefs() {
    const p = this.store.state.prefs || {};
    return {
      chatterMode: p.chatterMode || 'normal', // 'off' | 'calm' | 'normal' | 'lively'
      useOpenAI: p.useOpenAI !== false,       // true por defecto
      avatarMotion: p.avatarMotion !== false  // true por defecto
    };
  }

  /**
   * Genera una huella compacta del estado real actual de los agentes activos.
   * Si cambia un pago, un reembolso, un viaje del MG 6 o una corrida de bot, esta huella cambia.
   */
  computeDataFingerprint() {
    const office = this.store.getActiveOffice();
    const agents = (office?.agents || []).filter((a) => a.enabled !== false);
    const data = this.store.state.data || {};
    const parts = agents.map((a) => {
      const live = data[a.id] || {};
      const m = live.metrics || {};
      const t = live.telemetry || {};
      const gh = live.github || {};
      const fp = live.filePreview || {};
      return [
        a.id,
        live.status || '',
        live.headline || '',
        m.pendingCount ?? '',
        m.overdueCount ?? '',
        m.totalPendingCLP ?? '',
        m.pendingReimbursementsCount ?? '',
        m.monthBencinaCLP ?? '',
        m.monthDieselCLP ?? '',
        t.ultimaActualizacion || '',
        gh.runNumber ?? '',
        fp.totalLines ?? ''
      ].join('|');
    });
    return parts.join('||');
  }

  /**
   * Verifica si el lote actual de OpenAI sigue correspondiendo a los datos reales de hoy.
   */
  isAiPackFresh() {
    if (!this.aiPack) return false;
    const currentFp = this.computeDataFingerprint();
    if (this.aiPackFingerprint && currentFp && this.aiPackFingerprint !== currentFp) {
      return false;
    }
    // Expirar en cliente a los 35 min para renovar contexto horario/diario
    if (this.lastAiFetchTs && Date.now() - this.lastAiFetchTs > 35 * 60 * 1000) {
      return false;
    }
    return true;
  }

  /**
   * Llamar cada vez que los datos se sincronizan o se ejecuta una acción (pagar cuenta, reembolsar, etc.).
   */
  onLiveDataUpdated(forceAction = false) {
    const currentFp = this.computeDataFingerprint();
    const dataChanged = Boolean(
      currentFp && this.lastKnownFingerprint && currentFp !== this.lastKnownFingerprint
    );
    this.lastKnownFingerprint = currentFp;

    if (forceAction || dataChanged) {
      // Descartar inmediatamente diálogos viejos para jamás mostrar deudas ya pagadas
      this.aiPack = null;
      this.aiPackFingerprint = '';
      if (this.store.state.mode === 'online' && this.getPrefs().useOpenAI) {
        this.refreshFromOpenAI(true);
      }
      return;
    }

    // Si el iPad lleva >30 min abierto sin recargar, renovar lote automáticamente en segundo plano
    const ageMs = Date.now() - this.lastAiFetchTs;
    if (
      this.store.state.mode === 'online' &&
      this.getPrefs().useOpenAI &&
      (!this.aiPack || ageMs >= 30 * 60 * 1000)
    ) {
      this.refreshFromOpenAI(false);
    }
  }

  start() {
    this.stop();
    const { chatterMode } = this.getPrefs();
    if (chatterMode === 'off') return;

    this.timer = setTimeout(() => {
      this.tick();
    }, 3500);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    if (this.replyTimer) clearTimeout(this.replyTimer);
    this.timer = null;
    this.replyTimer = null;
  }

  scheduleNext() {
    if (this.timer) clearTimeout(this.timer);
    const { chatterMode } = this.getPrefs();
    if (chatterMode === 'off') return;

    const ranges = {
      calm: [22000, 32000],
      normal: [12000, 19000],
      lively: [7500, 12500]
    };
    const [minMs, maxMs] = ranges[chatterMode] || ranges.normal;
    const delay = Math.round(minMs + Math.random() * (maxMs - minMs));
    this.timer = setTimeout(() => this.tick(), delay);
  }

  async refreshFromOpenAI(force = false) {
    const { useOpenAI } = this.getPrefs();
    if (!useOpenAI || this.store.state.mode !== 'online') {
      this.aiStatus = 'local';
      this.emitStatus();
      return null;
    }

    if (this.inFlight) return this.aiPack;

    const currentFp = this.computeDataFingerprint();
    const now = Date.now();
    const sameState = this.aiPackFingerprint && this.aiPackFingerprint === currentFp;
    if (!force && this.aiPack && sameState && now - this.lastAiFetchTs < 25 * 60 * 1000) {
      return this.aiPack;
    }

    this.inFlight = true;
    this.aiStatus = 'loading';
    this.aiLastError = '';
    this.emitStatus();

    try {
      const res = await this.store.api.getChatter(force);
      if (res && res.chatter && res.source === 'openai') {
        this.aiPack = res.chatter;
        this.aiPackFingerprint = this.computeDataFingerprint();
        this.lastKnownFingerprint = this.aiPackFingerprint;
        this.lastAiFetchTs = Date.now();
        this.soloCursor = 0;
        this.convCursor = 0;
        this.aiStatus = 'openai';
      } else {
        this.aiStatus = 'local';
        if (res && res.note) this.aiLastError = res.note;
      }
    } catch (err) {
      this.aiStatus = 'local';
      this.aiLastError = err.message || '';
    } finally {
      this.inFlight = false;
    }

    this.emitStatus();
    return this.aiPack;
  }

  emitStatus() {
    if (this.onStatusChange) {
      this.onStatusChange({
        status: this.aiStatus,
        error: this.aiLastError,
        hasPack: Boolean(this.aiPack),
        generatedAt: this.aiPack?.generatedAt || ''
      });
    }
  }

  isOfficeViewActive() {
    const el = document.querySelector('#view-office');
    return Boolean(el && el.classList.contains('active'));
  }

  tick() {
    const { chatterMode, useOpenAI } = this.getPrefs();
    if (chatterMode === 'off') return;

    // Auto-renovación cada 30 min aunque el usuario no toque nada en el iPad
    if (
      useOpenAI &&
      this.store.state.mode === 'online' &&
      !this.inFlight &&
      (!this.isAiPackFresh() || Date.now() - this.lastAiFetchTs >= 30 * 60 * 1000)
    ) {
      this.refreshFromOpenAI(false);
    }

    if (!this.isOfficeViewActive()) {
      this.scheduleNext();
      return;
    }

    const office = this.store.getActiveOffice();
    const activeAgents = (office?.agents || []).filter((a) => a.enabled !== false);
    if (activeAgents.length === 0) {
      this.scheduleNext();
      return;
    }

    this.turnCounter++;
    const doConversation = activeAgents.length >= 2 && (this.turnCounter % 2 === 0);

    if (doConversation) {
      this.playConversation(activeAgents);
    } else {
      this.playSoloRemark(activeAgents);
    }

    this.scheduleNext();
  }

  /**
   * Globo destacado inmediato cuando haces clic en un personaje
   */
  speakClickHighlight(agentId) {
    const office = this.store.getActiveOffice();
    const agent = (office?.agents || []).find((a) => a.id === agentId);
    if (!agent) return;

    const live = this.store.state.data[agent.id] || {};
    const status = agent.enabled === false ? 'PAUSADO' : live.status || 'VERDE';

    // Usar highlight de OpenAI SOLO si el lote corresponde al estado real actual
    const aiLine = this.isAiPackFresh() && this.aiPack.highlights && this.aiPack.highlights[agent.id];
    const text = aiLine || this.buildLocalHighlight(agent, live);
    const tone = status === 'ROJO' ? 'alert' : 'highlight';

    this.renderer.say(agent.id, text, 6500, tone);
  }

  playSoloRemark(activeAgents) {
    if (this.isAiPackFresh() && Array.isArray(this.aiPack.solo) && this.aiPack.solo.length > 0) {
      const validIds = new Set(activeAgents.map((a) => a.id));
      for (let tries = 0; tries < this.aiPack.solo.length; tries++) {
        const entry = this.aiPack.solo[this.soloCursor % this.aiPack.solo.length];
        this.soloCursor++;
        if (entry && validIds.has(entry.agentId) && entry.text) {
          const live = this.store.state.data[entry.agentId] || {};
          this.renderer.say(entry.agentId, entry.text, 5800, live.status === 'ROJO' ? 'alert' : 'chat');
          return;
        }
      }
    }

    const agent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
    const live = this.store.state.data[agent.id] || {};
    const lines = this.buildLocalSoloLines(agent, live);
    const picked = lines[Math.floor(Math.random() * lines.length)];
    this.renderer.say(agent.id, picked, 5400, live.status === 'ROJO' ? 'alert' : 'chat');
  }

  playConversation(activeAgents) {
    if (this.replyTimer) clearTimeout(this.replyTimer);

    const validIds = new Set(activeAgents.map((a) => a.id));

    if (this.isAiPackFresh() && Array.isArray(this.aiPack.conversations) && this.aiPack.conversations.length > 0) {
      for (let tries = 0; tries < this.aiPack.conversations.length; tries++) {
        const c = this.aiPack.conversations[this.convCursor % this.aiPack.conversations.length];
        this.convCursor++;
        if (c && validIds.has(c.from) && validIds.has(c.to) && c.from !== c.to && c.line1 && c.line2) {
          this.dispatchTwoTurnChat(c.from, c.line1, c.to, c.line2);
          return;
        }
      }
    }

    const convs = this.buildLocalConversations(activeAgents);
    if (convs.length === 0) {
      this.playSoloRemark(activeAgents);
      return;
    }
    const picked = convs[Math.floor(Math.random() * convs.length)];
    this.dispatchTwoTurnChat(picked.from, picked.line1, picked.to, picked.line2);
  }

  dispatchTwoTurnChat(fromId, line1, toId, line2) {
    this.renderer.say(fromId, line1, 5800, 'chat', toId);
    this.replyTimer = setTimeout(() => {
      if (!this.isOfficeViewActive()) return;
      this.renderer.say(toId, line2, 6000, 'chat', fromId);
    }, 3400);
  }

  // ==========================================================================
  // GENERADOR LOCAL DE RESPALDO (100% FIEL A LOS DATOS EN VIVO MIENTRAS CARGA IA)
  // ==========================================================================
  buildLocalHighlight(agent, live) {
    if (agent.enabled === false) return 'Estoy en pausa descansando 💤';
    if (!live || Object.keys(live).length === 0) return 'Listo para sincronizar tus datos 🔄';

    if (agent.adapter === 'servicios_hogar') {
      const items = live.items || [];
      const overdue = items.find((x) => x.isOverdue);
      const soon = items.find((x) => !x.isPaid && x.isDueSoon);
      if (overdue) {
        return `⚠️ ¡Ojo! ${overdue.label} (${overdue.amountDisplay}) venció el ${overdue.dueDateText}.`;
      }
      if (soon) {
        return `📅 Próximo pago: ${soon.label} (${soon.amountDisplay}) vence el ${soon.dueDateText}.`;
      }
      const pend = live.metrics?.pendingCount || 0;
      return pend > 0
        ? `Quedan ${pend} cuenta(s) pendiente(s) por ${live.metrics.totalPendingDisplay}.`
        : '✨ ¡Todo pagado! Cuentas del hogar 100% al día.';
    }

    if (agent.adapter === 'combustible_copec') {
      const pend = live.metrics?.pendingReimbursementsCount ?? 0;
      const lr = live.lastReceipt;
      if (pend > 0) {
        return `🧾 Tienes ${pend} boleta(s) por reembolsar. Diésel mes: ${live.metrics?.monthDieselDisplay || '$0'}.`;
      }
      return lr
        ? `⛽ Todo reembolsado. Última carga: ${lr.combustible} ${lr.montoDisplay} (${lr.fecha}).`
        : '⛽ Caja de boletas COPEC al día.';
    }

    if (agent.adapter === 'mg6_mecanico' && live.telemetry) {
      const t = live.telemetry;
      const uv = t.ultimoViaje || {};
      if (t.estadoGeneral === 'ROJO' || t.estadoGeneral === 'AMARILLO') {
        return `🔧 Alerta ${t.estadoGeneral}: ${(t.accionRecomendada || t.headline || '').slice(0, 78)}`;
      }
      return `🔧 MG 6 sano (${uv.tempMaxC || '-'}°C, ${uv.voltajeMinV || '-'}V). ${t.ultimoViaje?.resumen || 'Todo en orden'}.`;
    }

    if (agent.id === 'simurdiera') {
      const gh = live.github || {};
      return gh.conclusion === 'success'
        ? `🐶 ¡Guau! Clima y convocatoria Discord OK (corrida #${gh.runNumber || '-'}).`
        : `🐶 Revisando mi última corrida en Discord (${gh.conclusion || 'en espera'}).`;
    }

    if (agent.id === 'prof-farnsworth') {
      const total = live.filePreview?.totalLines || 0;
      return total > 0
        ? `🧙 ¡Buenas noticias! Ya rastreé ${total} ofertas en mi bitácora de Steam.`
        : '🧙 Calibrando mi radar arcano de ofertas en Steam...';
    }

    return live.headline || 'Trabajando en mi estación ✨';
  }

  buildLocalSoloLines(agent, live) {
    const lines = [];

    if (agent.adapter === 'servicios_hogar') {
      const m = live.metrics || {};
      if (m.overdueCount > 0) {
        lines.push(`¡Jefe! Hay ${m.overdueCount} cuenta vencida en el libro 📒`);
        lines.push(`Sumando pendientes: ${m.totalPendingDisplay} por cuadrar...`);
      } else if (m.pendingCount > 0) {
        lines.push(`Anotando ${m.pendingCount} boletas pendientes (${m.totalPendingDisplay}) ✍️`);
      } else {
        lines.push('¡Libros cuadrados y cero cuentas pendientes este mes! 🧝✨');
        lines.push('Luz, agua, internet y teléfono 100% pagados 📊');
      }
      lines.push('Manteniendo los pergaminos financieros en orden 📒');
      return lines;
    }

    if (agent.adapter === 'combustible_copec') {
      const m = live.metrics || {};
      if ((m.pendingReimbursementsCount || 0) > 0) {
        lines.push(`Tengo ${m.pendingReimbursementsCount} boletas COPEC esperando reembolso 🦊`);
      } else {
        lines.push('¡Todas las boletas COPEC están reembolsadas! 🦊✨');
      }
      lines.push(`Este mes van ${m.monthBencinaDisplay || '$0'} en bencina y ${m.monthDieselDisplay || '$0'} en diésel.`);
      lines.push('Preparando un espresso mientras archivo las boletas ☕');
      return lines;
    }

    if (agent.adapter === 'mg6_mecanico') {
      const t = live.telemetry || {};
      const uv = t.ultimoViaje || {};
      lines.push(`Motor del MG 6 en ${t.estadoGeneral || 'VERDE'}: ${uv.tempMaxC || '-'}°C y ${uv.voltajeMinV || '-'}V 🔧`);
      lines.push('Revisando presión del riel GDI y trim de mezcla 🛠️');
      lines.push('Chequeando el último log OBD-II en el escáner 💻');
      return lines;
    }

    if (agent.id === 'simurdiera') {
      lines.push('Escuchando música lo-fi mientras vigilo el clima 🎧');
      lines.push('¡Todo tranquilo en el servidor de Discord! 🐶');
      lines.push('Listo para avisar si se arma partida nocturna 🎮');
      return lines;
    }

    if (agent.id === 'prof-farnsworth') {
      const total = live.filePreview?.totalLines || 0;
      lines.push('¡Buenas noticias a todos! Escaneando rebajas en Steam 🧙');
      if (total > 0) lines.push(`Ya van ${total} juegos históricos cazados en mi bitácora 📜`);
      lines.push('Destilando pociones de descuento al 75%... 🧪');
      return lines;
    }

    return [live.headline || 'Monitoreando mi estación...', 'Todo operando con normalidad ✨'];
  }

  buildLocalConversations(activeAgents) {
    const byId = Object.fromEntries(activeAgents.map((a) => [a.id, a]));
    const data = this.store.state.data || {};
    const convs = [];

    if (byId['cuentas-hogar'] && byId['control-copec']) {
      const pendFuel = data['control-copec']?.metrics?.pendingReimbursementsCount ?? 0;
      const pendBills = data['cuentas-hogar']?.metrics?.pendingCount ?? 0;
      convs.push({
        from: 'cuentas-hogar',
        line1: pendFuel > 0
          ? `Zorrito, ¿ya rendiste esas ${pendFuel} boletas de COPEC?`
          : 'Zorrito, ¿cómo vamos con las boletas de combustible?',
        to: 'control-copec',
        line2: pendFuel > 0
          ? `¡En eso estoy! Llevo ${data['control-copec']?.metrics?.monthDieselDisplay || '$0'} en diésel este mes 🦊`
          : '¡Todo rendido y ordenadito con café en mano! ☕'
      });
      convs.push({
        from: 'control-copec',
        line1: pendBills > 0
          ? '¿Te paso un café, Elfo? Te veo rodeado de cuentas ☕'
          : 'Te veo súper relajado hoy, Elfo. ¿Todo pagado ya? ☕',
        to: 'cuentas-hogar',
        line2: pendBills > 0
          ? `¡Sí por favor! Quedan ${pendBills} cuentas por ${data['cuentas-hogar']?.metrics?.totalPendingDisplay || '$0'} 🧝`
          : '¡Así es! Todas las cuentas del hogar quedaron al día ✨'
      });
    }

    if (byId['control-copec'] && byId['monitor-mg6']) {
      const combDia = data['monitor-mg6']?.telemetry?.dia?.combustibleL || '0';
      const volt = data['monitor-mg6']?.telemetry?.ultimoViaje?.voltajeMinV || '14.5';
      convs.push({
        from: 'control-copec',
        line1: '¿Cómo se portó el MG 6 con la bencina hoy? ⛽',
        to: 'monitor-mg6',
        line2: `¡Súper bien! ${combDia} L hoy y batería firme en ${volt}V 🔧`
      });
    }

    if (byId['simurdiera'] && byId['prof-farnsworth']) {
      const total = data['prof-farnsworth']?.filePreview?.totalLines || 100;
      convs.push({
        from: 'simurdiera',
        line1: 'Profe, ¿cayó alguna joya en oferta en Steam hoy? 🎧',
        to: 'prof-farnsworth',
        line2: `¡Buenas noticias! Ya llevo ${total} títulos en la bitácora 🧙`
      });
    }

    return convs;
  }
}
