# ADR 004: Validar fronteras en runtime con Zod

- Estado: Aceptada
- Fecha: 2026-08-03

## Contexto

TypeScript no valida JSON de red, IndexedDB ni archivos importados. USGS puede omitir campos, devolver `null`, revisar contratos o responder con un error que no tenga la forma esperada. Los datos persistidos pueden pertenecer a una versión anterior o estar corruptos.

Confiar en casts convertiría incertidumbre externa en supuesta seguridad interna.

## Decisión

Tratar entradas externas como `unknown` y validarlas con schemas Zod antes de normalizar o usar:

- feeds, búsquedas y detalles USGS;
- parámetros de URL;
- registros leídos de IndexedDB;
- configuración JSON importada;
- mensajes del worker cuando cruzan la frontera.

Los schemas externos describen transporte; los modelos de dominio se construyen mediante mappers puros. Una validación fallida produce `ValidationError`, descarta el payload y ofrece recuperación. Detalles técnicos sólo se registran en desarrollo.

## Consecuencias

### Positivas

- Cambios de proveedor fallan cerca de la frontera y de forma tipada.
- Inferencia de tipos y reglas runtime parten del mismo schema en persistencia/importación.
- Los normalizadores reciben una forma conocida.
- Fixtures inválidos prueban comportamiento realista.

### Costes y riesgos

- Validar colecciones grandes consume CPU y aumenta bundle.
- Un schema demasiado estricto puede rechazar una extensión inocua; uno demasiado laxo puede ocultar un cambio importante.
- Schemas de transporte y tipos de dominio requieren mantenimiento separado.
- Zod no reemplaza invariantes que necesitan lógica o autorización de URL.

## Alternativas consideradas

- **Type assertions:** no ejecutan comprobaciones y trasladan fallos a la UI.
- **Validación manual dispersa:** genera reglas duplicadas y mensajes inconsistentes.
- **Generar tipos desde una muestra:** una muestra no define nulabilidad ni cambios del servicio.
- **Usar directamente GeoJSON:** acopla todos los componentes al proveedor.

## Validación

Las pruebas unitarias cubren payload válido, campos opcionales o nulos, coordenadas corruptas e importaciones malformadas, fuera de versión o con rangos contradictorios. Integración verifica que un payload USGS inválido se presenta como error recuperable. Cualquier relajación del schema requiere una medición de performance separada; el repositorio no publica una medición inexistente.
