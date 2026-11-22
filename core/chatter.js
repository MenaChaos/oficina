/**
 * CAPA DE VIDA Y DIÁLOGOS DE OFICINA (core/chatter.js)
 * Genera:
 * 1. Globos destacados inmediatos al hacer clic en cualquier avatar (con datos reales).
 * 2. Comentarios espontáneos de trabajo y conversaciones de 2 turnos entre personajes.
 * 3. Integración opcional con OpenAI (vía Code.gs ?action=chatter, cacheado 30 min para gastar casi $0).
 */

export class OfficeChatterEngine {
  constructor({ store, renderer, onStatusChange }) {
    this.store = store;
    this.renderer = renderer;
    this.onStatusChange = onStatusChange;

    this.timer = null;
    this.replyTimer = null;
    this.aiPack = null; // { highlights: {}, solo: [], conversations: [], generatedAt }
    this.aiStatus = 'local'; // 'local' | 'loading' | 'openai' | 'error'
    this.aiLastError = '';
    this.soloCursor = 0;
    this.convCursor = 0;
    this.turnCounter = 0;
    this.lastAiFetchTs = 0;
  }

  getPrefs() {
    const p = this.store.state.prefs || {};
    return {
      chatterMode: p.chatterMode || 'normal', // 'off' | 'calm' | 'normal' | 'lively'
      useOpenAI: p.useOpenAI !== false,       // true por defecto (si Code.gs tiene OPENAI_API_KEY, lo usa; si no, fallback local)
      avatarMotion: p.avatarMotion !== false  // true por defecto
    };
  }

  start() {
    this.stop();
    const { chatterMode } = this.getPrefs();
    if (chatterMode === 'off') return;

    // Primer globo ambiente rápido para que la oficina se sienta viva al abrirla
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

    // Evitar pedir más de una vez cada 20 min salvo que sea forzado
    const now = Date.now();
    if (!force && this.aiPack && now - this.lastAiFetchTs < 20 * 60 * 1000) {
      return this.aiPack;
    }

    this.aiStatus = 'loading';
    this.aiLastError = '';
    this.emitStatus();

    try {
      const res = await this.store.api.getChatter(force);
      if (res && res.chatter && res.source === 'openai') {
        this.aiPack = res.chatter;
        this.lastAiFetchTs = now;
        this.soloCursor = 0;
        this.convCursor = 0;
        this.aiStatus = 'openai';
      } else {
        this.aiStatus = 'local';
        if (res && res.note) this.aiLastError = res.note;
      }
    } catch (err) {
      // Si el backend aún no tiene la acción chatter, caemos silenciosamente al motor local
      this.aiStatus = 'local';
      this.aiLastError = err.message || '';
    }

    this.emitStatus();
    return this.aiPack;
  }

  emitStatus() {
    if (this.onStatusChange) {
      this.onStatusChange({
        status: this.aiStatus,
        error: this.aiLastError,
        hasPack: Boolean(this.aiPack)
      });
    }
  }

  isOfficeViewActive() {
    const el = document.querySelector('#view-office');
    return Boolean(el && el.classList.contains('active'));
  }

  tick() {
    const { chatterMode } = this.getPrefs();
    if (chatterMode === 'off') return;

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
    // Alternar: ~45% conversaciones de 2 turnos entre colegas, ~55% comentarios individuales de trabajo
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

    // Priorizar highlight generado por OpenAI si existe y no hay error crítico nuevo
    const aiLine = this.aiPack && this.aiPack.highlights && this.aiPack.highlights[agent.id];
    const text = aiLine || this.buildLocalHighlight(agent, live);
    const tone = status === 'ROJO' ? 'alert' : 'highlight';

    this.renderer.say(agent.id, text, 6500, tone);
  }

  playSoloRemark(activeAgents) {
    // 1. Si hay guion de OpenAI, alternar sus líneas frescas
    if (this.aiPack && Array.isArray(this.aiPack.solo) && this.aiPack.solo.length > 0) {
      const validIds = new Set(activeAgents.map((a) => a.id));
      for (let tries = 0; tries < this.aiPack.solo.length; tries++) {
        const entry = this.aiPack.solo[this.soloCursor % this.aiPack.solo.length];
        this.soloCursor++;
        if (entry && validIds.has(entry.agentId) && entry.text) {
          this.renderer.say(entry.agentId, entry.text, 5600, 'chat');
          return;
        }
      }
    }

    // 2. Motor local dinámico basado en los datos reales del agente
    const agent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
    const live = this.store.state.data[agent.id] || {};
    const lines = this.buildLocalSoloLines(agent, live);
    const picked = lines[Math.floor(Math.random() * lines.length)];
    this.renderer.say(agent.id, picked, 5400, live.status === 'ROJO' ? 'alert' : 'chat');
  }

