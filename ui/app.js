/**
 * CAPA DE INTERFAZ Y CONTROLADOR PRINCIPAL v3 (ui/app.js)
 * Conecta OfficeStore, RoomAssetManager, OfficeRenderer y BridgeAPI.
 */

import { OfficeStore } from '../core/store.js';
import { OfficeRenderer } from '../core/renderer.js';
import { RoomAssetManager, compressImageFileToDataUrl } from '../core/assets.js';
import { THEMES } from '../themes/themes.js';
import { ROOM_TEMPLATES, getRoomTemplate } from '../config/rooms.js';
import { parseSteamHistoryLines } from '../core/api.js';

const store = new OfficeStore();
let assetManager = null;
let renderer = null;
let refreshTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' err' : '');
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function init() {
  assetManager = new RoomAssetManager(() => {
    renderRoomsGallery();
  });

  renderer = new OfficeRenderer($('#office-canvas'), assetManager, (agentId) => {
    store.state.selectedAgentId = agentId;
    renderQuickbar();
    openInspector(agentId);
  });

  populateRoomStyleSelect();
  bindGlobalEvents();
  bindAuthModal();
  bindAgentCrudModal();
  bindOfficeCrudModal();
  bindDesignView();

  if (store.state.prefs.dim) {
    $('#dim-overlay').classList.add('active');
    $('#btn-dim').classList.add('active');
  }

  store.subscribe((state, event) => {
    renderAll(event === 'theme_changed' || event === 'agent_changed');
  });

  renderAll();

  if (store.state.apiSecret) {
    store
      .connectAndBootstrap()
      .then(() => {
        scheduleAutoRefresh();
        toast('Oficina Cozy sincronizada en vivo');
      })
      .catch((err) => {
        showAuthModal('No se pudo conectar automáticamente: ' + err.message);
      });
  } else {
    showAuthModal();
  }
}

function populateRoomStyleSelect() {
  $('#af-room-style').innerHTML = Object.values(ROOM_TEMPLATES)
    .map((r) => `<option value="${r.id}">${r.icon} ${r.name}</option>`)
    .join('');
}

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const mins = Number(store.state.config.refreshMinutes || 0);
  if (mins > 0 && store.state.mode === 'online') {
    refreshTimer = setInterval(() => {
      store.syncData(false).catch(() => {});
    }, mins * 60 * 1000);
  }
}

function bindGlobalEvents() {
  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.view;
      $$('.view').forEach((v) => v.classList.remove('active'));
      $('#view-' + target).classList.add('active');
      if (target === 'office') setTimeout(() => renderer.resize(), 40);
      if (target === 'dashboard') renderDashboard();
    });
  });

  $('#office-selector').addEventListener('change', (e) => {
    store.setActiveOffice(e.target.value);
    closeInspector();
    renderer.resetCamera();
  });

  $('#btn-layout-toggle').addEventListener('click', async () => {
    const next = store.getLayoutMode() === 'cozy-rooms' ? 'open-floor' : 'cozy-rooms';
    await store.setLayoutMode(next);
    toast(next === 'cozy-rooms' ? 'Vista: Salas Cozy en tarjetas' : 'Vista: Campus Cozy completo');
  });

  $('#btn-sync').addEventListener('click', async () => {
    try {
      await store.syncData(true);
      toast('Datos actualizados');
    } catch (err) {
      toast('Error al sincronizar: ' + err.message, true);
    }
  });

  $('#dash-refresh-btn').addEventListener('click', () => $('#btn-sync').click());

  $('#btn-dim').addEventListener('click', () => {
    store.state.prefs.dim = !store.state.prefs.dim;
    store.saveLocalPrefs();
    $('#dim-overlay').classList.toggle('active', store.state.prefs.dim);
    $('#btn-dim').classList.toggle('active', store.state.prefs.dim);
  });

  $('#btn-kiosk').addEventListener('click', () => {
    document.body.classList.add('kiosk');
    $('#btn-exit-kiosk').classList.remove('hidden');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setTimeout(() => renderer.resize(), 80);
  });

  $('#btn-exit-kiosk').addEventListener('click', () => {
    document.body.classList.remove('kiosk');
    $('#btn-exit-kiosk').classList.add('hidden');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setTimeout(() => renderer.resize(), 80);
  });

  $('#cam-zoom-in').addEventListener('click', () => renderer.zoomBy(1.18));
  $('#cam-zoom-out').addEventListener('click', () => renderer.zoomBy(0.85));
  $('#cam-reset').addEventListener('click', () => renderer.resetCamera());
  $('#drawer-close').addEventListener('click', closeInspector);

  $('#drawer-edit-room').addEventListener('click', () => {
    if (!store.state.selectedAgentId) return;
    const agent = store.getActiveOffice().agents.find((a) => a.id === store.state.selectedAgentId);
    if (agent) openAgentModal(agent);
  });

  $('#alerts-pill').addEventListener('click', () => {
    const body = $('#alerts-modal-body');
    const alerts = store.state.systemAlerts || [];
    body.innerHTML = alerts.length
      ? alerts
          .map(
            (a) => `<div class="mini-row">
              <div><strong>${esc(a.source)}</strong><div class="muted small">${esc(a.subject)}</div></div>
              <span class="muted small">${esc(a.date)}</span>
            </div>`
          )
          .join('')
      : '<p class="muted">Sin alertas recientes.</p>';
    $('#alerts-modal').classList.remove('hidden');
  });
  $('#alerts-modal-close').addEventListener('click', () => $('#alerts-modal').classList.add('hidden'));
}

