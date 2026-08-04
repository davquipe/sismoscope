import { ExternalLink, Globe2, HeartPulse, LockKeyhole, Scale, Waves } from 'lucide-react';

import { getRepositoryUrl } from '@/shared/config/public';

export default function AboutPage() {
  const repositoryUrl = getRepositoryUrl();
  const methodologyUrl = repositoryUrl
    ? `${repositoryUrl.replace(/\/$/, '')}/blob/main/docs/methodology.md`
    : null;
  return (
    <div className="page about-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">TRANSPARENCIA</p>
          <h1>Sobre SismoScope</h1>
          <p>
            Un observatorio abierto para consultar y comprender datos sísmicos, con límites expresos
            y una metodología verificable.
          </p>
        </div>
      </header>
      <section className="about-lead">
        <Waves size={36} aria-hidden="true" />
        <div>
          <h2>Información para explorar, no una alarma.</h2>
          <p>
            SismoScope organiza registros públicos del U.S. Geological Survey. No predice
            terremotos, no estima por sí solo consecuencias y no reemplaza a las autoridades,
            servicios de emergencia ni fuentes gubernamentales peruanas.
          </p>
        </div>
      </section>
      <div className="about-grid">
        <section>
          <Globe2 aria-hidden="true" />
          <h2>Fuente de datos</h2>
          <p>
            Feeds GeoJSON y servicio FDSN Event Web Service de USGS, consultados directamente desde
            el navegador y validados antes de ser mostrados.
          </p>
          <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">
            Abrir USGS Earthquake Program <ExternalLink size={13} aria-hidden="true" />
          </a>
        </section>
        <section>
          <Scale aria-hidden="true" />
          <h2>Metodología</h2>
          <p>
            Calculamos estadísticas descriptivas, intervalos de magnitud/profundidad y distancias
            Haversine. Una cercanía espacial o temporal no prueba relación causal.
          </p>
          {methodologyUrl ? (
            <a href={methodologyUrl} target="_blank" rel="noopener noreferrer">
              Consultar metodología en el repositorio <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : (
            <p>La metodología completa está documentada junto al código fuente.</p>
          )}
        </section>
        <section>
          <LockKeyhole aria-hidden="true" />
          <h2>Privacidad</h2>
          <p>
            No usamos trackers ni servicios analíticos. Preferencias, favoritos y búsquedas
            guardadas permanecen en este dispositivo y pueden borrarse desde Preferencias.
          </p>
        </section>
        <section>
          <HeartPulse aria-hidden="true" />
          <h2>Uso responsable</h2>
          <p>
            Para alertas y recomendaciones de seguridad, consulta a las autoridades competentes. La
            magnitud por sí sola no determina daños concretos.
          </p>
        </section>
      </div>
      <section className="about-glossary">
        <div>
          <p className="eyebrow">GLOSARIO BREVE</p>
          <h2>Conceptos usados</h2>
        </div>
        <dl>
          <div>
            <dt>Magnitud</dt>
            <dd>
              Medida instrumental del tamaño del evento. El tipo (Mw, mb, ml, entre otros) depende
              del método disponible.
            </dd>
          </div>
          <div>
            <dt>Profundidad</dt>
            <dd>
              Distancia estimada desde la superficie hasta el hipocentro, expresada en kilómetros.
            </dd>
          </div>
          <div>
            <dt>Significancia</dt>
            <dd>
              Índice de USGS que combina magnitud, percepción y otros factores; no equivale a una
              evaluación de daños.
            </dd>
          </div>
          <div>
            <dt>PAGER</dt>
            <dd>
              Producto de USGS que puede incluir niveles de alerta. Su ausencia no significa
              ausencia de riesgo.
            </dd>
          </div>
          <div>
            <dt>Revisado</dt>
            <dd>Registro examinado por un analista frente a una solución automática inicial.</dd>
          </div>
        </dl>
      </section>
      <section className="about-attribution">
        <h2>Licencias y atribuciones</h2>
        <p>
          Aplicación publicada bajo licencia MIT. Datos sísmicos: U.S. Geological Survey. Mapas: ©
          OpenStreetMap contributors. El uso de nombres o enlaces no implica respaldo institucional.
        </p>
        <p className="mono">SismoScope · versión 0.1.0</p>
        {repositoryUrl ? (
          <p>
            <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
              Ver código fuente <ExternalLink size={12} aria-hidden="true" />
            </a>
          </p>
        ) : (
          <p>El enlace al código fuente se deriva al publicar en GitHub Pages.</p>
        )}
      </section>
    </div>
  );
}
