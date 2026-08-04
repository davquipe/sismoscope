# ADR 001: Usar Vite como toolchain frontend

- Estado: Aceptada
- Fecha: 2026-08-03

## Contexto

SismoScope es una SPA React/TypeScript completamente estática. Debe ofrecer desarrollo rápido, TypeScript estricto, división de chunks, Web Workers, imports dinámicos y assets correctos bajo una ruta base configurable. No necesita renderizado de servidor, backend ni runtime Node en producción.

El repositorio requiere una configuración comprensible y una build reproducible en GitHub Actions. Mapa y ECharts deben quedar fuera del bundle inicial.

## Decisión

Usar Vite como servidor de desarrollo y bundler de producción, con el plugin oficial de React. TypeScript se comprueba mediante `tsc -b` antes de `vite build`; Vite no sustituye el typecheck.

La configuración:

- usa `/` en desarrollo;
- permite definir el base con `VITE_BASE_PATH` y conserva un valor local de respaldo;
- recibe en Pages la ruta efectiva calculada por `actions/configure-pages`;
- conserva alias `@/` coherente entre TypeScript y Vite;
- emite mapa, analytics y worker como recursos cargados bajo demanda;
- no incluye secretos ni variables privadas en `VITE_*`.

## Consecuencias

### Positivas

- Ciclo de desarrollo y build simples para una SPA.
- Soporte nativo de ESM, `import()` y workers.
- Assets con hash apropiados para el caché de Pages.
- Menos infraestructura que un framework con servidor no utilizado.

### Costes y riesgos

- Vite transpila, pero la corrección de tipos depende del paso separado `tsc -b`.
- El base debe configurarse correctamente o los assets fallarán en Pages.
- No hay SSR, rutas de servidor ni optimización de imágenes de un framework; no son requisitos del producto.
- Un upgrade mayor del toolchain exige validar plugins, tests y chunks.

## Alternativas consideradas

- **Create React App:** configuración y mantenimiento menos adecuados para una base nueva y división moderna de capacidades.
- **Next.js/Remix:** añaden convenciones y runtime de servidor que el hosting estático no necesita.
- **Webpack manual:** ofrece control, pero aumenta configuración y mantenimiento sin un caso de uso que lo justifique.

## Validación

`pnpm typecheck`, `pnpm build` y `pnpm preview` deben pasar. Una build con una `VITE_BASE_PATH` de prueba debe cargar assets y rutas hash desde esa subruta.