function showAuthModal(errMsg = '') {
  $('#auth-url-input').value = store.state.bridgeUrl;
  $('#auth-secret-input').value = store.state.apiSecret || '';
  const errEl = $('#auth-error');
  if (errMsg) {
    errEl.textContent = errMsg;
    errEl.classList.remove('hidden');
  } else {
    errEl.classList.add('hidden');
  }
  $('#auth-modal').classList.remove('hidden');
}

function bindAuthModal() {
  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#auth-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Conectando con Google & GitHub...';
    $('#auth-error').classList.add('hidden');

    try {
      await store.connectAndBootstrap($('#auth-url-input').value.trim(), $('#auth-secret-input').value.trim(), true);
      $('#auth-modal').classList.add('hidden');
      scheduleAutoRefresh();
      toast('¡Conectado a tus automatizaciones reales!');
    } catch (err) {
      $('#auth-error').textContent = err.message || 'No se pudo autenticar.';
      $('#auth-error').classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Conectar Oficina Real';
    }
  });

  $('#auth-demo-btn').addEventListener('click', () => {
    store.enterDemoMode();
    $('#auth-modal').classList.add('hidden');
    toast('Modo Demo offline activado');
  });
}

function renderAll(triggerRemodel = false) {
  const office = store.getActiveOffice();
  const { mode, lastSync, systemAlerts, isSyncing } = store.state;
  const layoutMode = store.getLayoutMode();

  const dot = $('#conn-dot');
  dot.className = 'brand-dot ' + (mode === 'online' ? 'online' : mode === 'demo' ? 'demo' : 'error');

  $('#sync-status').textContent = isSyncing
    ? 'Sincronizando...'
    : lastSync
    ? (mode === 'demo' ? 'Demo · ' : 'En vivo · ') +
      lastSync.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : 'Sin sincronizar';

  if (systemAlerts && systemAlerts.length > 0) {
    $('#alerts-pill').classList.remove('hidden');
    $('#alerts-count').textContent = systemAlerts.length;
  } else {
    $('#alerts-pill').classList.add('hidden');
  }

  $('#office-selector').innerHTML = store.state.config.offices
    .map(
      (o) => `<option value="${esc(o.id)}" ${o.id === office.id ? 'selected' : ''}>${esc(o.icon || '🏡')} ${esc(o.name)}</option>`
    )
    .join('');

  $('#hud-office-name').textContent = `${office.icon || '🏡'} ${office.name}`;
  $('#hud-office-sub').textContent = office.subtitle || `${office.agents.length} salas activas`;

  let rojos = 0, amarillos = 0, verdes = 0;
  office.agents.forEach((a) => {
    const st = a.enabled === false ? 'PAUSADO' : (store.state.data[a.id] || {}).status || 'VERDE';
    if (st === 'ROJO') rojos++;
    else if (st === 'AMARILLO') amarillos++;
    else if (st === 'VERDE') verdes++;
  });

  $('#hud-summary-pills').innerHTML = `
    <span class="hud-pill green">● ${verdes} OK</span>
    ${amarillos ? `<span class="hud-pill yellow">▲ ${amarillos} Revisión</span>` : ''}
    ${rojos ? `<span class="hud-pill red">● ${rojos} Urgente</span>` : ''}
  `;

  renderer.setScene({
    agents: office.agents,
    agentData: store.state.data,
    themeId: store.getActiveThemeId(),
    layoutMode,
    selectedAgentId: store.state.selectedAgentId,
    triggerRemodel
  });

  renderQuickbar();
  renderDashboard();
  renderManager();
  renderDesignPanel();

  if (store.state.selectedAgentId) {
    const exists = office.agents.some((a) => a.id === store.state.selectedAgentId);
    if (exists) openInspector(store.state.selectedAgentId, false);
    else closeInspector();
  }
}

function renderQuickbar() {
  const office = store.getActiveOffice();
  const colors = { VERDE: '#22c55e', AMARILLO: '#f59e0b', ROJO: '#ef4444', PAUSADO: '#94a3b8' };
  $('#agent-quickbar').innerHTML = office.agents
    .map((a) => {
      const st = a.enabled === false ? 'PAUSADO' : (store.state.data[a.id] || {}).status || 'VERDE';
      const tpl = getRoomTemplate(a.roomStyle, a);
      const sel = store.state.selectedAgentId === a.id ? 'selected' : '';
      return `<button class="quick-chip ${sel}" data-agent="${esc(a.id)}">
        <span class="chip-dot" style="background:${colors[st] || '#22c55e'}"></span>
        ${tpl.icon} ${esc(a.name)}
      </button>`;
    })
    .join('');

  $$('#agent-quickbar .quick-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.state.selectedAgentId = btn.dataset.agent;
      renderQuickbar();
      openInspector(btn.dataset.agent);
      renderer.setScene({
        agents: office.agents,
        agentData: store.state.data,
        themeId: store.getActiveThemeId(),
        layoutMode: store.getLayoutMode(),
        selectedAgentId: btn.dataset.agent
      });
    });
  });
}

