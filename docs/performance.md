# Performance

## Objetivos

SismoScope debe seguir siendo utilizable en un teléfono de gama media y una red móvil razonable. El objetivo no es maximizar una puntuación sintética: es mantener visible el contexto, permitir cancelar trabajo y evitar que mapa o analítica bloqueen la primera interacción.

## Presupuesto técnico

Los límites se comprueban sobre la build de producción, con tamaños comprimidos por gzip:

| Recurso                                   |                                  Presupuesto |
| ----------------------------------------- | -------------------------------------------: |
| JavaScript inicial, sin mapa ni analytics |                                    ≤ 250 KiB |
| Chunk del mapa y clustering               |                                    ≤ 220 KiB |
| Chunk de analytics/ECharts                |                                    ≤ 550 KiB |
| CSS inicial                               |                                     ≤ 80 KiB |
| Imagen individual de interfaz             | ≤ 150 KiB; se evita si no aporta información |

Además:

- mapa y analytics deben aparecer como chunks separados;
- no puede haber requests duplicados evitables por una misma query key;
- ninguna consulta histórica superior a 20 000 eventos se descarga automáticamente;
- la interfaz debe conservar acciones principales a 320 CSS px;
- una tarea de analítica obsoleta no puede reemplazar el resultado actual.

Un exceso requiere reducir dependencias/imports o registrar una decisión con medición y beneficio concreto. No se relajan presupuestos para esconder una regresión.

## Estrategia de carga

### Bundle inicial

Incluye shell, navegación, tokens, manejo de errores y contenido esencial de la ruta. Usa system font stack y no descarga fuentes. Evita imágenes hero, polyfills globales innecesarios y datos fixture.

### División por ruta y capacidad

- Páginas se cargan con `import()` y límites de carga pequeños.
- Leaflet, React Leaflet y clustering sólo se importan al mostrar un mapa.
- ECharts y configuración de series sólo se importan al abrir analítica.
- El worker se emite como asset separado mediante la sintaxis de Vite.
- Una falla al cargar un chunk se presenta como error recuperable.

## Red y datos

- TanStack Query deduplica por claves canónicas.
- Cada query propaga `AbortSignal` y aplica timeout.
- Los feeds se cachean con frescura acorde a su ventana; los detalles cambian con menos frecuencia.
- Polling existe sólo en modo Live y se pausa cuando la pestaña no está visible.
- La paginación muestra como máximo una página razonable y conserva contexto mientras llega la siguiente.
- La exportación trabaja sobre la página ya cargada y no dispara solicitudes adicionales.
- No se precargan tiles fuera del viewport ni se descargan para uso offline.

## Renderizado

- Clustering reduce el número de capas Leaflet visibles.
- Los estilos de marcador y callbacks repetidos se estabilizan donde evitan trabajo medible.
- La selección se representa por ID; no se duplica el dataset en estado local.
- Tablas usan paginación. La virtualización se incorpora sólo si un perfil demuestra que el volumen visible lo exige.
- El borrador de filtros no reconstruye consultas o mapa en cada pulsación; debounce se reserva a controles que realmente lo necesitan.
- `useMemo` y `useCallback` no se aplican como decoración: requieren identidad estable o cálculo costoso concreto.

## Analítica

El hilo principal prepara un arreglo serializable mínimo. Estadísticas, percentiles y buckets se calculan en Web Worker. Cada solicitud lleva un ID; cancelar o cambiar dataset invalida la anterior.

El coste de structured clone se considera parte de la operación. No se envían objetos React, instancias de librerías ni el GeoJSON externo completo cuando basta el modelo plano.

## Estados de carga

- La navegación y filtros utilizables aparecen antes que mapas o charts.
- Skeletons se restringen a formas estables de carga inicial.
- Un refetch mantiene datos existentes con indicador de actualización, sin overlay bloqueante.
- La lista vacía no usa un skeleton perpetuo.
- Progreso anuncia hitos, no cada registro procesado.

## Cómo medir

### Artefactos

```bash
pnpm install --frozen-lockfile
VITE_BASE_PATH=/proyecto/ pnpm build
find dist/assets -maxdepth 1 -type f -printf '%f %s bytes\n' | sort
```

Para obtener tamaños gzip sin modificar el repo:

```bash
gzip -c dist/assets/<archivo>.js | wc -c
```

La revisión registra commit, Node, pnpm, navegador, modo de build, dispositivo/CPU emulado y condición de red. Sólo se comparan mediciones con el mismo método.

### Navegador

En Chrome DevTools Performance/Network:

1. limpiar caché y almacenamiento de la prueba;
2. cargar dashboard en viewport móvil;
3. abrir explorer, mapa y analytics por separado;
4. aplicar filtros rápidamente para comprobar abortos;
5. perfilar selección de eventos y cambio de página;
6. inspeccionar tareas largas y solicitudes duplicadas.

Lighthouse puede usarse como señal, pero su resultado depende del entorno. El repositorio no publica una puntuación sin el reporte correspondiente.

## Seguimiento en CI

CI siempre genera una build de producción. Los tamaños se leen del artefacto y pueden convertirse en una puerta automática cuando la nomenclatura de chunks sea estable. Playwright conserva trace y reporte en fallos para distinguir red local, carga de chunks y renderizado.

## Trade-offs conocidos

- ECharts y Leaflet son dependencias considerables; su coste se contiene con carga diferida en lugar de implementar visualizaciones incompletas.
- Validar todo el payload con Zod consume CPU, pero evita propagar datos corruptos. Se hace una sola vez en la frontera.
- Clustering mejora el mapa a costa de cálculo adicional; sigue siendo preferible a miles de marcadores DOM simultáneos.
- Conservar la página anterior mejora continuidad, pero se marca claramente como desactualizada para no confundirla con el resultado nuevo.
