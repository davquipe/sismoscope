# SismoScope

Observatorio sísmico web, estático e interactivo centrado en Perú y con cobertura mundial. SismoScope consulta datos públicos de [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/), los valida en tiempo de ejecución y los presenta en mapas, tablas y análisis reproducibles.

> **Aviso importante:** SismoScope es una herramienta informativa. No es un sistema oficial de alertas, no predice terremotos y no reemplaza a las autoridades, los servicios de emergencia ni las fuentes gubernamentales. Las agrupaciones y estadísticas de la aplicación no demuestran causalidad.

## Demo

La instancia pública de este repositorio se desplegará en:

**[https://davquipe.github.io/sismoscope/](https://davquipe.github.io/sismoscope/)**

La URL quedará disponible cuando GitHub Pages esté habilitado con **GitHub Actions** como fuente y el workflow de despliegue termine correctamente.

## Alcance de la primera entrega

- Dashboard para Perú y mundo con feeds recientes reales, indicadores y última actualización.
- Explorer con filtros compartibles en la URL, conteo previo, paginación, mapa con clustering y tabla accesible.
- Detalle validado de un evento, datos técnicos y eventos cercanos en tiempo y espacio calculados con Haversine.
- Analítica descriptiva en cliente, visualizaciones cargadas bajo demanda y trabajo pesado fuera del hilo principal.
- Comparador básico entre Perú y el mundo o entre dos semanas consecutivas, con tamaños de muestra y advertencias de interpretación.
- Exportación de la página cargada en CSV y GeoJSON con metadatos de procedencia.
- Búsquedas guardadas, favoritos y preferencias persistentes con almacenamiento versionado.
- Tema claro, oscuro o del sistema, y presentación temporal en UTC o zona local.
- Errores recuperables, cancelación de solicitudes y bloqueo de consultas que superen el límite de 20 000 eventos de USGS.
- Pruebas enfocadas en fronteras de datos, lógica de dominio y flujos críticos.
- Integración y despliegue continuo mediante un workflow de GitHub Actions.

Las comparaciones personalizadas o persistidas, la traducción inglesa completa y un catálogo Storybook exhaustivo permanecen fuera del alcance actual. Véase [Roadmap](#roadmap).

## Stack

- React, TypeScript estricto, Vite y pnpm.
- React Router con `HashRouter` para navegación compatible con GitHub Pages.
- TanStack Query para estado remoto y Zustand para preferencias locales de interfaz.
- React Hook Form y Zod para formularios y validación en fronteras.
- Leaflet y React Leaflet sobre tiles estándar de OpenStreetMap.
- Apache ECharts para gráficos cargados dinámicamente.
- IndexedDB detrás de una capa tipada y versionada.
- Vitest, React Testing Library, MSW y Playwright.
- ESLint, Prettier y GitHub Actions.

## Inicio local

Requisitos:

- Node.js LTS indicado por `.nvmrc`.
- pnpm compatible con el campo `packageManager` de `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Vite sirve el proyecto en la URL indicada en la terminal. En desarrollo el base es `/`; la navegación interna conserva rutas como `/#/explorer`.

Para comprobar localmente una build de producción bajo una subruta:

```bash
VITE_BASE_PATH=/proyecto/ pnpm build
pnpm preview
```

No se requieren secretos ni claves de API. Copie `.env.example` sólo si necesita sobrescribir opciones públicas de build.

## Scripts

| Comando                 | Propósito                                             |
| ----------------------- | ----------------------------------------------------- |
| `pnpm dev`              | Inicia Vite en desarrollo.                            |
| `pnpm build`            | Ejecuta la compilación TypeScript y genera `dist/`.   |
| `pnpm preview`          | Sirve localmente la build generada.                   |
| `pnpm typecheck`        | Valida TypeScript sin formato interactivo.            |
| `pnpm lint`             | Ejecuta ESLint.                                       |
| `pnpm lint:fix`         | Aplica correcciones seguras de ESLint.                |
| `pnpm format`           | Formatea archivos con Prettier.                       |
| `pnpm format:check`     | Comprueba formato sin modificar archivos.             |
| `pnpm test`             | Ejecuta Vitest en modo de desarrollo.                 |
| `pnpm test:unit`        | Ejecuta pruebas unitarias.                            |
| `pnpm test:integration` | Ejecuta pruebas de integración con DOM y MSW.         |
| `pnpm test:coverage`    | Genera cobertura como señal diagnóstica.              |
| `pnpm test:e2e`         | Ejecuta flujos Playwright contra una instancia local. |
| `pnpm test:e2e:ui`      | Abre la interfaz de Playwright.                       |
| `pnpm storybook`        | Abre el catálogo visual accesible de primitivas.      |
| `pnpm build-storybook`  | Genera la build estática del catálogo visual.         |

Los scripts disponibles en cada revisión son la fuente de verdad; consulte `package.json` si una rama incorpora comandos adicionales.

## Arquitectura resumida

La aplicación sigue módulos orientados al dominio:

```text
app/pages → widgets → features → entities ← shared/infrastructure
                                      ↑
                                   workers
```

- Los contratos y modelos internos no dependen de React.
- Las respuestas de USGS se tratan como `unknown`, se validan con Zod y después se normalizan.
- Las páginas componen casos de uso; ningún componente visual construye URLs de USGS.
- TanStack Query conserva datos remotos, la URL conserva filtros compartibles, Zustand conserva preferencias efímeras/globales e IndexedDB conserva datos explícitos del usuario.
- Los cálculos de analítica operan sobre estructuras serializables y pueden ejecutarse en un Web Worker.

La descripción completa, reglas de dependencia y diagrama están en [ARCHITECTURE.md](ARCHITECTURE.md). Las decisiones relevantes están registradas en [`docs/adr`](docs/adr/).

## Fuente de datos

SismoScope usa únicamente endpoints públicos sin autenticación:

- Feeds GeoJSON oficiales para actividad reciente.
- FDSN Event `count` para estimar búsquedas personalizadas.
- FDSN Event `query` para resultados paginados.
- La URL `detail` de cada evento, únicamente después de comprobar HTTPS y una allowlist de hosts USGS.

No se usa información simulada en producción. Los fixtures se restringen a pruebas y estados visuales controlados. Consulte [docs/api.md](docs/api.md) y [docs/data-model.md](docs/data-model.md).

## Testing y calidad

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
```

CI instala dependencias con lockfile congelado, almacena la caché de pnpm y adjunta el reporte de Playwright cuando E2E falla. Los E2E interceptan USGS para que CI no dependa de la red externa. Una comprobación contra la API real, si existe, debe ser un comando manual separado. Estrategia: [docs/testing-strategy.md](docs/testing-strategy.md).

## Deployment

El build permite definir la ruta base con `VITE_BASE_PATH`. En GitHub Actions se usa el `base_path` calculado por Pages, por lo que funciona tanto con repositorios de proyecto como con un dominio configurado. `HashRouter` evita 404 del hosting estático en recargas de rutas internas.

En GitHub:

1. Abra **Settings**.
2. Abra **Pages**.
3. Seleccione **GitHub Actions** como source.
4. Haga push a `main` y compruebe el environment `github-pages`.

El workflow obtiene la ruta base de `actions/configure-pages`, configura la URL pública del repositorio desde el contexto de GitHub, valida la aplicación, sube `dist/` como artifact de Pages y despliega con las acciones oficiales. Detalles y solución de problemas: [docs/deployment.md](docs/deployment.md).

## Accesibilidad

El objetivo de ingeniería es WCAG 2.2 AA, no una certificación: foco visible, landmarks, formularios etiquetados, anuncios importantes con `aria-live`, representaciones textuales y respeto por movimiento reducido. Los controles de teclado y foco forman parte de la revisión manual previa a publicar hasta que exista cobertura automatizada específica. Consulte [docs/accessibility.md](docs/accessibility.md).

## Performance

Mapa, rutas pesadas y gráficos se separan del bundle inicial; las solicitudes obsoletas se cancelan; el mapa usa clustering y la analítica pesada se deriva a un worker. Los presupuestos se validan sobre artefactos reales y no se publican puntuaciones Lighthouse inventadas. Consulte [docs/performance.md](docs/performance.md).

## Limitaciones

- La disponibilidad y latencia dependen de los servicios públicos de USGS.
- USGS limita una consulta a 20 000 eventos; la interfaz exige acotar la búsqueda en lugar de descargarla automáticamente.
- Las exportaciones de Explorer contienen sólo la página cargada, no el conjunto completo de una consulta paginada.
- El producto es estático: no hay sincronización entre dispositivos ni trabajo en segundo plano cuando se cierra la pestaña.
- Los datos guardados viven sólo en el navegador y pueden perderse si el usuario borra el almacenamiento local.
- Algunas regiones, como el Cinturón de Fuego o las macrozonas peruanas, son aproximaciones configurables, no límites administrativos ni científicos normativos.
- Las tiles de OpenStreetMap requieren conexión; la aplicación no las descarga para uso offline.

## Roadmap

El orden previsto después de estabilizar y medir el núcleo es:

1. Comparaciones con datasets y periodos configurables, normalización por duración y persistencia de comparaciones guardadas.
2. Exportación opcional de conjuntos paginados con progreso, cancelación y límites explícitos.
3. Persistencia de historial reciente mediante una nueva migración explícita.
4. Traducción inglesa completa mediante un catálogo de mensajes tipado y formatos `Intl` compartidos.
5. Catálogo Storybook más amplio con estados extremos, móvil, tema oscuro y checks de accesibilidad.

Estos elementos son dirección de producto, no funcionalidad declarada como disponible hoy.

## Privacidad y seguridad

No hay cuentas, trackers, analítica externa ni recolección de datos personales. SismoScope no solicita geolocalización al cargar. Si el usuario decide usar una ubicación, permanece en el navegador. Las respuestas externas se validan, no se renderiza HTML procedente de USGS y los enlaces externos se restringen a destinos esperados.

## Licencia y atribuciones

El código de SismoScope se distribuye bajo [licencia MIT](LICENSE).

- Datos sísmicos: [U.S. Geological Survey (USGS)](https://earthquake.usgs.gov/).
- Mapa base: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

El uso de datos y tiles está sujeto a las condiciones de sus respectivos proveedores.