function openInspector(agentId, openDrawer = true) {
  const office = store.getActiveOffice();
  const agent = office.agents.find((a) => a.id === agentId);
  if (!agent) return;

  const live = store.state.data[agent.id] || {};
  const status = agent.enabled === false ? 'PAUSADO' : live.status || 'VERDE';
  const tpl = getRoomTemplate(agent.roomStyle, agent);

  const badge = $('#drawer-badge');
  badge.textContent = status;
  badge.className = 'status-badge ' + status;
  $('#drawer-title').textContent = agent.name;
  $('#drawer-role').textContent = `${tpl.icon} ${tpl.name} · ${agent.role}`;
  $('#drawer-body').innerHTML = buildAgentDetailHTML(agent, live);

  bindAgentDetailActions($('#drawer-body'), agent);
  if (openDrawer) $('#inspector-drawer').classList.remove('closed');
}

function closeInspector() {
  store.state.selectedAgentId = null;
  $('#inspector-drawer').classList.add('closed');
  renderQuickbar();
}

function formatShortSteamDate(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr || '';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(m[3])} ${meses[Number(m[2]) - 1] || m[2]}`;
}

function buildAgentDetailHTML(agent, live, compact = false) {
  if (!live || Object.keys(live).length === 0) {
    return `<div class="text-block">Sin datos cargados todavía. Pulsa 🔄 para sincronizar con tu puente.</div>`;
  }
  if (live.error) {
    return `<div class="alerts-banner"><strong>Error del adaptador:</strong><br/>${esc(live.error)}</div>`;
  }

  let html = `<div class="text-block"><h4>Estado actual</h4>${esc(live.headline || 'Operativo')}</div>`;

  if (agent.adapter === 'servicios_hogar' && Array.isArray(live.items)) {
    html += `<div class="bills-grid">` +
      live.items
        .map((it) => {
          const cls = it.isPaid ? 'paid' : it.isOverdue ? 'overdue' : 'pending';
          const nextState = it.isPaid ? 'Pendiente' : 'Pagado';
          return `<div class="bill-tile ${cls}">
            <div class="bill-name">${esc(it.label)}</div>
            <div class="bill-amount">${esc(it.amountDisplay)}</div>
            <div class="bill-meta">📅 ${esc(it.dueDateText)} · ${esc(it.status)}</div>
            <button class="btn btn-sm btn-secondary" data-action="bill" data-tab="${esc(it.tabName)}" data-next="${nextState}">
              ${it.isPaid ? 'Marcar Pendiente' : '✓ Marcar Pagado'}
            </button>
          </div>`;
        })
        .join('') +
      `</div>`;
  }

  if (agent.adapter === 'combustible_copec') {
    const lr = live.lastReceipt;
    const m = live.metrics || {};
    html += `<div class="kpi-row">
      <div class="kpi-box"><div class="kpi-label">Bencina Mes</div><div class="kpi-val">${esc(m.monthBencinaDisplay || '$0')}</div></div>
      <div class="kpi-box"><div class="kpi-label">Diésel Mes</div><div class="kpi-val">${esc(m.monthDieselDisplay || '$0')}</div></div>
      <div class="kpi-box"><div class="kpi-label">Pend. Reemb.</div><div class="kpi-val">${esc(m.pendingReimbursementsCount ?? 0)}</div></div>
    </div>`;

    if (lr) {
      html += `<div class="text-block">
        <h4>Última boleta COPEC</h4>
        <strong>${esc(lr.combustible)}</strong> · ${esc(lr.montoDisplay)}<br/>
        <span class="muted small">${esc(lr.fecha)} · ${esc(lr.modoPago)} · Fila #${esc(lr.rowNumber)}</span>
      </div>`;
    }

    if (Array.isArray(live.pendingReimbursements) && live.pendingReimbursements.length > 0) {
      const visibleCount = compact ? 3 : 6;
      const topRows = live.pendingReimbursements.slice(0, visibleCount);
      const restRows = live.pendingReimbursements.slice(visibleCount, 10);
      const renderReembRow = (r) => `<div class="mini-row">
        <div><strong>${esc(r.fecha)}</strong> · ${esc(r.combustible)} <strong>${esc(r.montoDisplay)}</strong></div>
        <button class="btn btn-sm btn-primary" data-action="reimburse" data-row="${r.rowNumber}">✓ Reemb.</button>
      </div>`;

      html += `<div class="mini-list">${topRows.map(renderReembRow).join('')}</div>`;
      if (restRows.length > 0) {
        html += `<details class="collapsible-block">
          <summary>Ver ${restRows.length} boleta(s) pendiente(s) más</summary>
          <div class="mini-list" style="margin-top:8px">${restRows.map(renderReembRow).join('')}</div>
        </details>`;
      }
    }
  }

  if (agent.adapter === 'mg6_mecanico' && live.telemetry) {
    const t = live.telemetry;
    const uv = t.ultimoViaje || {};
    const dia = t.dia || {};
    html += `<div class="kpi-row">
      <div class="kpi-box"><div class="kpi-label">Día Dist.</div><div class="kpi-val">${esc(dia.distanciaKm)} km</div></div>
      <div class="kpi-box"><div class="kpi-label">Combust.</div><div class="kpi-val">${esc(dia.combustibleL)} L</div></div>
      <div class="kpi-box"><div class="kpi-label">Temp Máx</div><div class="kpi-val">${esc(uv.tempMaxC)}°C</div></div>
      <div class="kpi-box"><div class="kpi-label">Volt. Mín</div><div class="kpi-val">${esc(uv.voltajeMinV)} V</div></div>
    </div>
    <div class="text-block"><h4>Acción Recomendada</h4>${esc(t.accionRecomendada)}</div>`;

    if (compact) {
      html += `<details class="collapsible-block">
        <summary>📋 Diagnóstico Preventivo completo</summary>
        <div class="collapsible-content">${esc(t.resumenEstado)}</div>
      </details>
      <details class="collapsible-block">
        <summary>📈 Tendencia Histórica (3–6 meses)</summary>
        <div class="collapsible-content">${esc(t.tendenciaHistorica)}</div>
      </details>`;
    } else {
      html += `<div class="text-block"><h4>Diagnóstico Preventivo</h4>${esc(t.resumenEstado)}</div>
      <div class="text-block"><h4>Tendencia Histórica</h4>${esc(t.tendenciaHistorica)}</div>`;
    }
  }

  if (live.github && live.github.repo) {
    const gh = live.github;
    html += `<div class="mini-row">
      <div>
        <strong>GitHub Actions #${esc(gh.runNumber || '-')}</strong>
        <div class="muted small">${esc(gh.owner)}/${esc(gh.repo)} · ${esc(gh.conclusion || gh.status)}</div>
      </div>
      <button class="btn btn-sm btn-primary" data-action="trigger_wf">▶ Ejecutar</button>
    </div>`;
  }

  if (live.filePreview && Array.isArray(live.filePreview.recentLines)) {
    const steamGames = parseSteamHistoryLines(live.filePreview.recentLines);
    if (steamGames.length > 0) {
      html += `<div><div class="field-label">Últimos juegos detectados en Steam (${live.filePreview.totalLines} en bitácora)</div>
        <div class="steam-grid">` +
        steamGames
          .slice(0, compact ? 4 : 6)
          .map(
            (g) => `<a class="steam-card" href="${g.storeUrl}" target="_blank" rel="noopener">
              <img src="${g.imageUrl}" onerror="this.src='${g.fallbackUrl}'" alt="Steam ${g.appId}" loading="lazy" />
              <div class="steam-card-info">
                <strong>#${g.appId}</strong>
                <span class="muted">${esc(formatShortSteamDate(g.date))}</span>
              </div>
            </a>`
          )
          .join('') +
        `</div></div>`;
    } else {
      html += `<div class="text-block"><h4>${esc(live.filePreview.fileName)}</h4>${live.filePreview.recentLines.map(esc).join('<br/>')}</div>`;
    }
  }

  if (live.kv || live.lastRow || live.raw) {
    const obj = live.kv || live.lastRow || live.raw;
    html += `<div class="text-block"><h4>Datos recibidos</h4><pre style="margin:0;white-space:pre-wrap;font-size:0.78rem">${esc(
      JSON.stringify(obj, null, 2).slice(0, 1200)
    )}</pre></div>`;
  }

  return html;
}

function bindAgentDetailActions(container, agent) {
  container.querySelectorAll('[data-action="bill"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tabName = btn.dataset.tab;
      const nextStatus = btn.dataset.next;
      btn.disabled = true;
      try {
        if (store.state.mode === 'online') {
          await store.api.markBillStatus(tabName, nextStatus, agent.config?.sheetId);
          renderer.say(agent.id, `${tabName}: ${nextStatus} ✓`);
          await store.syncData(true);
        } else {
          const item = (store.state.data[agent.id]?.items || []).find((x) => x.tabName === tabName);
          if (item) { item.status = nextStatus; item.isPaid = nextStatus === 'Pagado'; item.isOverdue = false; }
          renderer.say(agent.id, `Demo: ${tabName} → ${nextStatus}`);
          renderAll();
        }
        toast(`${tabName} marcado como ${nextStatus}`);
      } catch (err) {
        toast('Error: ' + err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-action="reimburse"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const rowNum = Number(btn.dataset.row);
      btn.disabled = true;
      try {
        if (store.state.mode === 'online') {
          await store.api.markFuelReimbursed(rowNum, true, agent.config?.sheetId);
          renderer.say(agent.id, `Fila #${rowNum} reembolsada ✓`);
          await store.syncData(true);
        } else {
          toast(`Demo: fila #${rowNum} marcada como reembolsada`);
        }
      } catch (err) {
        toast('Error: ' + err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-action="trigger_wf"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (store.state.mode === 'online') {
          await store.api.triggerWorkflow({
            owner: agent.config?.owner,
            repo: agent.config?.repo,
            workflowId: agent.config?.workflowId || '',
            branch: agent.config?.branch || 'main'
          });
          renderer.say(agent.id, 'Workflow ejecutándose...');
          toast(`Workflow disparado en ${agent.config?.repo}`);
          setTimeout(() => store.syncData(true).catch(() => {}), 3500);
        } else {
          renderer.say(agent.id, 'Demo: ejecutando workflow');
          toast('Modo Demo: disparo simulado');
        }
      } catch (err) {
        toast('No se pudo disparar: ' + err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function estimateCardWeight(agent) {
  const weights = {
    servicios_hogar: 3.6,
    combustible_copec: 4.2,
    mg6_mecanico: 3.8,
    github_action: agent.config?.readFile ? 3.5 : 1.7
  };
  return weights[agent.adapter] || 2.2;
}

function renderDashboard() {
  const office = store.getActiveOffice();
  $('#dash-subtitle').textContent = `${office.icon || '🏡'} ${office.name} — ${office.agents.length} agentes configurados`;

  const alertsBox = $('#dashboard-alerts-box');
  if (store.state.systemAlerts.length > 0) {
    alertsBox.classList.remove('hidden');
    alertsBox.innerHTML =
      `<strong>⚠️ Alertas recientes detectadas en Gmail:</strong><br/>` +
      store.state.systemAlerts.map((a) => `• [${esc(a.source)} · ${esc(a.date)}] ${esc(a.subject)}`).join('<br/>');
  } else {
    alertsBox.classList.add('hidden');
  }

  const grid = $('#dashboard-grid');
  const w = window.innerWidth;
  const colCount = w >= 1020 ? 3 : w >= 680 ? 2 : 1;

  // Distribuir tarjetas en columnas balanceadas (Masonry real sin huecos vacíos)
  const columns = Array.from({ length: colCount }, () => ({ weight: 0, html: [] }));

  office.agents.forEach((agent) => {
    const live = store.state.data[agent.id] || {};
    const status = agent.enabled === false ? 'PAUSADO' : live.status || 'VERDE';
    const tpl = getRoomTemplate(agent.roomStyle, agent);
    const cardHtml = `<article class="widget-card" data-widget-agent="${esc(agent.id)}">
      <div class="widget-head">
        <div>
          <h3>${tpl.icon} ${esc(agent.name)}</h3>
          <div class="muted">${esc(tpl.shortName || tpl.name)} · ${esc(agent.role)}</div>
        </div>
        <span class="status-badge ${status}">${status}</span>
      </div>
      <div class="form-stack">${buildAgentDetailHTML(agent, live, true)}</div>
    </article>`;

    // Colocar siempre en la columna más corta para eliminar espacios muertos
    let shortest = columns[0];
    for (let i = 1; i < columns.length; i++) {
      if (columns[i].weight < shortest.weight) shortest = columns[i];
    }
    shortest.html.push(cardHtml);
    shortest.weight += estimateCardWeight(agent);
  });

  grid.innerHTML = columns
    .map((col) => `<div class="masonry-col">${col.html.join('')}</div>`)
    .join('');

  office.agents.forEach((agent) => {
    const card = grid.querySelector(`[data-widget-agent="${CSS.escape(agent.id)}"]`);
    if (card) bindAgentDetailActions(card, agent);
  });
}

function renderManager() {
  const offices = store.state.config.offices;
  const active = store.getActiveOffice();
  $('#mgr-office-name').textContent = active.name;
  $('#mgr-agent-count').textContent = `${active.agents.length} sala(s)`;

  $('#offices-list').innerHTML = offices
    .map(
      (o) => `<div class="entity-item ${o.id === active.id ? 'active-office' : ''}">
        <div class="entity-info">
          <div class="entity-title">${esc(o.icon || '🏡')} ${esc(o.name)}</div>
          <div class="entity-meta">${esc(o.subtitle || 'Sin descripción')} · ${o.agents.length} agente(s)</div>
        </div>
        <div class="entity-actions">
          <button class="btn btn-sm btn-secondary" data-use-office="${esc(o.id)}">${o.id === active.id ? 'Activa' : 'Abrir'}</button>
          <button class="btn btn-sm btn-ghost" data-edit-office="${esc(o.id)}">✏️</button>
          <button class="btn btn-sm btn-danger-ghost" data-del-office="${esc(o.id)}">🗑️</button>
        </div>
      </div>`
    )
    .join('');

  $('#agents-list').innerHTML = active.agents.length
    ? active.agents
        .map((a) => {
          const tpl = getRoomTemplate(a.roomStyle, a);
          return `<div class="entity-item">
            <div class="entity-info">
              <div class="entity-title">${tpl.icon} ${esc(a.name)} ${a.enabled === false ? '<span class="muted small">(Pausado)</span>' : ''}</div>
              <div class="entity-meta">Sala: <strong>${esc(tpl.name)}</strong> · <code>${esc(a.adapter)}</code></div>
            </div>
            <div class="entity-actions">
              <button class="btn btn-sm btn-secondary" data-edit-agent="${esc(a.id)}">Editar</button>
              <button class="btn btn-sm btn-danger-ghost" data-del-agent="${esc(a.id)}">Eliminar</button>
            </div>
          </div>`;
        })
        .join('')
    : '<p class="muted">Esta oficina aún no tiene agentes. Pulsa "+ Nuevo Agente" para agregar el primero.</p>';

  $$('[data-use-office]').forEach((b) => b.addEventListener('click', () => store.setActiveOffice(b.dataset.useOffice)));
  $$('[data-edit-office]').forEach((b) => {
    b.addEventListener('click', () => {
      const o = offices.find((x) => x.id === b.dataset.editOffice);
      if (o) openOfficeModal(o);
    });
  });
  $$('[data-del-office]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta oficina y sus agentes?')) return;
      try {
        await store.deleteOffice(b.dataset.delOffice);
        toast('Oficina eliminada');
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  $$('[data-edit-agent]').forEach((b) => {
    b.addEventListener('click', () => {
      const a = active.agents.find((x) => x.id === b.dataset.editAgent);
      if (a) openAgentModal(a);
    });
  });
  $$('[data-del-agent]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este agente de la oficina?')) return;
      await store.deleteAgent(b.dataset.delAgent);
      toast('Agente eliminado');
    });
  });
}

