# ADR 006: Ejecutar analítica pesada en Web Worker

- Estado: Aceptada
- Fecha: 2026-08-03

## Contexto

Histogramas, percentiles, ordenación y agregaciones sobre miles de eventos pueden crear tareas largas en el hilo principal. Ese hilo también atiende filtros, teclado, mapa y feedback de cancelación. La UI debe seguir respondiendo en dispositivos medios.

Los cálculos son puros y no necesitan DOM ni React.

## Decisión

Ejecutar la analítica de datasets completos en un Web Worker cargado junto a la ruta analytics. El protocolo usa mensajes serializables y discriminados:

- ID único/monotónico de tarea;
- dataset mínimo de números, fechas y categorías;
- solicitud de agregaciones;
- respuesta de éxito o error con el mismo ID.

Cuando cambia el dataset, el consumidor cancela el trabajo si el protocolo lo permite o marca la tarea como obsoleta. Una respuesta cuyo ID no sea activo se ignora.

Las funciones estadísticas viven en módulos puros independientes del wrapper del worker y se prueban directamente. ECharts recibe resultados agregados, no calcula dominio.

## Consecuencias

### Positivas

- Interacciones y anuncios permanecen responsivos durante cálculos.
- Un trabajo obsoleto no bloquea render ni sobrescribe el resultado actual.
- Algoritmos pueden probarse sin entorno de worker.
- La frontera obliga a mantener datasets serializables y pequeños.

### Costes y riesgos

- Structured clone tiene coste de tiempo y memoria.
- Mensajes, errores y cancelación requieren un protocolo adicional.
- Debugging cruza dos contextos.
- Datasets pequeños pueden costar más en transferencia que en cálculo; el umbral puede decidir ejecución directa si una medición lo justifica.
- Workers no resuelven por sí solos algoritmos ineficientes.

## Alternativas consideradas

- **Calcular siempre en render/hilo principal:** simple, pero arriesga tareas largas y foco poco responsivo.
- **Partir con `setTimeout`/idle callbacks:** comparte CPU con UI y hace más complejo garantizar finalización.
- **Servicio backend:** contradice el despliegue estático y enviaría consultas/datos fuera del navegador.
- **Que ECharts agregue:** acopla metodología a visualización y dificulta alternativas textuales/tests.

## Validación

Las pruebas unitarias verifican estadísticas y límites sin depender del worker. El E2E de analítica ejercita el worker al generar y exportar un resultado en Chromium. Respuestas fuera de orden, errores del adaptador, cancelación y perfiles con datasets grandes requieren pruebas o mediciones adicionales.