  playConversation(activeAgents) {
    if (this.replyTimer) clearTimeout(this.replyTimer);

    const validIds = new Set(activeAgents.map((a) => a.id));

    // 1. Si hay conversaciones generadas por OpenAI, usarlas
    if (this.aiPack && Array.isArray(this.aiPack.conversations) && this.aiPack.conversations.length > 0) {
      for (let tries = 0; tries < this.aiPack.conversations.length; tries++) {
        const c = this.aiPack.conversations[this.convCursor % this.aiPack.conversations.length];
        this.convCursor++;
        if (c && validIds.has(c.from) && validIds.has(c.to) && c.from !== c.to && c.line1 && c.line2) {
          this.dispatchTwoTurnChat(c.from, c.line1, c.to, c.line2);
          return;
        }
      }
    }

    // 2. Motor local de conversaciones dinámicas cruzando datos reales
    const convs = this.buildLocalConversations(activeAgents);
    if (convs.length === 0) {
      this.playSoloRemark(activeAgents);
      return;
    }
    const picked = convs[Math.floor(Math.random() * convs.length)];
    this.dispatchTwoTurnChat(picked.from, picked.line1, picked.to, picked.line2);
  }

  dispatchTwoTurnChat(fromId, line1, toId, line2) {
    this.renderer.say(fromId, line1, 5600, 'chat', toId);
    this.replyTimer = setTimeout(() => {
      if (!this.isOfficeViewActive()) return;
      this.renderer.say(toId, line2, 5800, 'chat', fromId);
    }, 3400);
  }