function renderDynamicAdapterFields(adapter, cfg = {}) {
  const box = $('#af-dynamic-fields');
  if (adapter === 'github_action') {
    box.innerHTML = `
      <div class="form-row-2">
        <div><label class="field-label">Usuario GitHub (owner)</label><input id="dyn-owner" class="input" value="${esc(cfg.owner || 'MenaChaos')}" /></div>
        <div><label class="field-label">Repositorio</label><input id="dyn-repo" class="input" value="${esc(cfg.repo || '')}" placeholder="ej: ofertas-profesor" required /></div>
      </div>
      <div class="form-row-2">
        <div><label class="field-label">Workflow (.yml opcional)</label><input id="dyn-wf" class="input" value="${esc(cfg.workflowId || '')}" placeholder="Vacío = automático" /></div>
        <div><label class="field-label">Archivo a leer (opcional)</label><input id="dyn-file" class="input" value="${esc(cfg.readFile || '')}" placeholder="ej: historial.txt o widget.json" /></div>
      </div>`;
  } else if (adapter === 'google_sheet') {
    box.innerHTML = `
      <div class="form-row-2">
        <div><label class="field-label">ID de Google Sheet</label><input id="dyn-sheet" class="input" value="${esc(cfg.sheetId || '')}" placeholder="ID entre /d/ y /edit" required /></div>
        <div><label class="field-label">Nombre de pestaña</label><input id="dyn-tab" class="input" value="${esc(cfg.tabName || 'Hoja 1')}" /></div>
      </div>
      <div class="form-row-2">
        <div><label class="field-label">Modo de lectura</label>
          <select id="dyn-mode" class="input">
            <option value="last_row" ${cfg.mode === 'last_row' ? 'selected' : ''}>Última fila</option>
            <option value="key_value" ${cfg.mode === 'key_value' ? 'selected' : ''}>Clave - Valor (Col A/B)</option>
            <option value="count_pending" ${cfg.mode === 'count_pending' ? 'selected' : ''}>Contar pendientes</option>
          </select>
        </div>
        <div><label class="field-label">Palabra pendiente (si aplica)</label><input id="dyn-pending" class="input" value="${esc(cfg.pendingValue || 'Pendiente')}" /></div>
      </div>`;
  } else if (adapter === 'webhook_json') {
    box.innerHTML = `<div><label class="field-label">URL del endpoint JSON</label><input id="dyn-url" type="url" class="input" value="${esc(cfg.url || '')}" placeholder="https://..." required /></div>`;
  } else if (adapter === 'mg6_mecanico') {
    box.innerHTML = `
      <div class="form-row-2">
        <div><label class="field-label">Sheet ID (o SHEET_ID_MG6)</label><input id="dyn-sheet" class="input" value="${esc(cfg.sheetId || 'SHEET_ID_MG6')}" /></div>
        <div><label class="field-label">Pestaña Widget</label><input id="dyn-tab" class="input" value="${esc(cfg.widgetTab || 'Resumen_Widget')}" /></div>
      </div>
      <div class="form-row-2">
        <div><label class="field-label">Repo GitHub</label><input id="dyn-repo" class="input" value="${esc(cfg.repo || 'obd-mg6')}" /></div>
        <div><label class="field-label">Workflow (.yml)</label><input id="dyn-wf" class="input" value="${esc(cfg.workflowId || 'daily_audit.yml')}" /></div>
      </div>`;
  } else if (adapter === 'combustible_copec') {
    box.innerHTML = `
      <div class="form-row-2">
        <div><label class="field-label">Sheet ID (o SHEET_ID_COMBUSTIBLE)</label><input id="dyn-sheet" class="input" value="${esc(cfg.sheetId || 'SHEET_ID_COMBUSTIBLE')}" /></div>
        <div><label class="field-label">Pestaña</label><input id="dyn-tab" class="input" value="${esc(cfg.tabName || 'Hoja 1')}" /></div>
      </div>`;
  } else {
    box.innerHTML = `<div><label class="field-label">Sheet ID (o SHEET_ID_SERVICIOS)</label><input id="dyn-sheet" class="input" value="${esc(cfg.sheetId || 'SHEET_ID_SERVICIOS')}" /></div>`;
  }
}

