import {
  Activity,
  BarChart3,
  Bookmark,
  ChevronsLeft,
  CircleHelp,
  GitCompareArrows,
  Globe2,
  Map,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  end?: boolean;
}

const primaryNavigation: NavItem[] = [
  { to: '/', label: 'Panorama', icon: Activity, end: true },
  { to: '/explorer', label: 'Explorador', icon: Map },
  { to: '/analytics', label: 'Analítica', icon: BarChart3 },
  { to: '/compare', label: 'Comparar', icon: GitCompareArrows },
  { to: '/saved', label: 'Guardados', icon: Bookmark },
];

const secondaryNavigation: NavItem[] = [
  { to: '/settings', label: 'Preferencias', icon: Settings },
  { to: '/about', label: 'Acerca de', icon: CircleHelp },
];

function NavItems({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  return items.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      {...(end === undefined ? {} : { end })}
      className={({ isActive }) => `shell-nav__link${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  ));
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return (
    <div className="app-frame">
      <button
        className="skip-link"
        type="button"
        aria-controls="main-content"
        onClick={() => document.getElementById('main-content')?.focus()}
      >
        Saltar al contenido principal
      </button>
      <header className="mobile-header">
        <a href="#/" className="brand brand--mobile" aria-label="SismoScope, inicio">
          <span className="brand__signal" aria-hidden="true">
            <Activity size={22} />
          </span>
          <span>SismoScope</span>
        </a>
        <button
          className="icon-button"
          type="button"
          aria-label={mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <aside className={`sidebar${mobileOpen ? ' is-open' : ''}`} aria-label="Navegación principal">
        <div className="sidebar__brand-row">
          <NavLink to="/" className="brand" aria-label="SismoScope, inicio">
            <span className="brand__signal" aria-hidden="true">
              <Activity size={23} />
            </span>
            <span>
              <strong>SismoScope</strong>
              <small>OBSERVATORIO SÍSMICO</small>
            </span>
          </NavLink>
          <ChevronsLeft className="sidebar__decor" size={16} aria-hidden="true" />
        </div>

        <div
          className={`live-status${isOnline ? '' : ' live-status--offline'}`}
          aria-label={isOnline ? 'Conexión disponible; fuente USGS configurada' : 'Sin conexión'}
        >
          <span className="live-status__dot" aria-hidden="true" />
          <span>
            <strong>{isOnline ? 'Conexión disponible' : 'Sin conexión'}</strong>
            <small>
              {isOnline ? 'Fuente: USGS Earthquake Program' : 'Se conservará la interfaz local'}
            </small>
          </span>
        </div>

        <nav className="shell-nav" aria-label="Secciones">
          <span className="shell-nav__label">OBSERVAR</span>
          <NavItems items={primaryNavigation} onNavigate={() => setMobileOpen(false)} />
          <span className="shell-nav__label shell-nav__label--spaced">SISTEMA</span>
          <NavItems items={secondaryNavigation} onNavigate={() => setMobileOpen(false)} />
        </nav>

        <div className="sidebar__footer">
          <Globe2 size={17} aria-hidden="true" />
          <span>
            <strong>Fuente pública USGS</strong>
            <small>No es una alerta oficial</small>
          </span>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="app-content">
        <div className="notice-strip" role="note">
          <span aria-hidden="true">ⓘ</span>
          Datos informativos de USGS. SismoScope no predice terremotos ni sustituye alertas
          oficiales.
        </div>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Datos: U.S. Geological Survey</span>
          <span>Mapas: © OpenStreetMap contributors</span>
          <span>Actualización sujeta a disponibilidad de la fuente</span>
        </footer>
      </div>
    </div>
  );
}