  // ==========================================================================
  // GENERADOR LOCAL INTELIGENTE (USA LOS DATOS EN VIVO SIN COSTAR TOKENS)
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
        lines.push('¡Libros cuadrados y cero deudas este mes! 🧝✨');
      }
      lines.push('Revisando vencimientos de Luz, Agua e Internet...');
      lines.push('Manteniendo los pergaminos financieros en orden 📊');
      return lines;
    }

    if (agent.adapter === 'combustible_copec') {
      const m = live.metrics || {};
      if ((m.pendingReimbursementsCount || 0) > 0) {
        lines.push(`Tengo ${m.pendingReimbursementsCount} boletas COPEC esperando reembolso 🦊`);
      }
      lines.push(`Este mes van ${m.monthBencinaDisplay || '$0'} en bencina y ${m.monthDieselDisplay || '$0'} en diésel.`);
      lines.push('Preparando un espresso mientras archivo las boletas ☕');
      lines.push('Trazando la próxima ruta hacia La Serena 🗺️');
      return lines;
    }

    if (agent.adapter === 'mg6_mecanico') {
      const t = live.telemetry || {};
      const uv = t.ultimoViaje || {};
      lines.push(`Motor del MG 6 en ${t.estadoGeneral || 'VERDE'}: ${uv.tempMaxC || '-'}°C y ${uv.voltajeMinV || '-'}V 🔧`);
      lines.push('Revisando presión del riel GDI y trim de mezcla 🛠️');
      lines.push('Chequeando el último log OBD-II en el escáner 💻');
      if (t.dia?.distanciaKm === '0' || t.dia?.distanciaKm === '0.03') {
        lines.push('Hoy el MG 6 descansó bajo techo, pura prueba corta 🚗');
      }
      return lines;
    }

    if (agent.id === 'simurdiera') {
      lines.push('Escuchando música lo-fi mientras vigilo el clima 🎧');
      lines.push('¡Todo tranquilo en el servidor de Discord! 🐶');
      lines.push('Listo para avisar si se arma partida nocturna 🎮');
      lines.push('Chequeando nubes y camanchaca en Andacollo ☁️');
      return lines;
    }

    if (agent.id === 'prof-farnsworth') {
      const total = live.filePreview?.totalLines || 0;
      lines.push('¡Buenas noticias a todos! Escaneando rebajas en Steam 🧙');
      if (total > 0) lines.push(`Ya van ${total} juegos históricos cazados en mi bitácora 📜`);
      lines.push('Destilando pociones de descuento al 75%... 🧪');
      lines.push('El terminal CRT acaba de detectar movimiento en Steam 🖥️');
      return lines;
    }

    return [
      live.headline || 'Monitoreando mi estación...',
      'Todo operando con normalidad por aquí ✨',
      'Revisando los últimos registros...'
    ];
  }

  buildLocalConversations(activeAgents) {
    const byId = Object.fromEntries(activeAgents.map((a) => [a.id, a]));
    const data = this.store.state.data || {};
    const convs = [];

    // 1. Elfo Contador <-> Zorrito COPEC
    if (byId['cuentas-hogar'] && byId['control-copec']) {
      const pendFuel = data['control-copec']?.metrics?.pendingReimbursementsCount ?? 0;
      const pendBills = data['cuentas-hogar']?.metrics?.pendingCount ?? 0;
      convs.push({
        from: 'cuentas-hogar',
        line1: pendFuel > 0
          ? `Zorrito, ¿ya rendiste esas ${pendFuel} boletas de COPEC?`
          : 'Zorrito, ¿cómo cerramos las boletas de combustible?',
        to: 'control-copec',
        line2: pendFuel > 0
          ? `¡En eso estoy! Llevo ${data['control-copec']?.metrics?.monthDieselDisplay || '$0'} en diésel este mes 🦊`
          : '¡Todo rendido y ordenadito con café en mano! ☕'
      });
      if (pendBills > 0) {
        convs.push({
          from: 'control-copec',
          line1: '¿Te paso un café, Elfo? Te veo rodeado de cuentas ☕',
          to: 'cuentas-hogar',
          line2: `¡Sí por favor! Quedan ${pendBills} cuentas por ${data['cuentas-hogar']?.metrics?.totalPendingDisplay || '$0'} 🧝`
        });
      }
    }

    // 2. Zorrito COPEC <-> Gnomo Mecánico MG 6
    if (byId['control-copec'] && byId['monitor-mg6']) {
      const combDia = data['monitor-mg6']?.telemetry?.dia?.combustibleL || '0';
      const volt = data['monitor-mg6']?.telemetry?.ultimoViaje?.voltajeMinV || '14.5';
      convs.push({
        from: 'control-copec',
        line1: '¿Cómo se portó el MG 6 con la 95 octanos hoy? ⛽',
        to: 'monitor-mg6',
        line2: `¡Súper bien! Solo ${combDia} L hoy y batería firme en ${volt}V 🔧`
      });
      convs.push({
        from: 'monitor-mg6',
        line1: 'Oye Zorrito, la mezcla del turbo está impecable hoy 🛠️',
        to: 'control-copec',
        line2: '¡Excelente! Así rinde más la bencina en la bajada a La Serena 🗺️'
      });
    }

    // 3. Simurdiera <-> Prof. Farnsworth
    if (byId['simurdiera'] && byId['prof-farnsworth']) {
      const total = data['prof-farnsworth']?.filePreview?.totalLines || 100;
      convs.push({
        from: 'simurdiera',
        line1: 'Profe, ¿cayó alguna joya en oferta en Steam hoy? 🎧',
        to: 'prof-farnsworth',
        line2: `¡Buenas noticias! Ya llevo ${total} títulos en la bitácora arcana 🧙`
      });
      convs.push({
        from: 'prof-farnsworth',
        line1: 'Simurdiera, ¿cómo está el ánimo en Discord esta tarde? 🧪',
        to: 'simurdiera',
        line2: '¡Todo en VERDE! Listo para convocar apenas se conecten 🐶'
      });
    }

    // 4. Gnomo Mecánico <-> Prof. Farnsworth
    if (byId['monitor-mg6'] && byId['prof-farnsworth']) {
      convs.push({
        from: 'prof-farnsworth',
        line1: '¿Y ese escáner OBD-II encontró algún gremlin en el garage? 🧙',
        to: 'monitor-mg6',
        line2: `Ninguno, Profe: semáforo en ${data['monitor-mg6']?.telemetry?.estadoGeneral || 'VERDE'} y caja 7DCT sana 🔧`
      });
    }

    // 5. Elfo Contador <-> Prof. Farnsworth
    if (byId['cuentas-hogar'] && byId['prof-farnsworth']) {
      convs.push({
        from: 'cuentas-hogar',
        line1: 'Profe, ¡cuidado con tentar con ofertas de Steam antes de pagar la luz! 🧝',
        to: 'prof-farnsworth',
        line2: '¡Ciencia es ciencia, Elfo! Un 80% de descuento es inversión 🧪'
      });
    }

    return convs;
  }
}