function collectAgentFromForm() {
  const adapter = $('#af-adapter').value;
  let config = {};
  if (adapter === 'github_action') {
    config = {
      owner: $('#dyn-owner').value.trim() || 'MenaChaos',
      repo: $('#dyn-repo').value.trim(),
      workflowId: $('#dyn-wf').value.trim(),
      branch: 'main',
      readFile: $('#dyn-file').value.trim()
    };
  } else if (adapter === 'google_sheet') {
    config = {
      sheetId: $('#dyn-sheet').value.trim(),
      tabName: $('#dyn-tab').value.trim(),
      mode: $('#dyn-mode').value,
      pendingValue: $('#dyn-pending').value.trim() || 'Pendiente'
    };
  } else if (adapter === 'webhook_json') {
    config = { url: $('#dyn-url').value.trim() };
  } else if (adapter === 'mg6_mecanico') {
    config = {
      sheetId: $('#dyn-sheet').value.trim() || 'SHEET_ID_MG6',
      widgetTab: $('#dyn-tab').value.trim() || 'Resumen_Widget',
      owner: 'MenaChaos',
      repo: $('#dyn-repo').value.trim() || 'obd-mg6',
      workflowId: $('#dyn-wf').value.trim() || 'daily_audit.yml',
      branch: 'main'
    };
  } else if (adapter === 'combustible_copec') {
    config = {
      sheetId: $('#dyn-sheet').value.trim() || 'SHEET_ID_COMBUSTIBLE',
      tabName: $('#dyn-tab').value.trim() || 'Hoja 1'
    };
  } else {
    config = { sheetId: $('#dyn-sheet').value.trim() || 'SHEET_ID_SERVICIOS' };
  }

  return {
    id: $('#af-id').value || 'agente-' + Date.now().toString(36),
    name: $('#af-name').value.trim(),
    role: $('#af-role').value.trim(),
    avatar: $('#af-avatar').value,
    roomStyle: $('#af-room-style').value,
    roomImageUrl: $('#af-room-image').value.trim() || '',
    roomAccent: $('#af-room-accent').value,
    adapter,
    enabled: $('#af-enabled').value === 'true',
    config
  };
}

