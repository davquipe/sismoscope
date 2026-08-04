# Integración con USGS

## Propósito y alcance

SismoScope consume exclusivamente servicios públicos sin autenticación de USGS Earthquake Hazards Program. Toda llamada sale directamente del navegador; no existe proxy propio, API key ni secreto.

La infraestructura implementa este contrato de dominio:

```ts
interface EarthquakeGateway {
  getRealtimeFeed(
    feed: RealtimeFeed,
    options?: GatewayRequestOptions,
  ): Promise<EarthquakeCollection>;
  count(query: EarthquakeSearchQuery, options?: GatewayRequestOptions): Promise<number>;
  search(
    query: EarthquakeSearchQuery,
    options?: GatewayRequestOptions,
  ): Promise<EarthquakeSearchResult>;
  getDetail(detailUrl: string, options?: GatewayRequestOptions): Promise<EarthquakeDetail>;
}
```

Los detalles de transporte permanecen detrás de este gateway. Los componentes reciben modelos normalizados, no GeoJSON externo.

## Endpoints

| Uso           | Endpoint oficial                                                           | Respuesta esperada           |
| ------------- | -------------------------------------------------------------------------- | ---------------------------- |
| Feed reciente | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/<feed>.geojson` | `FeatureCollection` GeoJSON  |
| Conteo        | `https://earthquake.usgs.gov/fdsnws/event/1/count`                         | `{ count, maxAllowed }` JSON |
| Búsqueda      | `https://earthquake.usgs.gov/fdsnws/event/1/query`                         | `FeatureCollection` GeoJSON  |
| Detalle       | URL `properties.detail` de un resultado validado                           | GeoJSON de detalle           |

Las URLs de feed se generan desde una configuración tipada. Las combinaciones públicas cubren ventanas de una hora, un día, siete días y treinta días, y categorías de todos los eventos, significativos y umbrales 1.0+, 2.5+ y 4.5+ cuando USGS ofrece esa combinación. No se repiten literales de endpoint en componentes.

## Consultas FDSN

La búsqueda siempre añade:

```text
format=geojson
eventtype=earthquake
jsonerror=true
```

El builder admite sólo valores definidos y serializa fechas UTC en ISO 8601. `URLSearchParams` se ocupa del escape; no se concatena texto de usuario a una URL.

Parámetros de dominio admitidos:

| Grupo           | Parámetros USGS                                              |
| --------------- | ------------------------------------------------------------ |
| Tiempo          | `starttime`, `endtime`                                       |
| Magnitud        | `minmagnitude`, `maxmagnitude`                               |
| Profundidad     | `mindepth`, `maxdepth`                                       |
| Rectángulo      | `minlatitude`, `maxlatitude`, `minlongitude`, `maxlongitude` |
| Círculo         | `latitude`, `longitude`, `maxradiuskm`                       |
| Calidad/señales | `minfelt`, `minsig`, `alertlevel`, `reviewstatus`            |
| Página          | `orderby`, `limit`, `offset`                                 |

### Invariantes geográficas

El filtro geográfico es una unión discriminada: global, preset, rectángulo o círculo. El builder no puede emitir simultáneamente parámetros rectangulares y circulares. Una futura búsqueda de intersección requeriría un nuevo caso explícito, su propio texto en interfaz y pruebas de contrato.

Longitud, latitud y radio se validan antes de construir la solicitud. Los límites de presets viven en configuración; un preset aproximado se etiqueta como tal en la interfaz y en exportaciones.

## Conteo previo y límite de 20 000

Una búsqueda histórica o avanzada sigue esta secuencia:

1. Canoniza y valida filtros.
2. Envía los mismos filtros relevantes a `/count`, sin `limit`, `offset` ni orden.
3. Si el resultado supera 20 000, crea `QueryTooLargeError` y no inicia la descarga.
4. Si es aceptable, solicita una página de tamaño acotado —100 por defecto— a `/query`.
5. Las páginas adicionales se obtienen a petición mediante los controles de paginación.

El límite se evalúa antes de la primera página, no después de recibir una respuesta demasiado grande. Cambiar `limit` no convierte una consulta total superior a 20 000 en una operación analítica válida; el usuario debe acotar tiempo, región o magnitud.

## Paginación

USGS usa `limit` y `offset`. SismoScope expone páginas basadas en 1 y traduce internamente:

```text
offset = (page - 1) * pageSize + 1
```

