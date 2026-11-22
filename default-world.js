/**
 * CAPA DE CONFIGURACIÓN INICIAL (config/default-world.js)
 * - Compatible 100% con el backend Code.gs ya desplegado.
 * - La URL del puente queda precargada; la API_SECRET se guarda solo en el dispositivo.
 */

export const DEFAULT_BRIDGE_URL =
  'https://script.google.com/macros/s/AKfycbxGwL07VBxMui-RSbn8DbsGqdpEvivxRtdDayyuAiigqqJwKzBetQamVKodhEyzXwcFHQ/exec';

export const DEFAULT_CONFIG = {
  version: 3,
  activeOfficeId: 'hq-principal',
  activeTheme: 'cozy-warm',
  layoutMode: 'cozy-rooms', // 'cozy-rooms' | 'open-floor'
  refreshMinutes: 5,
  offices: [
    {
      id: 'hq-principal',
      name: 'Sede Central',
      subtitle: 'Salas Cozy · Hogar, MG 6 y Bots',
      icon: '🏡',
      themeOverride: null,
      agents: [
        {
          id: 'cuentas-hogar',
          name: 'Cuentas Hogar',
          role: 'Finanzas y Servicios Básicos',
          avatar: 'contador',
          roomStyle: 'estudio-madera',
          deskSlot: 0,
          enabled: true,
          adapter: 'servicios_hogar',
          config: {
            sheetId: 'SHEET_ID_SERVICIOS',
            services: [
              { key: 'luz', label: 'Luz (CGE)', tabName: 'Luz (CGE)' },
              { key: 'agua', label: 'Agua (Aguas del Valle)', tabName: 'Agua (Aguas del Valle)' },
              { key: 'internet', label: 'Internet (Mundo)', tabName: 'Internet (Mundo)' },
              { key: 'telefono', label: 'Teléfono (Entel)', tabName: 'Telefonos (Entel)' }
            ]
          },
          actions: ['mark_bill_status']
        },
        {
          id: 'control-copec',
          name: 'Control COPEC',
          role: 'Boletas y Reembolsos',
          avatar: 'combustible',
          roomStyle: 'oficina-ruta',
          deskSlot: 1,
          enabled: true,
          adapter: 'combustible_copec',
          config: {
            sheetId: 'SHEET_ID_COMBUSTIBLE',
            tabName: 'Hoja 1'
          },
          actions: ['mark_fuel_reimbursed']
        },
        {
          id: 'monitor-mg6',
          name: 'Monitor MG 6',
          role: 'Mecánico OBD-II + IA',
          avatar: 'mecanico',
          roomStyle: 'garage-cozy',
          deskSlot: 2,
          enabled: true,
          adapter: 'mg6_mecanico',
          config: {
            sheetId: 'SHEET_ID_MG6',
            widgetTab: 'Resumen_Widget',
            owner: 'MenaChaos',
            repo: 'obd-mg6',
            workflowId: 'daily_audit.yml',
            branch: 'main'
          },
          actions: ['trigger_workflow']
        },
        {
          id: 'simurdiera',
          name: 'Simurdiera',
          role: 'Clima y Convocatoria Discord',
          avatar: 'perro',
          roomStyle: 'living-gamer',
          deskSlot: 3,
          enabled: true,
          adapter: 'github_action',
          config: {
            owner: 'MenaChaos',
            repo: 'simurdiera-IA',
            workflowId: '',
            branch: 'main'
          },
          actions: ['trigger_workflow']
        },
        {
          id: 'prof-farnsworth',
          name: 'Prof. Farnsworth',
          role: 'Radar de Ofertas Steam',
          avatar: 'profesor',
          roomStyle: 'lab-retro',
          deskSlot: 4,
          enabled: true,
          adapter: 'github_action',
          config: {
            owner: 'MenaChaos',
            repo: 'ofertas-profesor',
            workflowId: 'ofertas.yml',
            branch: 'main',
            readFile: 'historial.txt',
            maxLines: 8
          },
          actions: ['trigger_workflow']
        }
      ]
    }
  ]
};