function openAgentModal(agent = null) {
  const tpl = getRoomTemplate(agent?.roomStyle, agent);
  $('#agent-modal-title').textContent = agent ? 'Editar Agente y Habitación' : 'Nuevo Agente';
  $('#af-id').value = agent ? agent.id : '';
  $('#af-name').value = agent ? agent.name : '';
  $('#af-role').value = agent ? agent.role : '';
  $('#af-avatar').value = agent ? agent.avatar : 'robot';
  $('#af-room-style').value = tpl.id;
  $('#af-room-image').value = agent?.roomImageUrl || '';
  $('#af-room-accent').value = agent?.roomAccent || tpl.accent || '#f4a261';
  $('#af-adapter').value = agent ? agent.adapter : 'github_action';
  $('#af-enabled').value = agent && agent.enabled === false ? 'false' : 'true';
  $('#af-test-result').textContent = '';
  renderDynamicAdapterFields($('#af-adapter').value, agent ? agent.config : {});
  $('#agent-modal').classList.remove('hidden');
}

function bindAgentCrudModal() {
  $('#btn-new-agent').addEventListener('click', () => openAgentModal(null));
  $('#agent-modal-close').addEventListener('click', () => $('#agent-modal').classList.add('hidden'));
  $('#af-cancel-btn').addEventListener('click', () => $('#agent-modal').classList.add('hidden'));
  $('#af-adapter').addEventListener('change', (e) => renderDynamicAdapterFields(e.target.value, {}));

  $('#af-test-btn').addEventListener('click', async () => {
    const out = $('#af-test-result');
    if (store.state.mode !== 'online') {
      out.className = 'feedback-msg err';
      out.textContent = 'Conéctate al puente real para probar el adaptador.';
      return;
    }
    out.className = 'feedback-msg';
    out.textContent = 'Probando conexión...';
    try {
      const res = await store.api.testAgent(collectAgentFromForm());
      out.className = 'feedback-msg ok';
      out.textContent = `✓ OK [${res.result.status}]: ${res.result.headline}`;
    } catch (err) {
      out.className = 'feedback-msg err';
      out.textContent = '✕ ' + err.message;
    }
  });

  $('#agent-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const agent = collectAgentFromForm();
      await store.upsertAgent(agent);
      $('#agent-modal').classList.add('hidden');
      renderer.say(agent.id, '¡Sala lista!');
      toast(`Agente "${agent.name}" guardado`);
    } catch (err) {
      toast('Error guardando agente: ' + err.message, true);
    }
  });
}

