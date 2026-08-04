# ADR 002: Usar HashRouter en GitHub Pages

- Estado: Aceptada
- Fecha: 2026-08-03

## Contexto

GitHub Pages sirve archivos estáticos y no permite configurar un fallback general a `index.html`. Con una ruta de history como `BASE_URL/explorer`, una recarga pide ese path al servidor y puede producir 404.

La aplicación necesita rutas compartibles para dashboard, explorer, detalle, analytics, guardados, settings y about, además de query parameters restaurables.

## Decisión

Usar `HashRouter`. Las rutas públicas tienen esta forma:

```text
BASE_URL/#/
BASE_URL/#/explorer
BASE_URL/#/events/EVENT_ID
BASE_URL/#/analytics
```

Los filtros compartibles se serializan en la parte de URL controlada por el router. Los enlaces y redirecciones se crean con React Router; no se concatenan hashes manualmente.

## Consecuencias

### Positivas

- Una recarga siempre solicita el documento estático existente.
- No requiere `404.html`, copia de archivos ni script de redirección.
- Funciona en forks y previews bajo una subruta.
- Mantiene navegación cliente, historial y enlaces compartibles.

### Costes y riesgos

- La URL contiene `#`, menos limpia que History API.
- El fragmento no llega al servidor; no se puede usar para routing/analytics de servidor, que no existen aquí.
- Herramientas externas pueden tratar el fragmento de manera distinta.
- Hay que probar con cuidado la interacción entre fragmento y search params.

## Alternativas consideradas

- **BrowserRouter + `404.html`:** depende de un hack de redirección y puede parpadear o perder parámetros.
- **Una sola ruta sin router:** impide enlaces restaurables y separación por páginas.
- **Hosting con rewrites:** resolvería History API, pero contradice la decisión de soportar GitHub Pages como destino principal.

## Validación

Las pruebas unitarias cubren serialización y restauración de filtros en el hash. Playwright abre rutas hash, recarga una búsqueda guardada y comprueba que el control de salto no altera la ruta. La navegación atrás y la restauración de selección siguen siendo casos manuales o pendientes de automatizar.
