# Accesibilidad

## Objetivo

SismoScope apunta a WCAG 2.2 nivel AA. Es un objetivo de ingeniería sujeto a pruebas continuas, no una certificación. La regla central es que mapas y gráficos complementan la información: todos los eventos y resultados relevantes deben poder consultarse en una representación textual operable con teclado.

## Estructura de página

La aplicación ofrece navegación principal, un único `main`, encabezados de ruta y estados de carga o error con semántica visible. El primer control permite saltar al contenido principal sin modificar la ruta del `HashRouter`; ese comportamiento tiene una prueba E2E específica. Los estilos globales conservan foco visible.

La gestión de foco entre todas las transiciones de ruta y el retorno al elemento de origen todavía se revisan manualmente; no se declaran como cobertura automatizada completa.

## Criterios de navegación por teclado

Esta tabla es una lista de revisión, no una afirmación de cobertura automática para cada interacción.

| Interacción       | Comportamiento esperado                                                           |
| ----------------- | --------------------------------------------------------------------------------- |
| Navegación global | orden DOM lógico; `Tab` y `Shift+Tab`; estado actual anunciado                    |
| Botones y enlaces | activación nativa con teclado, sin `div` clicable                                 |
| Paneles y drawers | apertura anunciada, foco inicial útil, cierre con `Escape`, retorno al disparador |
| Dialogs           | foco contenido mientras están abiertos y nombre accesible                         |
| Tabla             | headers asociados, ordenación mediante botón con estado anunciado                 |
| Paginación        | controles etiquetados y página actual identificada                                |
| Filtros           | labels persistentes, fieldsets para grupos y botón explícito para aplicar         |
| Mapa              | nunca bloquea el recorrido; la vista lista ofrece los mismos eventos cargados     |
| Tooltips          | disponibles con foco y hover, descartables y sin contenido esencial exclusivo     |

Los atajos adicionales, si se incorporan, no sustituyen comportamientos nativos ni entran en conflicto con lectores de pantalla.

## Formularios y filtros

- Cada control tiene `label` real; el placeholder no hace de etiqueta.
- Unidades, formato y límites forman parte de la descripción accesible.
- Los errores se asocian al campo y se resumen al enviar cuando afectan a varias entradas.
- Rango rectangular y radio son opciones mutuamente excluyentes comprensibles, no una combinación de checkboxes contradictoria.
- Los cambios de borrador no disparan una búsqueda en cada movimiento del mapa; «Buscar en esta zona» confirma la acción.
- El foco no se mueve por un refetch en segundo plano.
- Un estado de carga conserva el nombre del control y expresa ocupación sin anunciar cada actualización menor.

## Mapa

El mapa ofrece contexto espacial. Explorer permite cambiar a lista o vista mixta para consultar en texto los mismos eventos cargados; ambas representaciones comparten selección.

- Cada marcador corresponde a un elemento textual con magnitud, lugar, fecha y profundidad.
- Seleccionar desde la lista destaca y centra el marcador; seleccionar un marcador identifica el mismo evento en la lista sin perder el foco inesperadamente.
- Clusters expresan el número de eventos y no dependen sólo del tamaño o color.
- Leyendas de magnitud y profundidad incluyen texto, rangos y unidades.
- La atribución de OpenStreetMap y USGS permanece visible y accesible.
- No se exige precisión motora fina para acceder a un evento.

Leaflet no convierte por sí solo el canvas/viewport en una experiencia completa de lector de pantalla; por eso no se declara el mapa como sustituto de la tabla.

## Gráficos

Dashboard y Analytics acompañan sus gráficos principales de contexto y valores textuales. El criterio para cada visualización es:

1. título y descripción de la pregunta que responde;
2. resumen textual de hallazgos descriptivos sin inferencias causales;
3. tabla o lista con los valores/buckets subyacentes;
4. etiquetas o leyenda textual para interpretar las series.

Los tooltips no deben contener el único acceso a un valor. La comparación expone sus métricas y calidad de muestra en DOM, pero todavía no ofrece una tabla exacta de cada bucket del histograma; completar esa alternativa forma parte del trabajo de accesibilidad pendiente.

## Color, contraste y movimiento

- Texto normal y grande sigue los mínimos AA sobre todos los estados y temas.
- Foco, error, alerta PAGER, magnitud y profundidad no se distinguen únicamente por color.
- Rojo se reserva para estados críticos reales, no para todos los terremotos.
- Tema oscuro define tokens propios; no invierte colores automáticamente.
- `prefers-reduced-motion` elimina desplazamientos y transiciones no esenciales.
- Skeletons no parpadean y se limitan a cargas iniciales.
- Targets táctiles buscan al menos 24 × 24 CSS px y separación suficiente; las acciones principales usan un área mayor.

## Fechas, números y lenguaje

- Las fechas indican explícitamente UTC o zona local elegida.
- Tiempo relativo siempre dispone de fecha/hora absoluta.
- Magnitud y profundidad incluyen unidades y no se comunican sólo con iconos.
- `0`, «No disponible» y «No calculado» son estados distintos.
- La bandera de tsunami se describe como «reportado por la fuente», no como alerta.
- El lenguaje evita afirmar daños, predicción, causalidad o condición de réplica.

## Anuncios dinámicos

Se usa `aria-live="polite"` para cambios confirmados de conteo, resultados, guardado y recuperación. Un error que bloquea una acción puede usar anuncio asertivo, sin repetirlo en cada render. Polling silencioso actualiza la hora visible y sólo anuncia cambios que afectan a la tarea actual.

## Pruebas automatizadas

Testing Library consulta la interfaz por roles, nombres y labels en los flujos de integración. La cobertura axe actual se limita a la ruta Acerca de y desactiva la regla de contraste, que jsdom no puede evaluar de forma fiable.

Playwright enfoca el control de salto y comprueba que su activación por teclado dirige el foco a `#main-content` sin cambiar la ruta hash. El orden completo de tabulación se revisa manualmente. Los demás E2E ejercitan navegación visible, persistencia, descarga y recuperación, pero no constituyen una auditoría completa de teclado, dialogs o retorno de foco.

## Revisión manual antes de publicar

1. Completar los flujos críticos sólo con teclado.
2. Revisar con un lector de pantalla de escritorio disponible.
3. Comprobar zoom al 200 % y reflow a 320 CSS px sin pérdida de acciones.
4. Probar temas claro, oscuro y alto contraste del sistema cuando esté disponible.
5. Activar movimiento reducido.
6. Verificar mensajes con feed vacío, red caída, respuesta inválida y consulta demasiado grande.
7. Confirmar que tabla y resúmenes contienen los datos del mapa y charts.
8. Ejecutar axe y conservar el reporte de la build candidata.

## Criterio de regresión

No se publica una regresión que impida completar un flujo crítico con teclado, elimine la alternativa textual o introduzca una violación automática grave. Las limitaciones conocidas de librerías se documentan con una ruta alternativa funcional, no se ocultan con ARIA excesivo.
