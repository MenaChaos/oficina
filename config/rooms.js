/**
 * CAPA DE HABITACIONES COZY (config/rooms.js)
 * Define las plantillas de salas diorama independientes por agente.
 * Para añadir una sala nueva en el futuro, basta con agregar una entrada aquí
 * y poner su imagen en assets/rooms/<id>.jpg (o .png / .webp).
 */

export const ROOM_TEMPLATES = {
  'garage-cozy': {
    id: 'garage-cozy',
    name: 'Garage Cozy',
    subtitle: 'Taller mecánico cálido con ladrillo y banco de trabajo',
    icon: '🚗',
    fileBase: 'garage-cozy',
    accent: '#f59e0b',
    floorColor: '#4a433d',
    wallColor: '#7c4a36',
    lampGlow: 'rgba(251, 191, 36, 0.28)',
    defaultAnchor: { x: 0.28, y: 0.66 }
  },
  'estudio-madera': {
    id: 'estudio-madera',
    name: 'Estudio Madera',
    subtitle: 'Oficina cálida de parquet, librero y plantas',
    icon: '💼',
    fileBase: 'estudio-madera',
    accent: '#eab308',
    floorColor: '#8a6544',
    wallColor: '#b08968',
    lampGlow: 'rgba(253, 224, 71, 0.26)',
    defaultAnchor: { x: 0.56, y: 0.64 }
  },
  'oficina-ruta': {
    id: 'oficina-ruta',
    name: 'Oficina de Ruta / Café',
    subtitle: 'Barra cafetera, mapas y rincón de boletas',
    icon: '⛽',
    fileBase: 'oficina-ruta',
    accent: '#ef4444',
    floorColor: '#7d5a42',
    wallColor: '#9c785c',
    lampGlow: 'rgba(251, 146, 60, 0.28)',
    defaultAnchor: { x: 0.48, y: 0.68 }
  },
  'living-gamer': {
    id: 'living-gamer',
    name: 'Living Gamer',
    subtitle: 'Setup cálido, sillón, ventana al atardecer y cama de perro',
    icon: '🐶',
    fileBase: 'living-gamer',
    accent: '#38bdf8',
    floorColor: '#6f5544',
    wallColor: '#8d7465',
    lampGlow: 'rgba(251, 191, 36, 0.24)',
    defaultAnchor: { x: 0.58, y: 0.69 }
  },
  'lab-retro': {
    id: 'lab-retro',
    name: 'Laboratorio Retro Cozy',
    subtitle: 'Estantes de madera, matraces luminosos y terminal CRT',
    icon: '🧪',
    fileBase: 'lab-retro',
    accent: '#2dd4bf',
    floorColor: '#4c3e35',
    wallColor: '#6b5344',
    lampGlow: 'rgba(45, 212, 191, 0.26)',
    defaultAnchor: { x: 0.50, y: 0.67 }
  },
  'taller-electronica': {
    id: 'taller-electronica',
    name: 'Taller Electrónica',
    subtitle: 'Banco de soldadura, baterías 12V y multímetro',
    icon: '🔋',
    fileBase: 'taller-electronica',
    accent: '#10b981',
    floorColor: '#47433e',
    wallColor: '#635c54',
    lampGlow: 'rgba(52, 211, 153, 0.24)',
    defaultAnchor: { x: 0.50, y: 0.66 }
  },
  'estudio-minimal': {
    id: 'estudio-minimal',
    name: 'Estudio Minimal',
    subtitle: 'Sala luminosa y limpia para nuevos proyectos',
    icon: '✨',
    fileBase: 'estudio-minimal',
    accent: '#60a5fa',
    floorColor: '#948678',
    wallColor: '#b5a89a',
    lampGlow: 'rgba(255, 237, 213, 0.24)',
    defaultAnchor: { x: 0.50, y: 0.66 }
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
