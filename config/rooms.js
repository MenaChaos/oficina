/**
 * CAPA DE HABITACIONES Y PLANO DEL EDIFICIO COZY (config/rooms.js)
 * Coordenadas calibradas exactamente a cada estancia de assets/rooms/edificio-cozy.jpg.
 */

export const BUILDING_FLOORPLAN = {
  id: 'edificio-cozy',
  name: 'Edificio Completo (Oficina Abierta)',
  fileBase: 'edificio-cozy',
  aspectRatio: 16 / 9,
  // Coordenadas normalizadas (0..1) donde apoyan los pies de cada personaje en edificio-cozy.jpg
  roomSpots: {
    'estudio-madera': {
      x: 0.245, y: 0.455, zone: 'Estudio Madera',
      patrol: [
        { x: 0.245, y: 0.455, icon: '📊' },
        { x: 0.282, y: 0.412, icon: '📚' },
        { x: 0.220, y: 0.482, icon: '✍️' }
      ]
    },
    'oficina-ruta': {
      x: 0.520, y: 0.310, zone: 'Café y Ruta',
      patrol: [
        { x: 0.520, y: 0.310, icon: '☕' },
        { x: 0.488, y: 0.315, icon: '🗺️' },
        { x: 0.556, y: 0.338, icon: '🧾' }
      ]
    },
    'garage-cozy': {
      x: 0.695, y: 0.460, zone: 'Garage Cozy',
      patrol: [
        { x: 0.695, y: 0.460, icon: '🔧' },
        { x: 0.742, y: 0.418, icon: '🛠️' },
        { x: 0.735, y: 0.528, icon: '💻' }
      ]
    },
    'living-gamer': {
      x: 0.355, y: 0.655, zone: 'Living Gamer',
      patrol: [
        { x: 0.355, y: 0.655, icon: '🎧' },
        { x: 0.392, y: 0.688, icon: '💬' },
        { x: 0.326, y: 0.694, icon: '🐾' }
      ]
    },
    'lab-retro': {
      x: 0.615, y: 0.660, zone: 'Lab Retro',
      patrol: [
        { x: 0.615, y: 0.660, icon: '🧪' },
        { x: 0.642, y: 0.618, icon: '✨' },
        { x: 0.648, y: 0.700, icon: '🎮' }
      ]
    },
    'taller-electronica': {
      x: 0.478, y: 0.495, zone: 'Atrio Central',
      patrol: [
        { x: 0.478, y: 0.495, icon: '⚡' },
        { x: 0.455, y: 0.515, icon: '🔋' }
      ]
    },
    'estudio-minimal': {
      x: 0.410, y: 0.535, zone: 'Pasillo Oeste',
      patrol: [
        { x: 0.410, y: 0.535, icon: '✨' },
        { x: 0.440, y: 0.515, icon: '📋' }
      ]
    }
  },
  // Puestos adicionales para futuros agentes (6, 7, 8, 9...)
  extraSpots: [
    { x: 0.478, y: 0.495, zone: 'Atrio Central' },
    { x: 0.410, y: 0.535, zone: 'Pasillo Oeste' },
    { x: 0.475, y: 0.745, zone: 'Hall Sur' },
    { x: 0.805, y: 0.390, zone: 'Banco Taller' },
    { x: 0.205, y: 0.535, zone: 'Rincón Lectura' }
  ]
};

