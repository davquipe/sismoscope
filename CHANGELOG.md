# Changelog

Los cambios notables de SismoScope se documentan aquí. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado seguirá [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Added

- Fundación React/TypeScript/Vite para una aplicación estática bajo una ruta base configurable.
- Arquitectura modular con modelos de dominio separados de schemas USGS y normalización validada.
- Dashboard de actividad reciente para Perú y mundo.
- Explorer con filtros en URL, conteo previo, paginación, mapa agrupado y alternativa tabular.
- Vista de detalle y cálculo de eventos cercanos en tiempo y espacio.
- Analítica descriptiva en worker y exportación CSV/GeoJSON en cliente.
- Comparador básico entre regiones o semanas consecutivas, con tamaños de muestra visibles.
- Persistencia versionada de búsquedas, favoritos y preferencias.
- Tema y presentación de fechas en UTC o zona local.
- Pruebas unitarias, de integración y E2E de riesgos críticos.
- Workflow unificado de calidad y despliegue a GitHub Pages.
- Documentación de arquitectura, API, metodología y siete decisiones arquitectónicas.

### Security

- Validación runtime de respuestas e importaciones.
- Allowlist HTTPS para detalles y enlaces externos de USGS.
- Operación sin secretos, trackers ni HTML externo.

## Política de publicación

Hasta etiquetar la primera versión estable, las entradas permanecen bajo `Unreleased`. Las comparaciones personalizadas o persistidas, la exportación multipágina, la traducción inglesa completa y el catálogo Storybook exhaustivo no se presentan como entregados en esta etapa.
