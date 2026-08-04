# ADR 003: Separar estado remoto, URL, preferencias y persistencia

- Estado: Aceptada
- Fecha: 2026-08-03

## Contexto

SismoScope coordina respuestas de USGS, filtros compartibles, preferencias visuales, estado efímero y datos elegidos por el usuario. Un store global único duplicaría caché, permitiría inconsistencias entre URL/UI y dificultaría cancelación o migraciones.

Cada clase de estado tiene una vida y autoridad diferentes.

## Decisión

Asignar un propietario único:

| Clase                                                     | Propietario            |
| --------------------------------------------------------- | ---------------------- |
| Feeds, counts, searches, details                          | TanStack Query         |
| Filtros aplicados, página, vista y selección compartible  | URL validada           |
| Tema, zona horaria, densidad, paneles y autoactualización | Zustand                |
| Búsquedas, favoritos y preferencias serializadas          | repositorios IndexedDB |
| Borradores, foco y overlays                               | estado local React     |

Las query keys se derivan de filtros URL canónicos. Zustand no copia datasets remotos. Los repositorios no se invocan directamente desde componentes presentacionales.

## Consecuencias

### Positivas

- Una sola fuente de verdad por dato.
- Links reproducibles y navegación atrás/adelante coherente.
- Caché, retry y cancelación delegados a la herramienta adecuada.
- Persistencia versionable y validable sin acoplar la UI.
- Tests aislados por propietario.

### Costes y riesgos

- Se necesitan adaptadores entre URL, queries y formularios.
- Una preferencia persistida por Zustand y el repositorio debe compartir schema para no divergir.
- Los defaults deben canonizarse para evitar parámetros redundantes.
- El equipo debe entender qué estado no pertenece a un store global.

## Alternativas consideradas

- **Todo en Zustand/Redux:** duplicaría el servidor remoto, pagination y caché; la URL dejaría de ser autoritativa.
- **Todo en URL:** expondría preferencias/estado efímero y produciría enlaces ruidosos.
- **Todo en IndexedDB:** no resuelve cache freshness ni navegación y complica sincronía de UI.
- **Sólo estado React:** fuerza prop drilling y reimplementa caches/persistencia.

## Validación

Las pruebas cubren URL ↔ filtros, migración/importación persistida y preferencias después de recargar. Navegación atrás, deduplicación observable de queries y recuperación integral ante registros corruptos requieren cobertura adicional. Una revisión de arquitectura rechaza copias de respuestas USGS en Zustand.
