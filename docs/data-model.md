# Modelo de datos

## Tres representaciones deliberadas

SismoScope no reutiliza el contrato USGS como modelo de UI. Un evento atraviesa tres formas:

```text
JSON desconocido
  → schemas externos (forma USGS)
  → normalizadores puros
  → modelos internos (vocabulario SismoScope)
```

Esta separación permite aceptar campos opcionales de la fuente sin volver opcional todo el dominio, nombrar coordenadas con claridad y probar cambios de contrato en una única frontera.

## Schemas externos

Los schemas Zod describen el subconjunto de GeoJSON utilizado por la aplicación:

- `FeatureCollection` con `metadata`, `features` y `bbox` opcional;
- `Feature` con `id`, `properties` y geometría `Point`;
- coordenadas GeoJSON en orden `[longitude, latitude, depth]`;
- propiedades nullable de magnitud, percepción, alerta, calidad y URLs;
- detalle con CDI, MMI y grupos opcionales de `products`.

El parseo empieza desde `unknown`. Un schema externo puede ser tolerante a propiedades adicionales que USGS añada, pero es estricto sobre los campos que SismoScope usa. Si esos campos no son seguros, no se construye un modelo parcial engañoso.

## Entidad `EarthquakeEvent`

El contrato interno principal es:

```ts
interface EarthquakeEvent {
  readonly id: EarthquakeId;
  readonly magnitude: number | null;
  readonly magnitudeType: string | null;
  readonly place: string;
  readonly occurredAt: string;
  readonly updatedAt: string;
  readonly coordinates: {
    readonly latitude: number;
    readonly longitude: number;
    readonly depthKm: number;
  };
  readonly significance: number;
  readonly feltReports: number | null;
  readonly alertLevel: 'green' | 'yellow' | 'orange' | 'red' | null;
  readonly tsunamiFlag: boolean;
  readonly reviewStatus: 'automatic' | 'reviewed' | 'deleted' | 'unknown';
  readonly sourceNetwork: string;
  readonly detailUrl: string;
  readonly webUrl: string;
  readonly quality: EarthquakeQuality;
}
```

`EarthquakeId` es un string nominal construido por una función que rechaza cadenas vacías. La assertion necesaria para aplicar la marca queda confinada a ese constructor.

Todos los objetos de dominio son de sólo lectura. Las colecciones se reemplazan o derivan; no se muta una respuesta en caché.

## Ausencia, cero y desconocido

Reglas transversales:

- `0` significa un valor reportado igual a cero.
- `null` significa que la fuente no aportó un valor utilizable.
- «No calculado» pertenece al estado de una operación, no se codifica como número o cadena del evento.
- Una lista vacía significa que no hay elementos en el payload validado; no implica que el proveedor garantice su inexistencia histórica.
- `unknown` en `reviewStatus` representa un valor externo no mapeado; no se convierte automáticamente en `automatic`.

Nunca se transforma ausencia en `""`, `0` o una etiqueta de negocio inventada.

## Tiempo

`occurredAt`, `updatedAt`, `generatedAt`, `savedAt` y demás instantes se almacenan como ISO 8601 UTC terminados en `Z`. Los epoch de USGS se convierten una sola vez durante normalización.

La preferencia UTC/local sólo afecta a `Intl.DateTimeFormat`. Cambiarla no modifica filtros, query keys, comparaciones ni datos persistidos.

Los buckets temporales de analítica se definen en UTC para que un enlace compartido produzca el mismo dataset y agrupación en distintas zonas horarias.

## Coordenadas

El dominio usa propiedades nombradas para evitar el error común entre longitud y latitud. Los exports vuelven a GeoJSON en el orden normativo:

```text
[longitude, latitude, depthKm]
```

Latitud debe estar entre −90 y 90; longitud entre −180 y 180. Profundidades negativas pueden existir en la fuente y no se eliminan silenciosamente; la presentación conserva unidades en kilómetros.

## Calidad y significado

`EarthquakeQuality` contiene:

- `stationCount` (`nst` en la fuente);
- `minimumDistance` (`dmin`);
- `rms`;
- `azimuthalGap` (`gap`).

Cada campo es `number | null`. No se combinan en una puntuación propia sin una metodología documentada. `significance` conserva el valor USGS y `tsunamiFlag` conserva la bandera de la fuente; ninguno prueba daños ni sustituye una alerta.

## Colecciones y paginación

`EarthquakeCollection` agrupa eventos, total, metadata normalizada y bounds 3D opcionales. Metadata conserva fecha de generación, título, URL de origen, versión API, estado HTTP y conteo reportado.

`EarthquakeSearchResult` añade:

```ts
interface EarthquakeSearchPage {
  readonly offset: number; // USGS es one-based
  readonly limit: number;
  readonly returned: number;
  readonly hasMore: boolean;
}
```

`total` describe la colección normalizada disponible en esa respuesta; el conteo previo de la consulta vive como dato remoto propio. La UI no deduce un total histórico fiable multiplicando páginas.

## Detalle y productos

`EarthquakeDetail` compone el evento normalizado con:

- intensidad comunitaria (`communityIntensity`, CDI) nullable;
- intensidad instrumental (`instrumentalIntensity`, MMI) nullable;
- grupos de productos normalizados;
- URL original validada.

