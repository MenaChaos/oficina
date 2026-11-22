/**
 * CAPA DE HABITACIONES Y PLANO DEL EDIFICIO COZY (config/rooms.js)
 * Define tanto las plantillas de salas diorama individuales como las coordenadas
 * de cada cubículo/estancia dentro del Edificio Cozy Completo (edificio-cozy.jpg).
 */

export const BUILDING_FLOORPLAN = {
  id: 'edificio-cozy',
  name: 'Edificio Completo (Oficina Abierta)',
  fileBase: 'edificio-cozy',
  aspectRatio: 16 / 9,
  // Coordenadas normalizadas (0..1) de cada estancia dentro de edificio-cozy.jpg
  roomSpots: {
    'estudio-madera':     { x: 0.305, y: 0.435, zone: 'Estudio Madera' },
    'oficina-ruta':       { x: 0.465, y: 0.305, zone: 'Café y Ruta' },
    'garage-cozy':        { x: 0.625, y: 0.475, zone: 'Garage Cozy' },
    'living-gamer':       { x: 0.335, y: 0.645, zone: 'Living Gamer' },
    'lab-retro':          { x: 0.565, y: 0.665, zone: 'Lab Retro' },
    'taller-electronica': { x: 0.478, y: 0.495, zone: 'Atrio Central' },
    'estudio-minimal':    { x: 0.395, y: 0.530, zone: 'Pasillo Oeste' }
  },
  // Puestos adicionales para futuros agentes (6, 7, 8, 9...) sin solaparse
  extraSpots: [
    { x: 0.478, y: 0.495, zone: 'Atrio Central' },
    { x: 0.395, y: 0.530, zone: 'Pasillo Oeste' },
    { x: 0.455, y: 0.745, zone: 'Hall Sur' },
    { x: 0.695, y: 0.365, zone: 'Banco Taller' },
    { x: 0.255, y: 0.545, zone: 'Rincón Lectura' }
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
    defaultAnchor: { x: 0.30, y: 0.67 }
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
    defaultAnchor: { x: 0.50, y: 0.63 }
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
    defaultAnchor: { x: 0.50, y: 0.62 }
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
    defaultAnchor: { x: 0.62, y: 0.66 }
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
    defaultAnchor: { x: 0.43, y: 0.64 }
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
    defaultAnchor: { x: 0.50, y: 0.65 }
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
    defaultAnchor: { x: 0.50, y: 0.65 }
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