function openOfficeModal(office = null) {
  $('#office-modal-title').textContent = office ? 'Editar Oficina' : 'Nueva Oficina';
  $('#of-id').value = office ? office.id : '';
  $('#of-name').value = office ? office.name : '';
  $('#of-icon').value = office ? office.icon || '🏡' : '⚡';
  $('#of-subtitle').value = office ? office.subtitle || '' : '';
  $('#office-modal').classList.remove('hidden');
}

function bindOfficeCrudModal() {
  $('#btn-new-office').addEventListener('click', () => openOfficeModal(null));
  $('#office-modal-close').addEventListener('click', () => $('#office-modal').classList.add('hidden'));
  $('#of-cancel-btn').addEventListener('click', () => $('#office-modal').classList.add('hidden'));

  $('#office-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.upsertOffice({
      id: $('#of-id').value || null,
      name: $('#of-name').value.trim(),
      icon: $('#of-icon').value.trim() || '🏡',
      subtitle: $('#of-subtitle').value.trim()
    });
    $('#office-modal').classList.add('hidden');
    toast('Oficina guardada y sincronizada');
  });
}

function renderRoomsGallery() {
  const el = $('#rooms-gallery');
  if (!el || !assetManager) return;

  el.innerHTML = Object.values(ROOM_TEMPLATES)
    .map((tpl) => {
      const status = assetManager.getTemplateStatus(tpl.id);
      const src = assetManager.getTemplateSrc(tpl.id);
      return `<div class="room-gallery-card">
        <div class="room-thumb">
          ${src ? `<img src="${src}" alt="${esc(tpl.name)}" />` : `<span>Sin imagen aún<br/><code>${tpl.fileBase}.jpg</code></span>`}
        </div>
        <div class="room-gal-name">${tpl.icon} ${esc(tpl.name)}</div>
        <div class="room-gal-file">${status === 'loaded' ? '✓ Cargada' : `assets/rooms/${tpl.fileBase}.jpg`}</div>
        <div class="btn-row">
          <label class="btn btn-sm btn-secondary file-btn" style="flex:1">
            📷 Cargar
            <input type="file" accept="image/*" data-upload-room="${tpl.id}" hidden />
          </label>
          ${assetManager.customOverrides[tpl.id] ? `<button class="btn btn-sm btn-danger-ghost" data-clear-room="${tpl.id}">✕</button>` : ''}
        </div>
      </div>`;
    })
    .join('');

  el.querySelectorAll('[data-upload-room]').forEach((inp) => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImageFileToDataUrl(file);
        assetManager.setCustomRoomImage(inp.dataset.uploadRoom, dataUrl);
        toast(`Imagen cargada en ${ROOM_TEMPLATES[inp.dataset.uploadRoom].name}`);
      } catch (err) {
        toast(err.message, true);
      }
      e.target.value = '';
    });
  });

  el.querySelectorAll('[data-clear-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      assetManager.setCustomRoomImage(btn.dataset.clearRoom, null);
      toast('Restaurada ruta assets/rooms/');
    });
  });
}