Un producto conserva ID, tipo, código, fuente, estado, actualización, peso preferido, propiedades escalares y contenidos. Los contenidos sólo exponen metadata segura —tipo MIME, fecha, tamaño, URL validable y hash—; nunca se renderiza HTML externo.

## Filtros geográficos

En el dominio de consulta, `GeographicFilter` evita mezclar geometrías:

```ts
type GeographicFilter =
  | { readonly type: 'global' }
  | { readonly type: 'rectangle'; readonly bounds: GeographicBounds }
  | {
      readonly type: 'circle';
      readonly center: GeographicPoint;
      readonly radiusKm: number;
    };
```

La capa persistente amplía esta unión con `preset`, cuyo `presetId` se resuelve mediante configuración antes de llamar al gateway. Así un cambio de límites no exige reescribir cada búsqueda guardada, aunque puede cambiar explícitamente sus resultados futuros.

Presets actuales: Perú, costa, sierra, selva, Cinturón de Fuego aproximado y mundo.

## `EarthquakeSearchQuery`

El gateway admite tiempos, magnitud, profundidad, geografía, percepción mínima, significancia, alerta, revisión, orden, límite y offset. Las propiedades opcionales significan «sin restricción»; no se serializan como cadenas vacías.

Invariantes:

- inicio anterior a fin;
- mínimo no mayor al máximo;
- rectángulo con límites crecientes;
- radio positivo y centro válido;
- `limit` y `offset` enteros en rango aceptado;
- orden limitado a valores soportados por USGS;
- fechas expresadas en UTC.

Los filtros de URL y búsquedas guardadas tienen schemas propios y se adaptan al query de gateway. No se comparte por accidente un objeto de formulario sin validar.

## Feeds realtime

El feed es un template literal tipado:

```ts
type RealtimeFeed = `${'all' | 'significant' | '1.0' | '2.5' | '4.5'}_${
  'hour' | 'day' | 'week' | 'month'}`;
```

La configuración concreta determina qué combinaciones corresponden a un recurso oficial. El tipo evita URLs arbitrarias y facilita query keys estables.

## Errores

`AppError` es una unión de clases con discriminante `kind`:

```text
network | http | validation | rate-limit |
query-too-large | persistence | unexpected
```

Los abortos intencionales se detectan aparte y no se convierten en mensajes de error. Sólo red, rate limit y HTTP 5xx se consideran recuperables por defecto. Las capas visuales deciden el texto/acción a partir del discriminante, no comparando mensajes.

## Persistencia actual

La base se llama `sismoscope` y su versión actual es 2.

| Object store          | Key path       | Contenido                                       |
| --------------------- | -------------- | ----------------------------------------------- |
| `savedSearches`       | `id`           | nombre, filtros validados y timestamps UTC      |
| `favoriteEarthquakes` | `earthquakeId` | fecha, nota opcional y snapshot mínimo opcional |
| `preferences`         | `key`          | valor serializado validado y actualización UTC  |

La versión 1 creó búsquedas y favoritos. La migración a versión 2 añadió preferencias, índices por nombre/actualización/fecha guardada y completó `updatedAt` desde `createdAt` en registros antiguos.

Cada lectura pasa de nuevo por Zod. `getAll` devuelve registros válidos y el número de registros inválidos aislados, de modo que corrupción parcial no bloquea el resto. Historial y comparaciones guardadas requieren stores/versiones posteriores; no se presentan como persistencia implementada en esta versión.

El storage asíncrono que integra preferencias con Zustand intenta IndexedDB y degrada de forma controlada a `localStorage` o memoria cuando el entorno no ofrece la opción anterior. Esa degradación mantiene la interfaz operable, aunque reduce garantías de persistencia, y no se usa para cachear datasets USGS.

La transferencia de configuración usa JSON estricto con `schemaVersion: 1` y un límite de 5 MB. Todo el documento se valida antes de aplicar cambios; propiedades desconocidas o una versión no soportada se rechazan.

## Búsquedas guardadas y favoritos

Una búsqueda guardada incluye rango temporal discriminado —preset o personalizado—, filtro geográfico, filtros numéricos, orden y page size. Nombre, IDs, rangos y longitudes tienen límites explícitos.

Un favorito referencia el ID estable y puede guardar un snapshot pequeño para seguir siendo reconocible si el evento se actualiza. Ese snapshot no sustituye el detalle vivo de USGS y no contiene una respuesta completa.

## Protocolo de analytics

El worker recibe sólo datos serializables necesarios para estadísticas, junto a un ID de tarea. La respuesta es una unión discriminada de éxito/error con el mismo ID. El consumidor descarta resultados cuyo ID ya no sea activo.

Los tipos del protocolo viven en un módulo que no importa React ni APIs DOM innecesarias. Las funciones estadísticas subyacentes aceptan arreglos readonly y devuelven objetos readonly.

## Compatibilidad y evolución

Cambiar un schema externo no obliga a cambiar el modelo si el normalizador puede conservar el contrato. Cambiar el modelo requiere revisar queries, persistencia, exports, worker, UI y fixtures. Cambiar un formato persistido exige incrementar versión, migración incremental y pruebas desde todas las versiones soportadas.
