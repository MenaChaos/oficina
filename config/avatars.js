/**
 * CAPA DE PERSONAJES COZY (config/avatars.js)
 * Define los avatares 3D ilustrados (assets/avatars/<id>.jpg|.png|.webp).
 * El motor core/assets.js recorta automáticamente fondos sólidos (verde/magenta)
 * a transparencia real para que los personajes se integren en cualquier habitación.
 */

export const AVATAR_TEMPLATES = {
  contador: {
    id: 'contador',
    name: 'Elfo Contador',
    roleHint: 'Finanzas y Cuentas',
    icon: '🧝',
    fileBase: 'contador',
    bodyColor: '#2e7d32',
    scaleBoost: 1.0
  },
  combustible: {
    id: 'combustible',
    name: 'Zorrito Viajero',
    roleHint: 'Ruta y Combustible',
    icon: '🦊',
    fileBase: 'combustible',
    bodyColor: '#c2410c',
    scaleBoost: 1.0
  },
  mecanico: {
    id: 'mecanico',
    name: 'Gnomo Mecánico',
    roleHint: 'Garage y Vehículo',
    icon: '🔧',
    fileBase: 'mecanico',
    bodyColor: '#2563eb',
    scaleBoost: 1.0
  },
  perro: {
    id: 'perro',
    name: 'Perrito Gamer',
    roleHint: 'Discord y Clima',
    icon: '🐶',
    fileBase: 'perro',
    bodyColor: '#9a5b25',
    scaleBoost: 0.96
  },
  profesor: {
    id: 'profesor',
    name: 'Mago Científico',
    roleHint: 'Laboratorio y Ofertas',
    icon: '🧙',
    fileBase: 'profesor',
    bodyColor: '#7e22ce',
    scaleBoost: 1.04
  },
  bateria: {
    id: 'bateria',
    name: 'Artesano Energía',
    roleHint: 'Taller Baterías 12V',
    icon: '🔋',
    fileBase: 'bateria',
    bodyColor: '#059669',
    scaleBoost: 1.0
  },
  robot: {
    id: 'robot',
    name: 'Gólem / Bot IA',
    roleHint: 'Automatización IA',
    icon: '🤖',
    fileBase: 'robot',
    bodyColor: '#7c3aed',
    scaleBoost: 1.0
  },
  servidor: {
    id: 'servidor',
    name: 'Guardián Servidor',
    roleHint: 'Scripts y Red',
    icon: '🖥️',
    fileBase: 'servidor',
    bodyColor: '#0891b2',
    scaleBoost: 1.0
  },
  camara: {
    id: 'camara',
    name: 'Centinela',
    roleHint: 'Vigilancia y Alertas',
    icon: '🦉',
    fileBase: 'camara',
    bodyColor: '#64748b',
    scaleBoost: 1.0
  }
};

export function getAvatarTemplate(avatarId) {
  return AVATAR_TEMPLATES[avatarId] || AVATAR_TEMPLATES.robot;
}