function renderDesignPanel() {
  const layoutMode = store.getLayoutMode();
  $('#btn-mode-cozy').classList.toggle('btn-active-mode', layoutMode === 'cozy-rooms');
  $('#btn-mode-open').classList.toggle('btn-active-mode', layoutMode === 'open-floor');

  const activeThemeId = store.getActiveThemeId();
  $('#themes-grid').innerHTML = Object.values(THEMES)
    .map(
      (th) => `<div class="theme-card ${th.id === activeThemeId ? 'selected' : ''}" data-theme-id="${th.id}">
        <div class="theme-swatches">
          <span class="swatch" style="background:${th.canvas.bgTop}"></span>
          <span class="swatch" style="background:${th.canvas.wallTrim}"></span>
          <span class="swatch" style="background:${th.css['--accent']}"></span>
          <span class="swatch" style="background:${th.css['--accent-2']}"></span>
        </div>
        <div class="theme-name">${esc(th.name)}</div>
        <div class="theme-desc">${esc(th.description)}</div>
      </div>`
    )
    .join('');

  $$('.theme-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const scope = document.querySelector('input[name="theme-scope"]:checked').value;
      await store.setTheme(card.dataset.themeId, scope);
      toast(`Tema "${THEMES[card.dataset.themeId].name}" aplicado`);
    });
  });

  renderRoomsGallery();

  if (document.activeElement !== $('#cfg-bridge-url')) $('#cfg-bridge-url').value = store.state.bridgeUrl;
  if (document.activeElement !== $('#cfg-api-secret')) $('#cfg-api-secret').value = store.state.apiSecret;
  $('#cfg-refresh-min').value = String(store.state.config.refreshMinutes ?? 5);
}

function bindDesignView() {
  $('#btn-mode-cozy').addEventListener('click', async () => {
    await store.setLayoutMode('cozy-rooms');
    toast('Modo Salas Cozy activado');
  });

  $('#btn-mode-open').addEventListener('click', async () => {
    await store.setLayoutMode('open-floor');
    toast('Modo Campus Cozy Completo activado');
  });

  $('#btn-save-connection').addEventListener('click', async () => {
    const fb = $('#conn-feedback');
    fb.className = 'feedback-msg';
    fb.textContent = 'Conectando...';
    try {
      await store.connectAndBootstrap($('#cfg-bridge-url').value, $('#cfg-api-secret').value, true);
      await store.setRefreshMinutes($('#cfg-refresh-min').value);
      scheduleAutoRefresh();
      fb.className = 'feedback-msg ok';
      fb.textContent = '✓ Conexión guardada y sincronizada correctamente.';
    } catch (err) {
      fb.className = 'feedback-msg err';
      fb.textContent = '✕ ' + err.message;
    }
  });

  $('#btn-test-ping').addEventListener('click', async () => {
    const fb = $('#conn-feedback');
    fb.className = 'feedback-msg';
    fb.textContent = 'Probando ping...';
    try {
      store.saveLocalCreds($('#cfg-bridge-url').value, $('#cfg-api-secret').value);
      const res = await store.api.ping();
      fb.className = 'feedback-msg ok';
      fb.textContent = `✓ ${res.service} respondió OK (${res.timestamp})`;
    } catch (err) {
      fb.className = 'feedback-msg err';
      fb.textContent = '✕ ' + err.message;
    }
  });

  $('#btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.state.config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'menachaos-oficina-config.json';
    a.click();
    toast('Configuración exportada');
  });

  $('#input-import-json').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      await store.replaceFullConfig(parsed);
      toast('Configuración importada y sincronizada');
    } catch (err) {
      toast('Error importando JSON: ' + err.message, true);
    }
    e.target.value = '';
  });

  $('#btn-reset-defaults').addEventListener('click', async () => {
    if (!confirm('¿Restaurar la configuración inicial Cozy de tus 5 agentes?')) return;
    await store.resetToDefaults();
    toast('Configuración restaurada');
  });
}

let dashResizeTimer = null;
window.addEventListener('resize', () => {
  if ($('#view-dashboard').classList.contains('active')) {
    clearTimeout(dashResizeTimer);
    dashResizeTimer = setTimeout(renderDashboard, 140);
  }
});
window.addEventListener('DOMContentLoaded', init);
