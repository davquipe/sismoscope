# Estrategia de testing

## Principio

Las pruebas cubren riesgos, no líneas por obligación. Las fronteras externas, los estados imposibles, las migraciones y los flujos que una persona necesita completar tienen prioridad sobre snapshots extensos o cobertura superficial.

CI es determinista y no depende de USGS en vivo. MSW intercepta `fetch` en integración y Playwright enruta endpoints en E2E. Los fixtures son pequeños, versionados y exclusivos de test.

## Pirámide práctica

| Nivel        | Herramientas                      | Riesgo cubierto                                                     |
| ------------ | --------------------------------- | ------------------------------------------------------------------- |
| Unitario     | Vitest, fake IndexedDB            | builders, schemas, cálculos, serialización y migraciones            |
| Integración  | Vitest, Testing Library, MSW, axe | React + queries + URL, estados de datos y una comprobación axe      |
| E2E          | Playwright                        | navegación, persistencia, descarga, recuperación y control de salto |
| Smoke manual | navegador + USGS real             | compatibilidad actual del proveedor; no bloquea CI por red externa  |

## Unit tests

### API y dominio

- Builder FDSN para rectángulos y círculos, conversión de página a offset y exclusión de paginación en el conteo previo.
- Rangos inválidos, límite de resultados y allowlist HTTPS exacta para detalles.
- Normalización de feeds, metadatos opcionales, productos de detalle, cero frente a ausencia y coordenadas corruptas.
- Gateway para conteo, feed, URL rechazada, red, HTTP 429, aborto solicitado y timeout.

### Cálculo

- Distancia Haversine conocida, simetría y rechazo de coordenadas fuera de rango.
- Percentiles R-7, desviación estándar poblacional, datasets vacíos y valores ausentes.
- Fronteras no solapadas para buckets de magnitud y profundidad.

### Estado, exportación y persistencia

- Round-trip y normalización de filtros URL, incluidos rectángulo, círculo, valores cero y offset one-based.
- CSV con delimitadores, comillas, saltos de línea y protección ante fórmulas; fechas/metadatos ISO y coordenadas GeoJSON.
- Importación de configuración válida o corrupta y rechazo de versiones, campos o rangos incompatibles.
- Plan de migraciones y migración IndexedDB de v1 a v2.

## Integration tests

Las pruebas renderizan la aplicación con Testing Library y handlers MSW. La cobertura actual incluye:

- dashboard con feed, feed vacío, red caída y payload inválido;
- aplicación de magnitud mínima y conservación del filtro en la URL;
- ficha técnica y consulta de eventos cercanos sin etiquetarlos como réplicas;
- una comprobación axe sobre la ruta Acerca de, con contraste excluido porque jsdom no lo evalúa de forma fiable.

Persistencia completa, paginación, sincronización mapa/lista y más rutas axe requieren cobertura de integración adicional; no se presentan como ya automatizadas.

## E2E

### Control de salto

```text
Enfocar y activar «Saltar al contenido» con teclado → foco en main
→ la ruta hash no cambia
```

### Flujo 1: exploración

```text
Dashboard → Explorer → seleccionar evento → detalle
```

### Flujo 2: búsqueda guardada

```text
Explorer con ventana de siete días → count → query → guardar → recargar
→ ejecutar búsqueda guardada
```

### Flujo 3: analítica y exportación

```text
Resultados → Analytics → resumen y visualizaciones
→ exportar CSV → validar el nombre de descarga
```

### Flujo 4: preferencias

```text
Tema → zona horaria → recargar → preferencias conservadas
```

### Flujo 5: recuperación

```text
USGS interceptado con fallo → error recuperable → reintentar
→ resultados válidos
```

Cada flujo usa respuestas interceptadas y actualmente se ejecuta en Chromium con el perfil Desktop Chrome. Los selectores priorizan roles y nombres accesibles; la cobertura E2E móvil sigue pendiente.

## Accesibilidad

axe aporta una comprobación automática acotada y Testing Library incentiva semántica. Playwright cubre el control de salto y los flujos enumerados, no una auditoría completa de teclado o foco. La validación manual sigue [accessibility.md](accessibility.md).

## Workers

Las funciones estadísticas se prueban sin worker. El E2E de analítica ejercita la integración con el worker en un navegador real; el protocolo del adaptador, el descarte de tareas obsoletas y los datasets grandes todavía no tienen pruebas aisladas.

## Fixtures

Los fixtures versionados representan una colección y un detalle sintéticos pequeños. Los estados vacío, inválido y de error se construyen en la prueba correspondiente; los casos de transporte del gateway usan dobles de `fetch`.

No se copian datasets completos de producción ni información personal. Los IDs sintéticos son evidentes dentro de test y nunca se importan desde código productivo.

## Comandos

```bash
pnpm test:unit
pnpm test:integration
pnpm test:coverage
pnpm build
pnpm test:e2e
```

`pnpm test` ofrece ciclo rápido con Vitest. Las pruebas automatizadas no consultan USGS en vivo.

## CI y artifacts

El workflow de calidad ejecuta typecheck, lint, unitarios, integración, build y E2E. Chromium se instala después del build. En fallo o cancelación de E2E se adjunta el directorio del reporte Playwright, que puede contener reporte HTML, trace y capturas según la configuración; el artifact expira para no convertirse en almacenamiento indefinido.

## Cobertura

La cobertura ayuda a encontrar ramas olvidadas, pero no es una meta aislada. Un porcentaje alto no compensa no probar una respuesta corrupta, un límite geográfico, una migración o una interacción de teclado. Las nuevas ramas de error y normalización deben demostrar su comportamiento con casos observables.

## Criterio de aceptación

Una build candidata debe pasar todos los comandos de CI, no realizar llamadas en vivo durante tests, no introducir violaciones detectadas por los checks actuales y dejar evidencia reproducible cuando un test E2E falla. Una prueba flaky se investiga como defecto; aumentar reintentos no es la primera solución.
