# ADR 005: Persistir datos estructurados en IndexedDB

- Estado: Aceptada
- Fecha: 2026-08-03

## Contexto

La aplicación debe conservar búsquedas, favoritos y preferencias sin backend ni cuenta. Estos datos son estructurados, requieren operaciones por clave, validación, versiones y recuperación después de una recarga.

`localStorage` es síncrono, limitado y no ofrece transacciones ni migración de stores. Guardar respuestas completas de USGS tampoco es deseable por tamaño y caducidad.

## Decisión

Usar IndexedDB detrás de una clase y repositorios tipados. La base `sismoscope`, versión 2, contiene:

- `savedSearches`, key `id`;
- `favoriteEarthquakes`, key `earthquakeId`;
- `preferences`, key `key`.

La versión 1 crea búsquedas y favoritos. La versión 2 crea preferencias, añade índices y migra búsquedas sin `updatedAt` copiando `createdAt`.

Cada escritura valida con Zod. Cada lectura valida de nuevo; una lista devuelve registros válidos y un contador de entradas descartadas. Los componentes consumen repositorios, no transacciones IDB.

La persistencia del store de preferencias usa un adaptador asíncrono y puede degradar de forma explícita a almacenamiento disponible en el navegador para mantener la app operable. Los datos de dominio duraderos continúan usando repositorios IndexedDB.

## Consecuencias

### Positivas

- API asíncrona que no bloquea el hilo principal.
- Stores, índices y transacciones apropiados para datos estructurados.
- Migraciones incrementales comprobables.
- Corrupción parcial no derriba toda la aplicación.
- Sin backend, cuenta ni transferencia de datos personales.

### Costes y riesgos

- IndexedDB tiene API y ciclo de upgrades más complejos.
- Modo privado, cuotas o políticas del navegador pueden impedir persistencia.
- Una pestaña antigua puede bloquear un upgrade; se requiere manejo seguro del evento.
- Los datos no se sincronizan entre dispositivos y desaparecen si el usuario limpia el sitio.
- Reemplazos/importaciones multipaso deben evitar pérdida parcial.

## Alternativas consideradas

- **Sólo localStorage:** sencillo, pero síncrono y pobre para registros/migraciones.
- **Cache Storage:** optimizado para responses/assets, no para entidades editables por clave.
- **Backend:** ofrecería sincronización, pero contradice hosting estático, privacidad y ausencia de secretos.
- **Persistir toda respuesta USGS:** aumenta cuota y crea snapshots obsoletos sin un caso obligatorio.

## Validación

Vitest con `fake-indexeddb` verifica el plan de versiones y la migración v1 → v2, incluidos stores, índices y `updatedAt`. Las pruebas de transferencia validan configuraciones correctas e inválidas. E2E recarga una búsqueda guardada y preferencias; CRUD completo, favoritos y aislamiento de registros corruptos requieren cobertura adicional.
