# Metodología

## Propósito

SismoScope transforma eventos publicados por USGS en resúmenes descriptivos. La metodología busca reproducibilidad y honestidad: no predice terremotos, no estima daños y no convierte proximidad o correlación en causalidad.

## Fuente y unidad de observación

La unidad es un evento de tipo `earthquake` devuelto por USGS. Los feeds cubren ventanas recientes definidas por el proveedor; las búsquedas personalizadas usan FDSN Event. La fecha `generated` describe el snapshot de la colección y no necesariamente la última revisión de cada evento.

USGS puede añadir, revisar o eliminar eventos. Dos consultas con los mismos filtros en momentos distintos pueden producir resultados distintos. Cada exportación incluye filtros, fecha de generación y atribución para hacer visible ese contexto.

## Selección del dataset

Un análisis se define por:

- rango temporal UTC;
- filtro geográfico global, preset, rectángulo o círculo;
- magnitud y profundidad opcionales;
- percepción/significancia/alerta/revisión opcionales;
- orden;
- páginas efectivamente descargadas.

Antes de una búsqueda histórica se consulta el conteo. Si supera 20 000, el análisis no se ejecuta hasta acotar el conjunto. Para datos paginados, la UI distingue una página visible de un dataset completo; no calcula estadísticas globales sobre una muestra parcial sin etiquetarla.

## Regiones

Perú y mundo son opciones principales. Costa, sierra, selva y Cinturón de Fuego usan configuraciones aproximadas para exploración. No representan límites administrativos oficiales, placas tectónicas exactas ni jurisdicciones científicas. La exportación identifica el preset o las coordenadas usadas.

«Vista actual del mapa» sólo se convierte en filtro tras la acción explícita «Buscar en esta zona». Mover o hacer zoom no cambia el dataset automáticamente.

## Campos ausentes

Se excluyen valores `null` del cálculo que necesita ese campo, pero se conserva el total del dataset como denominador contextual. Por ejemplo, la magnitud media usa eventos con magnitud disponible y reporta cuántos participaron.

Se distinguen:

- cero reportado;
- valor no disponible;
- estadística no calculable;
- colección sin eventos.

No se imputan magnitud, profundidad, percepción ni calidad.

## Estadística descriptiva

Para valores finitos `x₁ … xₙ`:

- **total:** número de eventos del dataset;
- **mínimo/máximo:** extremos observados;
- **media:** `Σxᵢ / n`;
- **mediana:** valor central ordenado; con `n` par, media de los dos centrales;
- **percentil:** método R-7, con interpolación lineal sobre la posición `(n − 1) × p` del arreglo ordenado;
- **desviación estándar:** poblacional, `sqrt(Σ(xᵢ − media)² / n)`, porque se describe el dataset cargado y no se estima una población mayor.

Para `n = 0`, estadísticas numéricas son `null`. Para `n = 1`, la desviación poblacional es cero. La presentación redondea, pero los cálculos conservan precisión de `number`.

Se reportan total, media, mediana, mínimo, máximo, percentiles configurados y desviación estándar para las variables apropiadas. Magnitud máxima y profundidad media/mediana se muestran junto al número de observaciones válidas.

## Porcentajes

Porcentaje revisado:

```text
eventos con reviewStatus = reviewed / total de eventos × 100
```

Porcentaje con reportes:

```text
eventos con feltReports > 0 / total de eventos × 100
```

Un evento con `feltReports = 0` no cuenta como «con reportes»; un `null` tampoco, pero permanece en el total y su ausencia se informa. Cada porcentaje documenta su denominador en la alternativa textual.

El resumen local cuenta como significativo un evento con `significance ≥ 600`; esta regla no reemplaza el feed «significant» publicado por USGS. «Con alerta» significa `alertLevel` no nulo, sin inferir impacto cuando el campo falta.

## Buckets

Los histogramas usan intervalos sin solapamiento, cerrados a la izquierda y abiertos a la derecha. Los límites se muestran en la leyenda y tabla.

- Magnitud: `< 1`, `[1, 2.5)`, `[2.5, 4)`, `[4, 6)` y `≥ 6`.
- Profundidad en km: `< 0`, `[0, 70)`, `[70, 300)` y `≥ 300`.
- Tiempo: hora, día o semana en UTC según el rango y la selección del usuario.