export const DEMO_DATA = {
  'cuentas-hogar': {
    agentId: 'cuentas-hogar',
    status: 'ROJO',
    activity: 'alert',
    headline: '1 cuenta(s) vencida(s) · 3 pendiente(s)',
    metrics: { pendingCount: 3, overdueCount: 1, totalPendingCLP: 53154, totalPendingDisplay: '$53.154' },
    items: [
      { key: 'luz', label: 'Luz (CGE)', tabName: 'Luz (CGE)', dueDateText: '20-nov', daysLeft: -1, amount: 6800, amountDisplay: '$6.800', status: 'Pendiente', isPaid: false, isOverdue: true },
      { key: 'agua', label: 'Agua (Aguas del Valle)', tabName: 'Agua (Aguas del Valle)', dueDateText: '24-nov', daysLeft: 3, amount: 30840, amountDisplay: '$30.840', status: 'Pendiente', isPaid: false, isOverdue: false, isDueSoon: true },
      { key: 'internet', label: 'Internet (Mundo)', tabName: 'Internet (Mundo)', dueDateText: '25-nov', daysLeft: 4, amount: 15514, amountDisplay: '$15.514', status: 'Pendiente', isPaid: false, isOverdue: false, isDueSoon: true },
      { key: 'telefono', label: 'Teléfono (Entel)', tabName: 'Telefonos (Entel)', dueDateText: '6-nov', daysLeft: -15, amount: 38970, amountDisplay: '$38.970', status: 'Pagado', isPaid: true, isOverdue: false }
    ]
  },
  'control-copec': {
    agentId: 'control-copec',
    status: 'AMARILLO',
    activity: 'alert',
    headline: '15 boleta(s) pendiente(s) de reembolso',
    lastReceipt: { rowNumber: 203, fecha: '12/11/2026', combustible: 'Diesel', modoPago: 'APP COPEC', monto: 120200, montoDisplay: '$120.200', reembolsado: 'SIN_MARCAR' },
    metrics: { monthBencinaDisplay: '$25.000', monthDieselDisplay: '$120.200', pendingReimbursementsCount: 15, anomaliesCount: 2 },
    pendingReimbursements: [
      { rowNumber: 203, fecha: '12/11/2026', combustible: 'Diesel', modoPago: 'APP COPEC', montoDisplay: '$120.200', reembolsado: 'SIN_MARCAR' },
      { rowNumber: 200, fecha: '30/10/2026', combustible: 'Diesel', modoPago: 'APP COPEC', montoDisplay: '$117.464', reembolsado: 'SIN_MARCAR' },
      { rowNumber: 199, fecha: '28/10/2026', combustible: 'Diesel', modoPago: 'APP COPEC', montoDisplay: '$120.025', reembolsado: 'SIN_MARCAR' }
    ],
    formatAnomalies: [
      { rowNumber: 38, fecha: '24/02/2026', raw: '76000.000', interpreted: '$76.000' },
      { rowNumber: 179, fecha: '10/09/2026', raw: '28078.000', interpreted: '$28.078' }
    ]
  },
  'monitor-mg6': {
    agentId: 'monitor-mg6',
    status: 'VERDE',
    activity: 'idle',
    headline: 'Prueba corta en ralentí en Jorge Prat (0,38 min)',
    telemetry: {
      estadoGeneral: 'VERDE',
      ultimaActualizacion: '2026-11-21 17:30:12',
      resumenEstado: 'Viaje tipo prueba estacionado en Jorge Prat, Andacollo, con motor frío (37°C). Presión de riel GDI 4410 kPa, mezcla -5.34% y voltaje 14.54 V estable.',
      tendenciaHistorica: 'Promedio real 3 meses: 6.64 km/L global y 8.47 km/L en movimiento. Trim consistente con histórico (-4.31%).',
      accionRecomendada: 'En VERDE: evita dejar el motor en ralentí solo para pruebas cortas.',
      detalleUltimoViaje: 'Ruta: Jorge Prat, Andacollo -> Jorge Prat, Andacollo (prueba estacionado) | 0.38 min | 0.0 km | 0.005 L ($8 CLP a $1680/L)\n\n• 0:00 - 0:23 (Prueba estacionado en ralentí con motor frío — 0.0 km):\nUbicación Jorge Prat, Andacollo a ~1056 m s.n.m., motor parte frío a 37.0°C, RPM promedio 862 rpm, riel GDI 4410 kPa y voltaje estable 14.54 V.',
      ultimoViaje: { resumen: 'Prueba corta en ralentí (0,38 min)', fecha: '2026-11-21 14:23:16', duracionMin: '0.38', distanciaKm: '0', rendimientoKmL: '0', boostMaxPSI: '-8.99', velMaxKmh: '0', tempMaxC: '37', voltajeMinV: '14.54' },
      dia: { fecha: '2026-11-21', encendidos: '2', distanciaKm: '0.03', duracionMin: '2.6', combustibleL: '0.044', rendimientoKmL: '0.68' }
    },
    github: { owner: 'MenaChaos', repo: 'obd-mg6', runNumber: 29, name: 'Auditoria Diaria MG 6 OpenAI', status: 'completed', conclusion: 'success', updatedAt: '2026-11-21T21:41:46Z' }
  },
  'simurdiera': {
    agentId: 'simurdiera',
    status: 'VERDE',
    activity: 'idle',
    headline: 'Simurdiera Bot Diario · OK (21/11 17:51)',
    github: { owner: 'MenaChaos', repo: 'simurdiera-IA', runNumber: 284, name: 'Simurdiera Bot Diario', status: 'completed', conclusion: 'success', updatedAt: '2026-11-21T20:51:17Z' }
  },
  'prof-farnsworth': {
    agentId: 'prof-farnsworth',
    status: 'VERDE',
    activity: 'idle',
    headline: 'Ofertas del Profesor · OK (20/11 23:42)',
    github: { owner: 'MenaChaos', repo: 'ofertas-profesor', runNumber: 272, name: 'Ofertas del Profesor', status: 'completed', conclusion: 'success', updatedAt: '2026-11-21T02:42:54Z' },
    filePreview: {
      fileName: 'historial.txt',
      totalLines: 103,
      recentLines: ['1283410,2026-11-21', '2366980,2026-11-21', '1057090,2026-11-21', '1205520,2026-11-21']
    }
  }
};

export const DEMO_ALERTS = [
  { source: 'Apps Script', subject: 'Summary of failures for Google Apps Script: Proyecto sin título', date: '20/11 06:57' },
  { source: 'Apps Script', subject: 'Summary of failures for Google Apps Script: Capturas GTA V - Discord', date: '19/11 02:50' }
];
