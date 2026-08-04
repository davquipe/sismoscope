export function RouteLoading() {
  return (
    <main className="route-loading" aria-live="polite" aria-busy="true">
      <span className="route-loading__pulse" aria-hidden="true" />
      <span>Cargando módulo…</span>
    </main>
  );
}