Un valor exactamente en un límite pertenece al bucket que comienza en ese límite. Los valores ausentes se cuentan aparte; no entran en un bucket numérico.

## Eventos cercanos en tiempo y espacio

La distancia superficial se calcula con Haversine usando latitud/longitud y un radio terrestre medio de `6371.0088 km`. La profundidad se muestra por separado; no se incorpora silenciosamente como distancia 3D.

El usuario elige radio y ventana temporal. Un evento candidato debe satisfacer ambos y no ser el mismo ID. La lista se ordena de forma explícita por distancia o diferencia temporal.

La etiqueta es «eventos cercanos en tiempo y espacio». La aplicación no los llama réplicas, precursores ni eventos relacionados causalmente: esa clasificación requiere análisis sismológico que este producto no realiza.

## Series temporales

Los instantes se agrupan en UTC para reproducibilidad. Una semana comienza el lunes a las 00:00 UTC y se etiqueta con su rango, evitando números de semana ambiguos entre años. La zona local sólo cambia el formato visible del instante individual.

Eventos por unidad temporal es un conteo, no una tasa de riesgo. Comparar ventanas de distinta duración requiere normalizar por duración y mostrar tanto conteo como denominador.

## Comparaciones

Cuando dos datasets se comparan:

```text
diferencia porcentual mostrada = (A − B) / B × 100
```

Si `B = 0`, la diferencia porcentual se muestra como no calculable, nunca como infinito. Se presentan cobertura temporal, tamaño de muestra y disponibilidad de campos de ambos conjuntos.

El comparador actual contrasta Perú con el mundo durante los últimos siete días o dos semanas peruanas consecutivas. Muestra cuántos eventos encontró USGS y cuántos cargó para cada muestra, y advierte cuando una muestra es pequeña o los tamaños difieren mucho. Una diferencia descriptiva no demuestra que una región, periodo o variable cause otra. Comparaciones con filtros, periodos o datasets elegidos por el usuario quedan fuera del alcance actual.

## Magnitud, profundidad y calidad

Magnitudes de tipos diferentes (`ml`, `mb`, `mww`, entre otros) no son necesariamente intercambiables. SismoScope conserva `magnitudeType` y muestra su distribución; una media combinada debe leerse con esa limitación.

Profundidad procede de la geometría USGS y se expresa en km. Valores negativos o revisados no se «corrigen» localmente.

Estaciones, RMS, gap azimutal y distancia mínima se reportan por separado. No se sintetizan en una puntuación de confianza propia.

## Significancia, alerta y percepción

`significance`, nivel PAGER, CDI/MMI, reportes percibidos y bandera de tsunami conservan el significado de la fuente. Ausencia de un producto o alerta no equivale a ausencia de impacto. Una magnitud alta tampoco autoriza a inferir daños concretos.

## Exportaciones

CSV y JSON normalizado usan fechas ISO UTC, unidades explícitas y escape correcto. GeoJSON restaura `[longitude, latitude, depth]`. En Explorer, la exportación contiene sólo la página cargada. Toda exportación incluye o acompaña metadata con:

- fuente USGS;
- fecha de generación;
- filtros canónicos;
- alcance/páginas descargadas;
- preset o geometría;
- versión de formato de SismoScope.

La exportación conserva `null`; no inventa cadenas para completar datos. Un filename describe dataset y fecha sin incluir información personal.

## Reproducibilidad

Para reproducir un resultado se necesita la URL/filtros, el timestamp de consulta y el snapshot exportado, porque USGS puede revisar el catálogo. Una URL compartida reproduce la consulta, no garantiza un snapshot inmutable.

## Límites de interpretación

- Catálogos tienen umbrales y completitud variables por región, periodo y red.
- Magnitudes y ubicaciones pueden revisarse.
- Los presets son aproximaciones.
- Valores ausentes no se distribuyen necesariamente al azar.
- Correlación visual, clusters o proximidad no prueban causalidad.
- El producto no ofrece alerta temprana, predicción ni instrucciones de emergencia.

Ante una emergencia, la persona debe consultar autoridades y servicios oficiales, no SismoScope.