La URL guarda `page` y `pageSize`, no el offset de infraestructura. Cualquier cambio de filtro o tamaño vuelve a la primera página. La query key incluye filtros canónicos, orden y paginación para impedir colisiones de caché.

Las exportaciones de Explorer serializan sólo la página cargada. La aplicación no recorre ni descarga automáticamente todas las páginas de una consulta.

## Detalle seguro

`properties.detail` es información externa, no una autorización para solicitar cualquier URL. Antes de llamar al endpoint:

1. se analiza con `URL`;
2. el protocolo debe ser exactamente `https:`;
3. el hostname debe ser exactamente `earthquake.usgs.gov` con la configuración predeterminada;
4. no se permiten credenciales embebidas y el puerto debe estar vacío o ser `443`;
5. la respuesta vuelve a validarse con Zod.

No se acepta una comprobación débil como `hostname.endsWith("usgs.gov")`, porque también admitiría dominios visualmente engañosos. La allowlist se mantiene en configuración y se amplía sólo con evidencia de un host oficial requerido.

Los `products` son opcionales y heterogéneos. El normalizador conserva únicamente campos comprendidos, tolera listas ausentes y nunca renderiza HTML recibido.

## Validación y normalización

La tubería es:

```text
Response.json(): unknown
  → schema externo Zod
  → mapper puro
  → modelo de dominio
  → TanStack Query
  → UI
```

Una validación fallida corta el flujo. En desarrollo puede registrarse una descripción estructurada del problema, sin volcar indiscriminadamente todo el payload; en producción se muestra un mensaje seguro y recuperable.

Reglas de normalización:

- coordenadas GeoJSON `[longitude, latitude, depth]` se convierten a campos nombrados;
- epoch de USGS se convierte a ISO UTC;
- cero se conserva como cero;
- ausencia se representa con `null` cuando el dominio lo permite;
- IDs se convierten al tipo nominal `EarthquakeId` sólo después de validarlos;
- una bandera `tsunami` indica lo reportado por la fuente, no una predicción;
- texto externo se trata siempre como texto plano.

## Cancelación, timeout y reintentos

TanStack Query entrega un `AbortSignal` al gateway. El cliente combina esa cancelación con un timeout finito y clasifica el resultado:

- un aborto solicitado no se presenta como fallo de red;
- un timeout o fallo transitorio puede reintentarse un número limitado de veces;
- HTTP 429 respeta la clasificación `RateLimitError`;
- respuestas 4xx no recuperables, validación y consultas demasiado grandes no se reintentan;
- no existe retry infinito.

Al cambiar filtros, una respuesta anterior puede permanecer visible como contexto, pero una operación obsoleta no actualiza el dataset activo.

## Caché y modo Live

Los feeds tienen un tiempo de frescura menor que los detalles. El polling sólo se activa cuando el usuario elige modo Live y la pestaña está visible. La UI informa la hora de última actualización y distingue datos en refresco de una carga inicial.

La caché de TanStack Query es una optimización de sesión, no almacenamiento histórico. No se vuelcan grandes respuestas en IndexedDB.

## Taxonomía de errores

| Tipo                 | Significado                             | Acción de interfaz                     |
| -------------------- | --------------------------------------- | -------------------------------------- |
| `NetworkError`       | Sin conexión, DNS o fallo de transporte | informar y reintentar                  |
| `HttpError`          | Código HTTP no exitoso                  | explicar según estado                  |
| `ValidationError`    | Respuesta incompatible o corrupta       | descartar datos y permitir reintento   |
| `RateLimitError`     | USGS limita temporalmente               | esperar antes de reintentar            |
| `QueryTooLargeError` | conteo superior al máximo               | pedir filtros más estrechos            |
| `UnexpectedError`    | fallo no clasificado                    | límite de error e identificador seguro |

Los fallos de persistencia se clasifican aparte porque no proceden del gateway.

## Datos de prueba

MSW y Playwright interceptan estos endpoints con fixtures pequeños, inválidos, vacíos y con errores. Los fixtures no entran en el bundle de producción. CI no consulta USGS en vivo. Una prueba manual separada puede comprobar compatibilidad real, pero su resultado no bloquea un PR por indisponibilidad externa.

## Atribución y uso responsable

La interfaz mantiene atribución visible a USGS. Las tiles de mapa conservan la atribución de OpenStreetMap y el comportamiento normal del navegador; no se descargan masivamente, no se precargan niveles ajenos al viewport y no se intenta ocultar el `Referer`.