export const ROOM_TEMPLATES = {
  'garage-cozy': {
    id: 'garage-cozy',
    name: 'Garage Cozy',
    shortName: 'Garage Cozy',
    subtitle: 'Taller mecánico cálido con ladrillo y banco de trabajo',
    icon: '🚗',
    fileBase: 'garage-cozy',
    accent: '#f59e0b',
    floorColor: '#4a433d',
    wallColor: '#7c4a36',
    lampGlow: 'rgba(251, 191, 36, 0.28)',
    defaultAnchor: { x: 0.31, y: 0.71 }
  },
  'estudio-madera': {
    id: 'estudio-madera',
    name: 'Estudio Madera',
    shortName: 'Estudio Madera',
    subtitle: 'Oficina cálida de parquet, librero y plantas',
    icon: '💼',
    fileBase: 'estudio-madera',
    accent: '#eab308',
    floorColor: '#8a6544',
    wallColor: '#b08968',
    lampGlow: 'rgba(253, 224, 71, 0.26)',
    defaultAnchor: { x: 0.50, y: 0.67 }
  },
  'oficina-ruta': {
    id: 'oficina-ruta',
    name: 'Oficina de Ruta / Café',
    shortName: 'Oficina Ruta',
    subtitle: 'Barra cafetera, mapas y rincón de boletas',
    icon: '⛽',
    fileBase: 'oficina-ruta',
    accent: '#ef4444',
    floorColor: '#7d5a42',
    wallColor: '#9c785c',
    lampGlow: 'rgba(251, 146, 60, 0.28)',
    defaultAnchor: { x: 0.50, y: 0.66 }
  },
  'living-gamer': {
    id: 'living-gamer',
    name: 'Living Gamer',
    shortName: 'Living Gamer',
    subtitle: 'Setup cálido, sillón, ventana al atardecer y cama de perro',
    icon: '🐶',
    fileBase: 'living-gamer',
    accent: '#38bdf8',
    floorColor: '#6f5544',
    wallColor: '#8d7465',
    lampGlow: 'rgba(251, 191, 36, 0.24)',
    defaultAnchor: { x: 0.62, y: 0.70 }
  },
  'lab-retro': {
    id: 'lab-retro',
    name: 'Laboratorio Retro Cozy',
    shortName: 'Lab Retro',
    subtitle: 'Estantes de madera, matraces luminosos y terminal CRT',
    icon: '🧪',
    fileBase: 'lab-retro',
    accent: '#2dd4bf',
    floorColor: '#4c3e35',
    wallColor: '#6b5344',
    lampGlow: 'rgba(45, 212, 191, 0.26)',
    defaultAnchor: { x: 0.44, y: 0.68 }
  },
  'taller-electronica': {
    id: 'taller-electronica',
    name: 'Taller Electrónica',
    shortName: 'Electrónica',
    subtitle: 'Banco de soldadura, baterías 12V y multímetro',
    icon: '🔋',
    fileBase: 'taller-electronica',
    accent: '#10b981',
    floorColor: '#47433e',
    wallColor: '#635c54',
    lampGlow: 'rgba(52, 211, 153, 0.24)',
    defaultAnchor: { x: 0.50, y: 0.68 }
  },
  'estudio-minimal': {
    id: 'estudio-minimal',
    name: 'Estudio Minimal',
    shortName: 'Minimal',
    subtitle: 'Sala luminosa y limpia para nuevos proyectos',
    icon: '✨',
    fileBase: 'estudio-minimal',
    accent: '#60a5fa',
    floorColor: '#948678',
    wallColor: '#b5a89a',
    lampGlow: 'rgba(255, 237, 213, 0.24)',
    defaultAnchor: { x: 0.50, y: 0.68 }
  }
};

export function inferDefaultRoomStyle(agent) {
  if (agent && agent.roomStyle && ROOM_TEMPLATES[agent.roomStyle]) {
    return agent.roomStyle;
  }
  const map = {
    mecanico: 'garage-cozy',
    contador: 'estudio-madera',
    combustible: 'oficina-ruta',
    perro: 'living-gamer',
    profesor: 'lab-retro',
    bateria: 'taller-electronica'
  };
  return map[agent?.avatar] || 'estudio-minimal';
}

export function getRoomTemplate(roomStyle, agent = null) {
  const id = roomStyle && ROOM_TEMPLATES[roomStyle] ? roomStyle : inferDefaultRoomStyle(agent);
  return ROOM_TEMPLATES[id] || ROOM_TEMPLATES['estudio-minimal'];
}
