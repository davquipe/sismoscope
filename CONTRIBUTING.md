# Contribuir a SismoScope

Gracias por mejorar SismoScope. Este proyecto prioriza exactitud, accesibilidad y trazabilidad sobre el número de features.

## Preparar el entorno

1. Instale la versión Node.js LTS indicada en `.nvmrc`.
2. Active la versión de pnpm declarada en `package.json`.
3. Instale con el lockfile sin modificar:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

No hacen falta secretos. Las variables `VITE_*` son públicas por definición; nunca coloque tokens en ellas.

## Antes de abrir un cambio

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:unit
pnpm test:integration
pnpm build
```

Ejecute `pnpm test:e2e` si modifica navegación, filtros, persistencia, exportación o un flujo visible. La primera ejecución local de Playwright puede requerir instalar Chromium con `pnpm exec playwright install chromium`.

## Convenciones de arquitectura

- `pages` compone, `widgets` presenta conjuntos, `features` implementa casos de uso y `entities` expresa dominio.
- `shared` no importa capas superiores.
- El dominio no depende de React.
- Los componentes no contienen URLs USGS ni normalizan GeoJSON.
- Una entrada externa es `unknown` hasta que Zod la valida.
- Fechas internas en UTC; la zona horaria sólo afecta a presentación.
- Estado remoto en TanStack Query, filtros compartibles en URL, preferencias en Zustand y datos elegidos por el usuario en IndexedDB.
- Prefiera módulos públicos pequeños e imports directos a barrels globales.
- No introduzca `any`, assertions no justificadas ni booleanos que permitan estados contradictorios.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md) antes de mover responsabilidades entre capas. Una decisión transversal nueva debe incluir o actualizar un ADR.

## Trabajar con USGS

- Use el gateway existente y la configuración tipada de feeds.
- Mantenga `format=geojson`, `eventtype=earthquake` y `jsonerror=true` en consultas FDSN.
- Conserve el conteo previo y el bloqueo sobre 20 000 eventos.
- Propague `AbortSignal`; no cree ráfagas de solicitudes.
- Valide protocolo y hostname antes de seguir una URL `detail`.
- No agregue fallbacks a datos falsos en producción.

Los fixtures pertenecen a pruebas o historias visuales y deben indicar su origen ficticio. Una prueba en CI nunca depende de la disponibilidad de USGS.

## Pruebas orientadas al riesgo

Un cambio en una frontera necesita una prueba de contrato/schema; un algoritmo necesita casos límite; un flujo accesible necesita una prueba de integración o E2E. Cubra al menos:

- ausencias, `null`, cero y valores extremos;
- respuestas inválidas y errores recuperables;
- serialización/restauración de URL;
- navegación sólo con teclado cuando cambie la interacción;
- migraciones cuando cambie el formato persistente;
- cancelación y resultados obsoletos en operaciones asíncronas.

No rebaje reglas ni elimine una prueba para hacer verde CI. Corrija la causa o explique en el PR por qué cambia el contrato.

## Accesibilidad y contenido

- Use HTML semántico antes de ARIA.
- Mantenga foco visible, orden lógico y targets táctiles suficientes.
- Todo dato del mapa debe existir en texto; todo chart necesita resumen o tabla.
- No comunique riesgo o profundidad sólo mediante color.
- Conserve el aviso: la aplicación no alerta ni predice.
- No traduzca ni reinterprete nombres propios entregados por USGS.

## Commits y pull requests

Mantenga commits pequeños y con intención clara. En el PR incluya:

1. problema y alcance;
2. decisiones o trade-offs;
3. pruebas ejecutadas y resultado;
4. capturas reales para cambios visuales, en tema claro/oscuro y viewport móvil cuando corresponda;
5. impacto en accesibilidad, datos, persistencia y performance;
6. documentación o ADR actualizado.

No incluya `dist/`, reportes locales, credenciales ni bases IndexedDB exportadas con información del usuario.

## Cambios de persistencia

Incremente la versión del schema, implemente una migración incremental y pruebe tanto la ruta válida como un registro corrupto. La aplicación debe poder aislar datos inválidos y continuar. Documente cualquier pérdida inevitable antes de fusionar.

## Reportar vulnerabilidades o datos incorrectos

No publique secretos ni información personal en un issue. Para errores de datos, adjunte el ID de evento, la hora de consulta y el enlace oficial de USGS; no copie productos completos. Recuerde que SismoScope refleja una fuente que puede revisar o eliminar eventos.
