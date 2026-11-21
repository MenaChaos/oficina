/**
 * CAPA DE DISEÑO / TEMAS (themes/themes.js)
 * Para agregar un nuevo diseño de oficina en el futuro, basta con añadir
 * un objeto más aquí sin modificar el renderizador ni la lógica.
 */

export const THEMES = {
  'cyber-studio': {
    id: 'cyber-studio',
    name: 'Cyber Studio',
    description: 'Estudio nocturno neón ideal para el iPad en escritorio',
    css: {
      '--bg': '#0b1020',
      '--bg-elev': '#121a30',
      '--bg-card': '#16213d',
      '--bg-card-hover': '#1e2c52',
      '--border': 'rgba(148, 163, 184, 0.18)',
      '--text': '#eef2ff',
      '--muted': '#94a3b8',
      '--accent': '#38bdf8',
      '--accent-2': '#a855f7'
    },
    canvas: {
      bgTop: '#070b16',
      bgBottom: '#111a33',
      floorA: '#17223b',
      floorB: '#1b2846',
      floorEdge: '#0f172a',
      floorGrid: 'rgba(56, 189, 248, 0.12)',
      wallLeft: '#1e293b',
      wallRight: '#152036',
      wallTrim: '#38bdf8',
      deskTop: '#263554',
      deskSide: '#1a2540',
      deskAccent: '#38bdf8',
      loungeRug: 'rgba(168, 85, 247, 0.22)',
      loungeBorder: 'rgba(168, 85, 247, 0.55)',
      carColor: '#e11d48',
      labelBg: 'rgba(9, 14, 28, 0.85)',
      labelText: '#f8fafc'
    }
  },

  'planet-express': {
    id: 'planet-express',
    name: 'Planet Express',
    description: 'Retro-futurismo Futurama para Simurdiera y el Profesor',
    css: {
      '--bg': '#081c1e',
      '--bg-elev': '#0f2b2e',
      '--bg-card': '#153a3e',
      '--bg-card-hover': '#1d4c52',
      '--border': 'rgba(116, 224, 206, 0.22)',
      '--text': '#ecfeff',
      '--muted': '#88c5c9',
      '--accent': '#5eead4',
      '--accent-2': '#ef4444'
    },
    canvas: {
      bgTop: '#061517',
      bgBottom: '#103135',
      floorA: '#184245',
      floorB: '#1e4e52',
      floorEdge: '#0c2326',
      floorGrid: 'rgba(94, 234, 212, 0.16)',
      wallLeft: '#266163',
      wallRight: '#1b494b',
      wallTrim: '#ef4444',
      deskTop: '#7cc7b8',
      deskSide: '#4a9186',
      deskAccent: '#ef4444',
      loungeRug: 'rgba(239, 68, 68, 0.2)',
      loungeBorder: 'rgba(248, 113, 113, 0.6)',
      carColor: '#2dd4bf',
      labelBg: 'rgba(6, 24, 26, 0.88)',
      labelText: '#ecfeff'
    }
  },

  'taller-industrial': {
    id: 'taller-industrial',
    name: 'Taller & Terreno',
    description: 'Acero oscuro, concreto y acentos ámbar tipo taller/geología',
    css: {
      '--bg': '#141311',
      '--bg-elev': '#1e1c19',
      '--bg-card': '#292520',
      '--bg-card-hover': '#35302a',
      '--border': 'rgba(245, 158, 11, 0.2)',
      '--text': '#fafaf9',
      '--muted': '#a8a29e',
      '--accent': '#f59e0b',
      '--accent-2': '#f97316'
    },
    canvas: {
      bgTop: '#0f0e0d',
      bgBottom: '#1f1c18',
      floorA: '#292524',
      floorB: '#302b29',
      floorEdge: '#1c1917',
      floorGrid: 'rgba(245, 158, 11, 0.12)',
      wallLeft: '#3a3430',
      wallRight: '#2b2623',
      wallTrim: '#f59e0b',
      deskTop: '#574c42',
      deskSide: '#3f362f',
      deskAccent: '#f59e0b',
      loungeRug: 'rgba(245, 158, 11, 0.15)',
      loungeBorder: 'rgba(245, 158, 11, 0.5)',
      carColor: '#dc2626',
      labelBg: 'rgba(20, 18, 16, 0.88)',
      labelText: '#fafaf9'
    }
  },

  'minimal-day': {
    id: 'minimal-day',
    name: 'Estudio Diurno',
    description: 'Oficina luminosa y limpia estilo estudio moderno',
    css: {
      '--bg': '#eef2f6',
      '--bg-elev': '#ffffff',
      '--bg-card': '#f8fafc',
      '--bg-card-hover': '#e2e8f0',
      '--border': 'rgba(15, 23, 42, 0.12)',
      '--text': '#0f172a',
      '--muted': '#64748b',
      '--accent': '#0284c7',
      '--accent-2': '#6366f1'
    },
    canvas: {
      bgTop: '#dbeafe',
      bgBottom: '#f1f5f9',
      floorA: '#e2e8f0',
      floorB: '#edf2f7',
      floorEdge: '#cbd5e1',
      floorGrid: 'rgba(15, 23, 42, 0.08)',
      wallLeft: '#cbd5e1',
      wallRight: '#94a3b8',
      wallTrim: '#0284c7',
      deskTop: '#ffffff',
      deskSide: '#cbd5e1',
      deskAccent: '#0284c7',
      loungeRug: 'rgba(2, 132, 199, 0.12)',
      loungeBorder: 'rgba(2, 132, 199, 0.45)',
      carColor: '#e11d48',
      labelBg: 'rgba(15, 23, 42, 0.84)',
      labelText: '#ffffff'
    }
  }
};

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES['cyber-studio'];
}

export function applyThemeCss(themeId) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  Object.entries(theme.css).forEach(([k, v]) => root.style.setProperty(k, v));
  return theme;
}
