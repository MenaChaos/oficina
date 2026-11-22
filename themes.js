/**
 * CAPA DE DISEÑO / TEMAS (themes/themes.js)
 * Incluye los nuevos estilos Cozy (calibrados para fundirse con los dioramas ilustrados)
 * más los estilos anteriores.
 */

export const THEMES = {
  'cozy-warm': {
    id: 'cozy-warm',
    name: 'Cozy Nocturno',
    description: 'Carbón cálido y luz ámbar calibrado para fundirse con los dioramas',
    css: {
      '--bg': '#1f2124',
      '--bg-elev': '#27292e',
      '--bg-card': '#303238',
      '--bg-card-hover': '#3a3d45',
      '--border': 'rgba(245, 200, 140, 0.16)',
      '--text': '#fbf6ee',
      '--muted': '#b5aca0',
      '--accent': '#f4a261',
      '--accent-2': '#e76f51'
    },
    canvas: {
      bgTop: '#212327',
      bgBottom: '#1c1d20',
      roomCardBg: '#23252a',
      roomCardBorder: 'rgba(244, 162, 97, 0.22)',
      floorA: '#3b332d',
      floorB: '#443b34',
      floorEdge: '#241f1c',
      floorGrid: 'rgba(244, 162, 97, 0.1)',
      wallLeft: '#5c4b3f',
      wallRight: '#473a31',
      wallTrim: '#f4a261',
      deskTop: '#a47551',
      deskSide: '#785236',
      deskAccent: '#f4a261',
      loungeRug: 'rgba(231, 111, 81, 0.22)',
      loungeBorder: 'rgba(244, 162, 97, 0.5)',
      carColor: '#c92a2a',
      labelBg: 'rgba(26, 24, 24, 0.88)',
      labelText: '#fbf6ee',
      particleColor: 'rgba(255, 224, 178, 0.45)'
    }
  },

  'cozy-cafe': {
    id: 'cozy-cafe',
    name: 'Estudio Café',
    description: 'Madera nogal, crema y acentos terracota súper acogedores',
    css: {
      '--bg': '#221c18',
      '--bg-elev': '#2c241f',
      '--bg-card': '#382e27',
      '--bg-card-hover': '#463930',
      '--border': 'rgba(232, 188, 142, 0.2)',
      '--text': '#fdf8f2',
      '--muted': '#c4b2a1',
      '--accent': '#e9a96b',
      '--accent-2': '#84a98c'
    },
    canvas: {
      bgTop: '#261f1a',
      bgBottom: '#1c1714',
      roomCardBg: '#29221d',
      roomCardBorder: 'rgba(233, 169, 107, 0.26)',
      floorA: '#4a3b31',
      floorB: '#544338',
      floorEdge: '#2b221c',
      floorGrid: 'rgba(233, 169, 107, 0.12)',
      wallLeft: '#6e5746',
      wallRight: '#574437',
      wallTrim: '#e9a96b',
      deskTop: '#b08968',
      deskSide: '#7f5539',
      deskAccent: '#e9a96b',
      loungeRug: 'rgba(132, 169, 140, 0.22)',
      loungeBorder: 'rgba(132, 169, 140, 0.55)',
      carColor: '#b91c1c',
      labelBg: 'rgba(30, 23, 19, 0.9)',
      labelText: '#fdf8f2',
      particleColor: 'rgba(253, 230, 138, 0.4)'
    }
  },

  'cyber-studio': {
    id: 'cyber-studio',
    name: 'Cyber Studio',
    description: 'Estudio nocturno neón clásico',
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
      roomCardBg: '#11192e',
      roomCardBorder: 'rgba(56, 189, 248, 0.24)',
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
      labelText: '#f8fafc',
      particleColor: 'rgba(56, 189, 248, 0.35)'
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
      roomCardBg: '#0d2629',
      roomCardBorder: 'rgba(94, 234, 212, 0.26)',
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
      labelText: '#ecfeff',
      particleColor: 'rgba(94, 234, 212, 0.35)'
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
      roomCardBg: '#1c1a17',
      roomCardBorder: 'rgba(245, 158, 11, 0.25)',
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
      labelText: '#fafaf9',
      particleColor: 'rgba(245, 158, 11, 0.35)'
    }
  },

  'minimal-day': {
    id: 'minimal-day',
    name: 'Estudio Diurno',
    description: 'Oficina luminosa y limpia estilo estudio moderno',
    css: {
      '--bg': '#ece7df',
      '--bg-elev': '#faf7f2',
      '--bg-card': '#f2ece3',
      '--bg-card-hover': '#e6ddd0',
      '--border': 'rgba(68, 54, 42, 0.14)',
      '--text': '#2b231d',
      '--muted': '#786b5e',
      '--accent': '#d97706',
      '--accent-2': '#0284c7'
    },
    canvas: {
      bgTop: '#e7dfd4',
      bgBottom: '#dfd5c7',
      roomCardBg: '#23252a',
      roomCardBorder: 'rgba(217, 119, 6, 0.3)',
      floorA: '#d9cbb8',
      floorB: '#e3d7c6',
      floorEdge: '#b8a58e',
      floorGrid: 'rgba(68, 54, 42, 0.08)',
      wallLeft: '#c7b8a5',
      wallRight: '#b0a08d',
      wallTrim: '#d97706',
      deskTop: '#ffffff',
      deskSide: '#d6cbbd',
      deskAccent: '#d97706',
      loungeRug: 'rgba(217, 119, 6, 0.14)',
      loungeBorder: 'rgba(217, 119, 6, 0.45)',
      carColor: '#e11d48',
      labelBg: 'rgba(34, 28, 24, 0.88)',
      labelText: '#ffffff',
      particleColor: 'rgba(217, 119, 6, 0.28)'
    }
  }
};

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES['cozy-warm'];
}

export function applyThemeCss(themeId) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  Object.entries(theme.css).forEach(([k, v]) => root.style.setProperty(k, v));
  return theme;
}
