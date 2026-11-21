# MenaChaos OS — Oficina Virtual v2 (Modular por Capas)

Oficina virtual isométrica 2.5D conectada en vivo a tus hojas de Google Sheets, repositorios de GitHub (públicos y privados) y alertas de Gmail, optimizada para quedar abierta en tu **iPad Air M3** o navegador de escritorio.

## Estructura por capas

```text
menachaos-oficina-os-v2/
├── index.html                 # Cascarón principal y vistas
├── styles.css                 # Diseño responsive y variables de tema
├── config/
│   └── default-world.js       # URL precargada del puente y tus 5 agentes base
├── themes/
│   └── themes.js              # 4 diseños intercambiables (Cyber, Planet Express, Taller, Diurno)
├── core/
│   ├── api.js                 # Cliente HTTP hacia tu puente Google Apps Script
│   ├── store.js               # Estado global, CRUD de oficinas/agentes y sync con Config_Oficina
│   └── renderer.js            # Motor isométrico 2.5D en Canvas Retina (60fps)
└── ui/
    └── app.js                 # Controlador de vistas, inspector, gestor y conexión
```

## Cómo publicarlo en GitHub Pages en 3 pasos

1. Crea un repositorio público nuevo en GitHub (por ejemplo `oficina-os`).
2. Sube el contenido de esta carpeta (asegúrate de que `index.html` quede en la raíz del repositorio).
3. Ve a **Settings → Pages → Build and deployment → Branch: `main` / `/ (root)` → Save**.
4. Abre la URL de GitHub Pages en tu iPad (Safari) o PC, escribe tu `API_SECRET` una única vez y toca **Compartir → Añadir a pantalla de inicio** en el iPad para usarla a pantalla completa.
