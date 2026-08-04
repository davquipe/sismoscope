import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

interface State {
  errorId: string | null;
}

export class GlobalErrorBoundary extends Component<PropsWithChildren, State> {
  public override state: State = { errorId: null };

  public static getDerivedStateFromError(): State {
    return { errorId: `SS-${crypto.randomUUID().slice(0, 8).toUpperCase()}` };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[SismoScope:render]', { error, componentStack: info.componentStack });
    }
  }

  public override render(): ReactNode {
    if (this.state.errorId) {
      return (
        <main className="fatal-error">
          <div className="fatal-error__mark" aria-hidden="true">
            ≋
          </div>
          <p className="eyebrow">Interrupción inesperada</p>
          <h1>No pudimos mostrar SismoScope</h1>
          <p>
            Tus datos locales permanecen en este dispositivo. Recarga la aplicación para intentarlo
            de nuevo.
          </p>
          <button className="button button--primary" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
          <code>Referencia {this.state.errorId}</code>
        </main>
      );
    }

    return this.props.children;
  }
}
