# Despliegue en GitHub Pages

## Modelo de hosting

SismoScope genera archivos estáticos en `dist/`. No necesita servidor, funciones, secretos ni variables privadas. La fuente de datos se consulta desde el navegador a endpoints públicos de USGS.

La URL pública de este repositorio es:

**[https://davquipe.github.io/sismoscope/](https://davquipe.github.io/sismoscope/)**

La URL sólo estará activa después de habilitar Pages con **GitHub Actions** como fuente y completar un deployment. Para forks, repositorios con otro nombre o dominios personalizados, GitHub determina la URL efectiva durante el despliegue.

## Base path

Vite necesita anteponer a los assets la ruta en la que Pages servirá el sitio. El workflow obtiene esa ruta de `actions/configure-pages` y la entrega a la build mediante `VITE_BASE_PATH`; no codifica el nombre del repositorio. Esto cubre repositorios de proyecto, sitios en la raíz y dominios configurados.

Para una build local se puede indicar cualquier subruta explícita, por ejemplo:

```bash
VITE_BASE_PATH=/proyecto/ pnpm build
```

El valor debe empezar y terminar con `/`. En desarrollo se usa `/` para que `pnpm dev` funcione en raíz. `VITE_REPOSITORY_URL` es igualmente pública; Actions la deriva de `github.repository` para construir el enlace al código fuente.

## Enrutamiento

La aplicación usa `HashRouter`. El servidor sólo recibe la ruta del documento estático; lo que sigue a `#` se resuelve en el navegador:

```text
BASE_URL/#/
BASE_URL/#/explorer
BASE_URL/#/events/EVENT_ID
BASE_URL/#/analytics
BASE_URL/#/saved
BASE_URL/#/settings
BASE_URL/#/about
```

Por ello no hace falta un fallback 404 personalizado y una recarga profunda no pide una ruta inexistente a Pages.

## Habilitar Pages

Una persona con permisos de administración debe:

1. abrir el repositorio en GitHub;
2. entrar en **Settings**;
3. abrir **Pages**;
4. en **Build and deployment**, elegir **GitHub Actions** como source;
5. confirmar que Actions está habilitado para el repositorio;
6. hacer push o fusionar un cambio en `main`.

No seleccione «Deploy from a branch»: `dist/` no se versiona y el workflow oficial publica el artifact.

## Workflow

`.github/workflows/quality.yml` contiene la validación y el despliegue en un único workflow. En pull requests se ejecuta sólo calidad; el job de Pages depende de esa validación y se ejecuta al publicar en `main` o al lanzar `workflow_dispatch` sobre esa rama.

La secuencia es:

1. checkout;
2. pnpm según `packageManager` y Node LTS;
3. caché de pnpm;
4. instalación con lockfile congelado;
5. typecheck, lint, formato, pruebas unitarias e integración;
6. build e instalación de Chromium para los E2E;
7. E2E con servicios externos interceptados;
8. configuración de Pages mediante `actions/configure-pages` en el job de despliegue;
9. build candidata con el `base_path` de Pages y la URL del repositorio;
10. upload de `dist/` y deploy al environment `github-pages`.

Permisos mínimos:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

El job de calidad sólo necesita lectura. El job de deploy usa el environment `github-pages`, cuya URL queda expuesta por la acción oficial. `concurrency` cancela una ejecución anterior de la misma referencia para evitar publicaciones superpuestas.

## Validación local

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
VITE_BASE_PATH=/proyecto/ pnpm build
pnpm preview
```

En preview compruebe:

- que el documento y assets no devuelvan 404;
- que `/#/explorer` y un detalle recarguen correctamente;
- que las URLs compartibles restauren filtros;
- que no existan requests a `localhost` ni fixtures;
- que USGS y OpenStreetMap tengan atribución visible;
- que una falla de USGS muestre recuperación, no una pantalla vacía.

`pnpm preview` sirve la build local; lo importante es comprobar que el documento referencia assets bajo la ruta configurada. Para emular una subruta exacta puede usar un servidor estático que monte `dist` en el mismo prefijo usado para la build.

## Forks, nombres distintos y dominio propio

No hace falta editar el workflow al renombrar o bifurcar el repositorio: `actions/configure-pages` informa el `base_path` efectivo y el contexto `github.repository` identifica el código fuente. Un dominio propio o un sitio servido en la raíz recibe la base que Pages configure.

No codifique una cuenta de GitHub en el frontend. `HashRouter`, `import.meta.env.BASE_URL` y las variables de build deben conservar rutas y enlaces portables.

## Environments y protección

GitHub crea o utiliza `github-pages`. Se pueden añadir aprobaciones o reglas de rama desde Settings sin modificar la app. El deployment usa OIDC de Pages; no se crea un personal access token.

## Rollback

La forma reproducible de revertir es:

1. revertir en Git el cambio defectuoso mediante un commit nuevo;
2. dejar que el workflow reconstruya desde el lockfile;
3. comprobar el deployment nuevo en el environment.

No se edita manualmente el artifact ni se hace commit de `dist/`. GitHub conserva historial de deployments para diagnóstico, pero el código fuente sigue siendo la fuente de verdad.

## Solución de problemas

### Assets 404

Compruebe la salida `base_path` de `actions/configure-pages`, el valor de `VITE_BASE_PATH` usado por la build y las referencias emitidas en `dist/index.html`.

### Ruta interna 404

Confirme que el enlace incluye `/#/` después de la base y que se usa `HashRouter`. Una ruta como `BASE_URL/explorer` intenta resolución del servidor y no corresponde al contrato.

### Página blanca después de un deploy

Abra consola/red, compruebe carga de chunks y el límite de error. Un error de USGS no debería impedir cargar el shell; un 404 de chunk suele indicar base incorrecto o caché entre deployments.

### Workflow sin permiso

Verifique que Pages usa GitHub Actions, que el workflow conserva `pages: write` e `id-token: write` y que las políticas de Actions permiten acciones oficiales.

### pnpm falla con lockfile

El lockfile y `package.json` deben cambiar juntos. Reproduzca con la misma versión `packageManager`; no sustituya `--frozen-lockfile` por una instalación permisiva en CI.

### USGS u OSM no responden

Pages puede estar correcto aunque un proveedor externo falle. Revise la pestaña Network, políticas del proveedor y CORS. La app debe conservar mensaje recuperable y alternativa textual; no cambie silenciosamente a fixtures.

## Seguridad operativa

- No se guardan secretos en Actions ni en `VITE_*`.
- Dependencias se instalan desde lockfile.
- Acciones de GitHub usan majors oficiales mantenidos.
- El artifact contiene sólo `dist/`.
- Source maps de producción siguen la configuración del build y no deben exponer información privada; el proyecto no contiene secretos que proteger mediante minificación.
