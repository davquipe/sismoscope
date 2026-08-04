# ADR 007: Usar tiles estándar de OpenStreetMap mediante un proveedor encapsulado

- Estado: Aceptada
- Fecha: 2026-08-03

## Contexto

Explorer y detalle necesitan un mapa base global sin API key. El proyecto es educativo/informativo, estático y no puede ocultar credenciales. OpenStreetMap ofrece tiles estándar con condiciones de uso y atribución obligatoria.

El mapa no debe crear descargas masivas, uso offline ni dependencia irreemplazable de literales dispersos.

## Decisión

Usar el endpoint estándar de tiles de OpenStreetMap a través de una configuración/proveedor único consumido por React Leaflet.

La implementación debe:

- mostrar siempre «© OpenStreetMap contributors» con enlace apropiado;
- mantener atribución visible a USGS para la capa de eventos;
- respetar caché y `Referer` normales del navegador;
- cargar sólo tiles correspondientes al viewport/zoom visible;
- no precargar regiones o niveles de zoom no solicitados;
- no descargar tiles para uso offline;
- no añadir proxy, scraper ni mecanismo para eludir límites;
- permitir cambiar de proveedor modificando el adaptador, no los widgets.

El mapa se carga bajo demanda y usa clustering. Una tabla/lista completa permanece disponible como alternativa accesible.

## Consecuencias

### Positivas

- Sin claves ni secretos.
- Cobertura mundial y ecosistema compatible con Leaflet.
- Configuración sustituible si cambian necesidades o política.
- Atribución y responsabilidad de uso quedan centralizadas.

### Costes y riesgos

- Dependencia de disponibilidad y política de un servicio comunitario.
- Sin garantía de SLA ni uso offline.
- El estilo visual no se controla como un tileset propio.
- Tráfico elevado podría requerir un proveedor adecuado y una nueva revisión de licencia/coste.
- Leaflet/mapa no constituye por sí solo una experiencia accesible.

## Alternativas consideradas

- **Proveedor comercial con token:** puede ofrecer SLA/estilos, pero introduce clave pública, términos y coste.
- **Alojar tiles propios:** requiere infraestructura, almacenamiento y operación fuera del alcance.
- **Descargar tiles:** vulnera el modelo de uso y aumenta almacenamiento; se rechaza explícitamente.
- **Mapa sin tiles:** reduce contexto geográfico y utilidad del explorer.

## Validación

La revisión manual previa a publicar debe comprobar atribución, temas, viewports, alternativa tabular y solicitudes limitadas al viewport. Los E2E actuales abortan tiles externos para mantenerse deterministas, por lo que no validan la política de red del proveedor. Un cambio de URL exige revisar términos y este ADR.
