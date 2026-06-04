# FactIA — Documento Funcional por Vistas

> Documento operativo del módulo de **Facturación Electrónica** del Automation Hub de Finagro.
> Describe cada pantalla del portal, qué información presenta, cómo se usa, qué endpoints alimenta y los casos típicos paso a paso.

| Campo | Valor |
|---|---|
| Módulo | Facturación Electrónica (FactIA) |
| Portal | `https://automation-hub-finagro.ngrok.io/facturacion` |
| Frontend | `automation-hub-finagro/frontend/src/pages/FacturacionPage.js`, `FacturacionSqlPage.js` |
| Backend | `automation-hub-finagro/backend/modules/facturacion/` |
| Servicio externo | FactIA (Flask) — descarga, clasifica y extrae metadata de XMLs DIAN |
| Servicio externo | Mercurio (portal contable, scraping con Playwright) |
| Autenticación | Basic Auth con credenciales del Django Admin |
| Versión doc | 1.0 — 2026-05-21 |

> **Documentos relacionados** (en este mismo directorio):
> - `factia-documento-funcional.md` — visión funcional global (alcance, actores, reglas de negocio).
> - `factia-documento-tecnico.md` — arquitectura y detalles de implementación.
> - `facturacion-dashboard.md` — descripción anterior del dashboard (parcial / desactualizada).

---

## Índice

1. [Vista `/facturacion` — Resumen](#1-vista-facturacion--resumen) ← incluido en esta entrega
2. [Vista `/facturacion/pipeline` — Pipeline](#2-vista-facturacionpipeline--pipeline) *(pendiente)*
3. [Vista `/facturacion/sql` — SQL Console](#3-vista-facturacionsql--sql-console) *(pendiente)*
4. [Acción: Sincronizar Mercurio](#4-accion-sincronizar-mercurio) *(pendiente)*
5. [Acción: Ver PDFs Mercurio](#5-accion-ver-pdfs-mercurio) *(pendiente)*
6. [Acción: Descarga masiva PDFs Mercurio](#6-accion-descarga-masiva-pdfs-mercurio) *(pendiente)*
7. [Vista `/facturacion/facturas` — Facturas extraídas](#7-vista-facturacionfacturas--facturas-extraidas) *(pendiente)*

---

## Convenciones comunes a todas las vistas

### Banner y sub-navegación

Todas las vistas comparten el **banner** "Facturación Electrónica · DIAN" y una **sub-navegación** con cuatro pestañas:

| Pestaña | Ruta | Función |
|---|---|---|
| 📊 Resumen | `/facturacion` | Vista por defecto. Tareas programadas, cobertura de descarga y valor por mes. |
| ⚙️ Pipeline | `/facturacion/pipeline` | Ejecución manual del pipeline (descargar correo + clasificar) y panel Mercurio. |
| 🧾 Facturas | `/facturacion/facturas` | Listado tabular con filtros y KPIs sobre las facturas en BD. |
| 🛢 SQL Console | `/facturacion/sql` | Consulta SQL ad-hoc contra la BD. |

La sub-navegación se renderiza con `react-router-dom` (`NavLink`) — la pestaña activa se resalta en verde corporativo `#00853f`. El subRoute se determina en `FacturacionPage.js:536-540`.

### Autenticación

- Todas las llamadas al backend requieren `Authorization: Basic <base64(user:pass)>`.
- Las credenciales se obtienen del Django Admin del Automation Hub.
- Si el backend responde `401`, el frontend ejecuta `onLogout()` y vuelve al login (ver `FacturacionPage.js:784`).

### Base URL

Las llamadas usan la constante `API`, que apunta al backend del Automation Hub. Todas las rutas que aparecen en este documento van prefijadas con `/api/facturacion/`.

---

## 1. Vista `/facturacion` — Resumen

### 1.1 Propósito

La vista de **Resumen** es el dashboard de **monitoreo operacional** del módulo. No ejecuta acciones; solo muestra el estado de la automatización para que el analista pueda confirmar en pocos segundos:

- Si las **tres ejecuciones automáticas del día** (06:00, 11:00, 16:00) corrieron exitosamente.
- Cuánto se ha **descargado por mes** desde el buzón `facturacion@finagro.com.co`.
- Cuál es el **valor facturado** acumulado mes a mes.
- La trazabilidad fin-a-fin: ZIPs descargados → facturas extraídas por FactIA → facturas guardadas en BD del Hub.

Es la vista por defecto al entrar al módulo.

### 1.2 Layout

La pantalla se compone, de arriba hacia abajo, de cuatro bloques:

```
┌─────────────────────────────────────────────────────────┐
│  Banner: "Facturación Electrónica · DIAN"   [Cerrar sesión] │
├─────────────────────────────────────────────────────────┤
│  Sub-nav: [Resumen] [Pipeline] [Facturas] [SQL]         │
├─────────────────────────────────────────────────────────┤
│  Valor facturado por mes (tarjetas horizontales)        │
├─────────────────────────────────────────────────────────┤
│  Tareas programadas (3 tarjetas: 6 AM / 11 AM / 4 PM)   │
├─────────────────────────────────────────────────────────┤
│  Cobertura de descarga (tabla por mes + totales)        │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Bloque "Valor facturado por mes"

**Qué muestra.** Una fila horizontal scrolleable, con una tarjeta por cada mes (`YYYY-MM`) presente en los registros de la BD. Cada tarjeta tiene:

| Elemento | Detalle |
|---|---|
| Etiqueta | Mes en formato largo (ej.: "Enero 2026"). Las facturas sin `fecha_emision` se agrupan bajo "Sin fecha". |
| Valor | Suma de `valor_factura` para el mes, expresada en millones (`$245M`). |
| Barra | Proporción visual respecto al mes con mayor valor (el mayor = 100%). |
| Conteo | Cantidad de facturas del mes (`23 facturas`). |
| Orden | Cronológico ascendente. |

**Cómo se calcula.** En frontend, a partir de la lista completa de facturas (`facturasEnRango`), agrupando por `fecha_emision.slice(0,7)` — ver `FacturacionPage.js:927-939`.

**Origen del dato.** `GET /api/facturacion/facturas/`.

**Nota.** Este bloque también aparece dentro de `/facturacion/facturas`, pero ahí responde al rango de fechas filtrado. En la vista de Resumen no hay filtros: muestra todo el histórico.

### 1.4 Bloque "Tareas programadas"

**Qué muestra.** Tres tarjetas, una por cada ejecución automática diaria del cron de FactIA.

| Slot | Hora Colombia | Ventana de correos que procesa | Significado |
|---|---|---|---|
| 🌅 06:00 | 6:00 AM | 4:00 PM del día anterior → 6:00 AM de hoy | Procesa la noche anterior. |
| ☀️ 11:00 | 11:00 AM | 6:00 AM → 11:00 AM de hoy | Procesa media mañana. |
| 🌆 16:00 | 4:00 PM | 11:00 AM → 4:00 PM de hoy | Cierre de tarde. |

**Cada tarjeta muestra:**

| Campo | Significado |
|---|---|
| Badge de estado | `✓ OK` (verde) si la última corrida fue exitosa, `✗ ERROR` (rojo) si falló, `Pendiente` (gris) si no hay registro para el slot del día |
| Última ejecución | Fecha y hora (`DD/MM/YYYY HH:mm`) de la última corrida del slot |
| Correos encontrados | `mensajes_procesados` — cuántos mensajes del buzón fueron leídos en la ventana |
| Facturas guardadas | `facturas_guardadas` — cuántos registros nuevos quedaron persistidos en BD en esa corrida (solo aparece si el campo viene del log) |
| Pie | Recordatorio del rango horario que cubre el slot |

**Cómo se calcula.** El estado se obtiene buscando, en el log, la entrada cuyo `hora_slot` coincide con el slot — ver `FacturacionPage.js:1262-1322`. Solo se considera el último registro por slot.

**Origen del dato.** `GET /api/facturacion/cron-log/` → proxy al servicio FactIA (`GET /api/cron-log/` interno). Devuelve `{ runs: [{ hora_slot, timestamp, status, mensajes_procesados, facturas_guardadas }] }`.

**Lectura operacional:**
- Si los tres slots están en verde, la operación del día está al día.
- Si un slot está en `Pendiente` y ya pasó su hora, el cron no se disparó — revisar el servicio FactIA.
- Si está en rojo, revisar logs del servicio (no se exponen desde esta vista; ir a `factia-documento-tecnico.md`).

### 1.5 Bloque "Cobertura de descarga"

**Qué muestra.** Tabla que cuantifica, mes a mes, cuántos ZIPs (= cuántos correos con adjunto) ha descargado FactIA desde el buzón.

| Columna | Significado |
|---|---|
| Mes | Mes y año (`Enero 2026`). |
| ZIPs descargados | Cantidad de archivos ZIP descargados ese mes. |
| Correos c/ ZIP | Cantidad de correos que contenían al menos un ZIP adjunto. Puede ser ≤ ZIPs si un correo trae varios ZIPs. |
| Cobertura | Barra proporcional al mes con más ZIPs (el mayor = 100%). |

**Fila de totales y trazabilidad:**

```
[Total ZIPs] [Total correos] [Rango: primera fecha → última fecha]

[X ZIPs descargados]  →  [Y facturas extraídas por FactIA]  →  [Z guardadas en BD]
```

Esta línea es **el indicador clave del módulo**: idealmente `X ≈ Y ≈ Z`. Diferencias significan:

| Discrepancia | Diagnóstico |
|---|---|
| `Y < X` | FactIA no logró extraer XML válido de algunos ZIPs (notas crédito, sin XML, formato atípico). Esperado en cierto porcentaje. |
| `Z < Y` | La sincronización al backend del Hub no terminó de persistir todo. Revisar últimas ejecuciones del cron. |
| `Z > Y` | Hay registros antiguos en BD del Hub que ya no están en FactIA (ej. limpieza del volumen del servicio). No es error. |

**Indicadores adicionales:**
- Píldora verde "Última descarga: DD/MM/YYYY" — muestra `stats.fecha_max`.
- Botón ↺ — re-consulta `stats` sin recargar la página.

**Origen del dato.** `GET /api/facturacion/stats/` → proxy a FactIA (`GET /api/stats/`). Devuelve:

```jsonc
{
  "total_mensajes": 0,
  "total_zips": 0,
  "total_con_zip": 0,
  "total_facturas_extraidas": 0,
  "fecha_min": "2026-01-01",
  "fecha_max": "2026-05-20",
  "por_mes": [
    { "mes": "2026-01", "zips": 123, "correos": 110 }
  ]
}
```

### 1.6 Endpoints consumidos

| Endpoint | Método | Para qué | Definido en |
|---|---|---|---|
| `/api/facturacion/facturas/` | GET | Total de facturas y lista completa (alimenta el bloque "Valor por mes" y el conteo "guardadas en BD") | `backend/modules/facturacion/views.py: ListarFacturasView` |
| `/api/facturacion/stats/` | GET | Estadísticas de descarga por mes (alimenta "Cobertura de descarga") | `backend/modules/facturacion/views.py: StatsDescargaView` |
| `/api/facturacion/cron-log/` | GET | Últimas ejecuciones del cron (alimenta "Tareas programadas") | `backend/modules/facturacion/views.py: CronLogView` |
| `/api/facturacion/semanas/` | GET | Lista de semanas con conteo (no usada en Resumen pero precargada en el `useEffect`) | `backend/modules/facturacion/views.py: ListarSemanasView` |

Las cuatro se disparan en paralelo al montar la vista (`FacturacionPage.js:792`).

### 1.7 Manual paso a paso

**Caso 1 — Revisión rutinaria a primera hora del día.**
1. Entrar al portal `https://automation-hub-finagro.ngrok.io/facturacion`.
2. Iniciar sesión con credenciales del Django Admin.
3. Verificar las tres tarjetas de **Tareas programadas**:
   - 06:00 debe estar en `✓ OK` con la fecha de hoy. Si está `Pendiente` con hora > 06:30, hay un problema en el cron.
   - 11:00 y 16:00 todavía estarán `Pendiente` si es antes de esa hora.
4. Confirmar en **Cobertura de descarga**:
   - La píldora "Última descarga" muestra la fecha de hoy (o el último día hábil).
   - El total no decreció respecto al día anterior.
5. Si todo está verde, la operación del día está bajo control.

**Caso 2 — Validar que una factura del mes anterior llegó a la BD.**
1. En el bloque "Valor facturado por mes", localizar el mes objetivo. La tarjeta muestra el total y el conteo.
2. Para detalle, ir a `/facturacion/facturas` y aplicar el filtro de fechas (cubierto en la sección 7).

**Caso 3 — Investigar un slot del cron en rojo.**
1. Identificar el slot fallido en **Tareas programadas** (`✗ ERROR`).
2. Anotar fecha/hora de "Última ejecución".
3. Pulsar ↺ en **Cobertura de descarga** para confirmar si igualmente hubo descarga parcial.
4. Escalar al equipo de operación del servicio FactIA con esos datos.

**Caso 4 — Detectar un "agujero" en la cobertura.**
1. Mirar la tabla mes a mes. Si un mes muestra `0` ZIPs cuando debería tener tráfico, hubo un fallo prolongado del cron en esa ventana.
2. Cotejar con `cron-log` ampliado vía SQL Console (sección 3): `SELECT * FROM ...` (a documentar).

### 1.8 Errores y diagnóstico

| Síntoma | Causa probable | Acción |
|---|---|---|
| Banner se renderiza vacío (`—`) | Las llamadas a `/facturacion/facturas/` y `/stats/` no respondieron | Reintentar con el botón ↺. Si persiste, verificar conectividad con el backend. |
| "Cargando estadísticas..." indefinido | El backend no logró comunicarse con FactIA (timeout 10s) | Verificar el contenedor `factia` o variable `FACTIA_URL`. |
| Cron-log vacío (`Sin ejecuciones registradas` en los tres slots) | `cron_log.json` del volumen FactIA fue borrado o el cron nunca corrió | Esperar a la próxima corrida; si no aparece, revisar el cron del servicio. |
| `401` al entrar | Credenciales inválidas o sesión expirada | Volver a login. |

---

## 2. Vista `/facturacion/pipeline` — Pipeline

### 2.1 Propósito

La vista de **Pipeline** es el **panel de control manual** del módulo. A diferencia de la vista de Resumen (que solo muestra estado), aquí el analista **ejecuta** los pasos del flujo de procesamiento bajo demanda:

- Disparar manualmente la **descarga de correos** con un rango de fechas específico.
- Disparar manualmente la **clasificación y extracción de metadata** sobre los ZIPs ya descargados.
- Acceder a las **acciones de Mercurio** (sincronizar, ver PDFs, descarga masiva).
- Descargar el **instalador Windows** (`SincronizarFacturas.exe`) que el usuario final usa para sincronizar PDFs en su equipo local.

Es la vista que se usa cuando:
- Hay que reprocesar un rango histórico fuera del cron.
- Falló una corrida automática y se quiere reintentar.
- Se necesita rellenar un "agujero" detectado en la cobertura de la vista de Resumen.

### 2.2 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Banner + Sub-nav                                       │
├─────────────────────────────────────────────────────────┤
│  Section header: "Pipeline de procesamiento"            │
│  Acciones (botonera derecha):                           │
│   [🛢 SQL Console] [⬇ SincronizarFacturas.exe]          │
│   [🌐 Sincronizar Mercurio] [📂 Ver PDFs Mercurio]      │
│   [📥 Descarga Masiva PDFs → <carpeta>] [📁]            │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐     │
│  │ 01 Descargar del     │  │ 02 Clasificar y      │     │
│  │    correo            │  │    extraer metadata  │     │
│  │  - Rango (opcional)  │  │  - Campos extraídos  │     │
│  │  [📥 Descargar]      │  │  [⚙️ Procesar]       │     │
│  └──────────────────────┘  └──────────────────────┘     │
├─────────────────────────────────────────────────────────┤
│  Panel "PDFs de Mercurio" (solo si se cargó la lista)   │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Botonera superior

Cinco acciones disponibles desde el encabezado:

| Botón | Acción | Endpoint |
|---|---|---|
| 🛢 **SQL Console** | Navega a `/facturacion/sql` (consulta SQL sobre la BD del Hub) | — |
| ⬇ **Descargar SincronizarFacturas.exe** | Descarga el instalador Windows para usuarios finales | `GET /api/facturacion/descargar-instalador/` |
| 🌐 **Sincronizar Mercurio** | Lanza el job robótico de descarga desde Mercurio. Detallado en sección 4. | `POST /api/facturacion/sincronizar-mercurio/stream/` (SSE) |
| 📂 **Ver PDFs Mercurio** | Carga el listado de PDFs disponibles en el servidor. Detallado en sección 5. | `GET /api/facturacion/mercurio-pdfs/` |
| 📥 **Descarga Masiva PDFs** | Descarga todos los PDFs de Mercurio a una carpeta local. Detallado en sección 6. | `GET /api/facturacion/mercurio-pdfs/` + `/<nombre>/` por archivo |
| 📁 (sub-botón) | Cambia la carpeta de destino guardada para "Descarga Masiva" | — (solo cliente) |

**Sobre el instalador.** Cuando se pulsa "Descargar SincronizarFacturas.exe":
1. El endpoint intenta servir el `.exe` directamente desde FactIA (`FACTIA_URL/api/descargar-exe/`).
2. Si no hay `.exe` compilado (no se corrió `build.sh`), sirve como fallback `InstaladorFacturas.bat` — un script que descarga el `.ps1` (SincronizarFacturas.ps1) y lo ejecuta.
3. El `.ps1` lleva inyectadas las credenciales del usuario técnico (vars de entorno `PS1_AUTH_USER` / `PS1_AUTH_PASS`) y la URL del Hub. Si esas variables no están configuradas en el servidor, `descargar-script/` devuelve 503.
4. Este endpoint **no requiere autenticación** (a diferencia del resto), porque el `.bat` lo descarga sin sesión activa.

> El instalador y el script PowerShell son para el **consumo final por parte de usuarios contables** que necesitan los PDFs localmente. No los usa el analista para operar el pipeline.

### 2.4 Tarjeta "01 — Descargar del correo"

**Qué hace.** Lanza la descarga de correos con adjuntos ZIP desde el buzón `facturacion@finagro.com.co` vía Microsoft Graph (OAuth2 client credentials).

**Entradas (opcionales):**

| Campo | Detalle |
|---|---|
| Desde | Fecha mínima del correo a leer (input `date`). Si se omite, FactIA usa su `START_DATE` configurado. |
| Hasta | Fecha máxima. Si se omite, hasta "ahora". |

Si ambos campos están vacíos, descarga el rango completo desde la fecha de inicio configurada en FactIA — lo cual puede ser largo. **Recomendación:** definir siempre un rango acotado para operaciones manuales.

**Comportamiento:**
- Los correos ya descargados (identificados por `message_id` en `procesados.json`) **se omiten**. No se re-descarga.
- Threads paralelos con timeout de 90 s.
- Reintentos automáticos con backoff exponencial frente a errores transitorios de Graph (3 intentos).

**Flujo técnico:**
1. Frontend dispara `POST /api/facturacion/descargar/stream/` con body `{fecha_desde, fecha_hasta}` opcionales (formato `YYYY-MM-DDTHH:mm:ssZ`).
2. Backend hace **proxy SSE** al servicio FactIA (`FACTIA_URL/api/descargar/stream/`) y reenvía cada línea como evento `text/event-stream`.
3. Frontend consume el stream con `consumeSSE(...)`, alimentando el modal `LogModal`:
   - Cada línea → `onLog` → append al modal.
   - Evento `result` → `onResult` → marca `isDone=true`, registra `mensajes_procesados`, refresca `stats`.
   - Error → `onError` → estado `error` en el modal.

**Salida.** Los ZIPs quedan en el volumen de FactIA bajo `historico_2026/{año}/{mes}/{semana}/`. **Nada se persiste todavía en la BD del Hub** — eso lo hace el paso 2.

### 2.5 Tarjeta "02 — Clasificar y extraer metadata"

**Qué hace.** Sobre los ZIPs ya presentes en el volumen de FactIA, ejecuta:
1. **Clasificación** del contenido XML — determina si es `Invoice`, `CreditNote`, `DebitNote`, `ApplicationResponse`, `AttachedDocument`, `SinXML` o `Unknown`. Las Invoices van a `curado_2026/facturas/`; los demás a `rechazados_2026/<tipo>/`.
2. **Extracción de metadata** del XML UBL 2.0:
   - NIT del proveedor, número de factura, código, valor, IVA, fecha de emisión, fecha de vencimiento, observaciones.
3. **Persistencia** en la BD del Hub: tabla `facturacion_facturaelectronica` con clave única `(tipo_documento, proveedor_nit, numero_factura)`. Usa `update_or_create`, de modo que reprocesar es seguro.

**Entradas.** Ninguna. Procesa todo lo pendiente.

**Flujo técnico:**
1. Frontend `POST /api/facturacion/procesar/stream/` (sin body).
2. Backend crea un `Execution` (estado `running`) en BD, y abre proxy SSE a `FACTIA_URL/api/procesar/stream/`.
3. Cuando llega el evento `result` con el JSON de facturas, el backend **persiste en BD del Hub** antes de reenviar al frontend:
   - Por cada factura, `update_or_create` sobre la clave única.
   - Errores de persistencia se registran como `ExecutionLog` pero no detienen la corrida.
4. Frontend muestra logs en tiempo real, y al terminar refresca la tabla de facturas (`cargarFacturas()`).

**Salida.** Resumen del evento `result`:
```json
{
  "total": 42,
  "errores": 0,
  "clasificacion": { "Invoice": 38, "CreditNote": 3, "SinXML": 1 }
}
```

### 2.6 Modal de progreso (LogModal)

Tanto Paso 1 como Paso 2 abren el mismo modal:

| Elemento | Detalle |
|---|---|
| Título | Nombre del paso (`Descargar del correo`, `Clasificar y extraer metadata`) |
| Subtítulo | Detalle técnico (`facturacion@finagro.com.co · Microsoft Graph`) |
| Cuerpo | Stream de logs línea a línea (font monospace) |
| Botón ⛔ Abortar | Visible mientras `isDone=false`. Solo en Paso 1 (la descarga es la operación larga; el procesado es rápido). |
| Badge final | `✓ OK`, `✗ ERROR` o `Abortado` cuando termina |
| Botón Cerrar | Disponible al terminar |

**Abortar.** El botón ⛔ Abortar dispara `POST /api/facturacion/abortar/`, que reenvía la señal a `FACTIA_URL/api/abort/`. FactIA detiene el job en el siguiente punto seguro y **guarda el progreso parcial** (los ZIPs ya descargados quedan persistidos; la siguiente corrida no los re-descargará). El modal cambia a estado `Abortado`.

### 2.7 Panel "PDFs descargados de Mercurio"

Aparece **solo cuando el usuario pulsa "📂 Ver PDFs Mercurio"** o tras una sincronización exitosa. Detallado en la sección 5; aquí solo se reseña el layout:

- Cabecera verde con conteo de PDFs y, si corresponde, el resumen del último `Sincronizar Mercurio` (`✅ Nuevos: N · ⏭ Ya existían: N · ❌ Errores: N`).
- Tabla scrolleable: `Radicado | Tamaño | [⬇ PDF]` (botón de descarga individual).
- Botón ✕ para cerrar el panel sin perder los datos.

### 2.8 Endpoints consumidos

| Endpoint | Método | Para qué | View |
|---|---|---|---|
| `/api/facturacion/descargar/stream/` | POST | Stream SSE del Paso 1 | `DescargarStreamView` |
| `/api/facturacion/procesar/stream/` | POST | Stream SSE del Paso 2 (incluye persistencia en BD del Hub) | `ProcesarStreamView` |
| `/api/facturacion/abortar/` | POST | Detener el job activo | `AbortarView` |
| `/api/facturacion/descargar-instalador/` | GET (sin auth) | `.exe` Windows o fallback `.bat` | `DescargarInstaladorView` |
| `/api/facturacion/descargar-script/` | GET | `SincronizarFacturas.ps1` con credenciales inyectadas | `DescargarScriptView` |
| `/api/facturacion/sincronizar-mercurio/stream/` | POST | Stream SSE del job Mercurio (sección 4) | `SincronizarMercurioView` |
| `/api/facturacion/mercurio-pdfs/` | GET | Listado de PDFs en servidor (secciones 5/6) | `MercurioPDFsListView` |
| `/api/facturacion/mercurio-pdfs/<nombre>/` | GET | Descarga individual de un PDF | `DescargarMercurioPDFView` |

> Las llamadas no-SSE usan `Authorization: Basic ...`. Las SSE también, pero el header se mantiene durante todo el stream.

### 2.9 Manual paso a paso

**Caso 1 — Descargar y procesar el día de ayer manualmente.**
1. En `/facturacion`, verificar en "Cobertura de descarga" que ayer no tiene ZIPs (justifica la corrida manual).
2. Ir a `/facturacion/pipeline`.
3. En la tarjeta **01**, ingresar `Desde = ayer` y `Hasta = ayer`.
4. Pulsar **📥 Descargar del correo**. Esperar al `✓ OK` en el modal. Anotar `mensajes_procesados` final.
5. Cerrar el modal y pulsar **⚙️ Clasificar y extraer metadata** en la tarjeta **02**.
6. Al terminar, verificar el `total` y `clasificacion` en el log final.
7. Ir a `/facturacion/facturas` y aplicar filtro por la fecha de ayer para confirmar que los registros llegaron.

**Caso 2 — Reprocesar un rango histórico amplio (ej. todo el mes pasado).**
1. **Antes de empezar**: confirmar con el equipo que no hay otro job corriendo (la descarga es exclusiva).
2. En tarjeta **01**, ingresar `Desde = 2026-04-01` y `Hasta = 2026-04-30`.
3. Pulsar **📥 Descargar del correo**. Este job puede tardar varios minutos (timeout backend: 700 s).
4. Vigilar el log: si aparecen errores 429 (rate limit de Graph), FactIA reintenta con backoff.
5. Si el job se cuelga o tarda más de lo esperado, pulsar **⛔ Abortar**. El progreso parcial queda guardado.
6. Pulsar **⚙️ Procesar** para clasificar lo descargado.

**Caso 3 — Solo reprocesar (sin descarga).**
- Útil cuando se sospecha que la lógica de clasificación cambió o hay ZIPs pendientes sin procesar.
- Pulsar directamente **⚙️ Clasificar y extraer metadata**. Procesa todo lo que esté en `historico_2026/` y aún no haya pasado a `curado_2026/` o `rechazados_2026/`.

**Caso 4 — Entregar el script al usuario final.**
1. Pulsar **⬇ Descargar SincronizarFacturas.exe**.
2. Si el `.exe` existe, se descarga directamente.
3. Si descarga `InstaladorFacturas.bat`, instruir al usuario a ejecutarlo (instala/ejecuta el `.ps1` automáticamente).
4. Confirmar que el servidor tiene `PS1_AUTH_USER` y `PS1_AUTH_PASS` configurados antes de entregar el `.bat` — sin esas vars, `descargar-script/` devuelve 503 y el `.bat` falla.

### 2.10 Errores y diagnóstico

| Síntoma | Causa probable | Acción |
|---|---|---|
| Log queda en blanco y no avanza | Backend no pudo conectar a FactIA | Confirmar que el contenedor `factia` está arriba y `FACTIA_URL` apunta correcto |
| Modal muestra `502 BAD GATEWAY` | FactIA responde error o timeout | Revisar logs del servicio FactIA |
| Paso 1 termina con `mensajes_procesados: 0` | No hay correos nuevos en el rango, o todos están en `procesados.json` | Esperado si el rango ya fue cubierto previamente |
| Paso 2 termina con `errores > 0` | Algún XML mal formado o duplicado con clave única conflictiva | Revisar `ExecutionLog` en el admin de Django para ver el detalle |
| ⛔ Abortar no detiene inmediatamente | FactIA solo aborta en puntos seguros (entre mensajes / entre archivos) | Esperar 5-10 s; si no responde, reiniciar el contenedor FactIA |
| Botón "Descargar SincronizarFacturas.exe" devuelve `.bat` | El `.exe` no fue compilado (`build.sh` no se corrió) | Coordinar con el equipo de despliegue para compilar; el `.bat` funciona como fallback |
| Modal se cierra solo al recargar | El SSE se cortó por el navegador (timeout o pérdida de conexión) | El job en FactIA sigue corriendo. Esperar y verificar resultado en `/facturacion/stats/` |

---

## 3. Vista `/facturacion/sql` — SQL Console

### 3.1 Propósito

La **SQL Console** es la ventana de **autoservicio de datos** del módulo. Permite:

- **Validar los KPIs** del dashboard frente a la BD real (¿el `Total facturas` que muestra la UI coincide con `SELECT COUNT(*)` por SQL?).
- **Investigar incidencias** sin pedir acceso al servidor (duplicados, facturas sin fecha, últimas corridas que fallaron, logs).
- **Exportar a CSV** datos puntuales que no caben en la UI ni en el listado de facturas.

A diferencia de las demás vistas, la SQL Console:
- Vive en un **componente propio** (`FacturacionSqlPage`), no es un subRoute de `FacturacionPage`.
- Tiene **login propio** (la sesión se persiste en `localStorage` bajo la clave `facturacion_auth`).
- **No comparte el banner ni la sub-navegación** verdes del resto del módulo — tiene su propio encabezado con botón "← Volver a Facturación".

> Importante: la consola es **solo lectura** y está acotada a tablas del módulo. No es una shell SQL general — no se pueden hacer `JOIN` con `auth_user`, ni leer cualquier tabla de la BD, ni escribir.

### 3.2 Layout

```
┌─────────────────────────────────────────────────────────┐
│  [← Volver]  SQL Console · Facturación  [Cerrar sesión] │
├─────────────────────────────────────────────────────────┤
│  Banner amarillo: "Solo lectura" + restricciones        │
├─────────────────────────────────────────────────────────┤
│  Diagrama ER (mermaid, tablas + relaciones)             │
├─────────────────────────────────────────────────────────┤
│  Consultas listas (grid de 9 tarjetas, 360px mínimo)    │
├─────────────────────────────────────────────────────────┤
│  Modo avanzado (textarea SQL libre) — colapsable        │
├─────────────────────────────────────────────────────────┤
│  Resultado: tabla + métricas + botón ↓ CSV              │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Banner de restricciones

Banner amarillo permanente con cuatro reglas de oro de la consola:

| Restricción | Detalle |
|---|---|
| Solo lectura | La transacción se abre con `SET TRANSACTION READ ONLY` |
| Timeout | `SET LOCAL statement_timeout = '10s'` — toda consulta que tarde más es abortada por PostgreSQL |
| Solo `SELECT` | Whitelist de queries: solo `SELECT ...` o `WITH ... SELECT ...` |
| LIMIT automático | Si la consulta no trae `LIMIT N` al final, el backend agrega `LIMIT 500` |

### 3.4 Diagrama ER (esquema)

Diagrama Mermaid (renderizado en el cliente) con las tablas relacionadas con facturación:

```
AUTOMATION ─┬─< EXECUTION ─┬─< FACTURA
            │              │
            │              └─< LOG
            │
USER ───────┴─< EXECUTION
```

| Tabla DB | Modelo Django | Función |
|---|---|---|
| `facturacion_facturaelectronica` | `FacturaElectronica` | Datos extraídos de cada factura DIAN |
| `execution_execution` | `Execution` | Una corrida del pipeline (descarga o procesar) |
| `automation_automation` | `Automation` | Definición del proceso automatizado (módulo + nombre) |
| `logs_executionlog` | `ExecutionLog` | Cada línea de log producida por una corrida |
| `auth_user` | (Django auth) | **Aparece en el ER como referencia, pero está bloqueada para queries libres** |

La fuente del diagrama (Mermaid) se introspecta en el frontend desde `SCHEMA_MERMAID` (`FacturacionSqlPage.js:143-186`), y el backend ofrece también `GET /api/facturacion/sql/schema/` con la lista de tablas + columnas + FKs introspectadas dinámicamente desde los modelos Django.

### 3.5 Catálogo de consultas listas

Nueve consultas predefinidas, en formato tarjeta. Cada una tiene: nombre, descripción, SQL preview, parámetros opcionales y botón **▶ Ejecutar**.

| # | Nombre | Para qué | Parámetros |
|---|---|---|---|
| 1 | Validar Total facturas en rango | Equivale al KPI "Total facturas" de la vista `/facturacion/facturas` | `desde`, `hasta` |
| 2 | Validar Valor total facturado | Equivale al KPI "Valor total". Devuelve también promedio | `desde`, `hasta` |
| 3 | Top 10 proveedores por valor | Ranking de NITs por total facturado a Finagro | — |
| 4 | Facturas sin fecha de emisión | Lista las primeras 50 con `fecha_emision IS NULL`. Equivale a la tarjeta `⚠️ Sin fecha emisión` | — |
| 5 | Facturas y valor por mes | Agrupado `TO_CHAR(fecha_emision, 'YYYY-MM')`. Equivale al bloque "Valor por mes" | — |
| 6 | Distribución por tipo de documento | `Invoice`, `CreditNote`, `DebitNote`, etc. | — |
| 7 | Duplicados (mismo NIT + número) | Detecta duplicaciones que la unique constraint normalmente impide | — |
| 8 | Últimas corridas del pipeline | Joinea `Execution` + `Automation` + cuenta facturas creadas. Útil para auditoría | — |
| 9 | Últimos logs del pipeline | Joinea `ExecutionLog` + `Execution`. Los 50 más recientes | — |

**Cómo se usa una tarjeta:**
1. Ajustar parámetros (si los hay) en los inputs.
2. La SQL preview se actualiza en vivo conforme se cambian los parámetros.
3. Pulsar **▶ Ejecutar** — se dispara `POST /api/facturacion/sql/run/` con el SQL renderizado.

> Los parámetros se interpolan **en el frontend** dentro del template de la SQL (no son prepared statements). Eso es seguro porque las queries del catálogo son fijas, pero significa que el catálogo no acepta inputs arbitrarios — los `tipo: 'date'` de los inputs garantizan el formato.

### 3.6 Modo avanzado (SQL libre)

Tarjeta colapsable. Al activarla, aparece:

- Textarea grande con SQL editable (font monospace).
- Botones **▶ Ejecutar** y **Limpiar**.
- Una consulta de ejemplo pre-cargada (top 10 NITs).

Las restricciones del banner amarillo aplican igual. El validador backend (`_validar_query` en `sql_views.py:42-65`) rechaza cualquier consulta que:
- No empiece con `SELECT` o `WITH ... SELECT`.
- Contenga palabras clave de escritura: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `GRANT`, `REVOKE`, `CREATE`, `COMMENT`, `COPY`, `VACUUM`, `ANALYZE`, `REINDEX`, `CLUSTER`, `DO`, `NOTIFY`, `LISTEN`, `PREPARE`, `EXECUTE`, `DEALLOCATE`, `LOCK`, `SET ROLE`, `RESET`.
- Toque una tabla cuyo nombre **no** comience con `facturacion_`, `execution_`, `automation_` o `logs_`.
- Toque explícitamente una tabla bloqueada: `auth_user`, `auth_user_groups`, `auth_user_user_permissions`, `auth_group`, `auth_group_permissions`, `auth_permission`, `django_admin_log`, `django_session`, `django_migrations`, `django_content_type`.

Si la query no termina con `LIMIT N`, el backend agrega `LIMIT 500` antes de ejecutar.

### 3.7 Tabla de resultados

Aparece debajo cuando la query termina. Estructura:

| Elemento | Detalle |
|---|---|
| Cabecera | `<N> filas · <ms> ms`. Si `count >= 500`, badge naranja `(limitado a 500)` |
| Botón ↓ CSV | Exporta las filas tal como están a un archivo `query_<timestamp>.csv` |
| Tabla | Columnas tomadas de `cursor.description`. Headers sticky al hacer scroll vertical |
| `null` | Se renderiza literal en gris claro |
| `Decimal` | Se serializa como `float` (ver `_serializar` en `sql_views.py:68-77`) |
| `datetime` | Se serializa con `.isoformat()` |
| `bytes` | Se reemplazan por `<N bytes>` para no romper el JSON |

Si la query falla (`400`), aparece una tarjeta roja con el mensaje de error tal cual lo devolvió PostgreSQL.

### 3.8 Endpoints consumidos

| Endpoint | Método | Para qué | View |
|---|---|---|---|
| `/api/facturacion/sql/run/` | POST | Ejecutar la consulta. Body `{ "query": "SELECT ..." }` | `SqlRunView` |
| `/api/facturacion/sql/schema/` | GET | Esquema (tablas + columnas + FKs) — también se usa como **smoke test** en el login | `SqlSchemaView` |

**Respuesta de `sql/run/` (éxito 200):**
```json
{
  "columns": ["proveedor_nit", "facturas"],
  "rows":    [["900123456", 42], ["800987654", 31]],
  "took_ms": 23,
  "count":   2,
  "limited": false,
  "query":   "SELECT ... LIMIT 500"
}
```

**Respuesta de error (400):**
```json
{ "error": "La tabla \"auth_user\" está bloqueada por seguridad." }
```

### 3.9 Manual paso a paso

**Caso 1 — Validar un KPI de la UI contra la BD.**
1. Abrir `/facturacion/facturas`, anotar el valor del KPI "Total facturas" para un rango (ej. enero de 2026: `120`).
2. Abrir `/facturacion/sql`. Localizar la tarjeta **"Validar Total facturas en rango"**.
3. Ajustar `Desde = 2026-01-01`, `Hasta = 2026-01-31`. Pulsar **▶ Ejecutar**.
4. Comparar el `total_facturas` del resultado con el `120` de la UI.
   - Si coinciden, el KPI está correcto.
   - Si difieren, revisar si la UI estaba filtrando facturas sin fecha (las excluye del rango) o si hay un cache stale (recargar `/facturacion/facturas` y reintentar).

**Caso 2 — Detectar duplicados.**
1. Pulsar **▶ Ejecutar** en la tarjeta **"Duplicados (mismo NIT + número)"**.
2. Si la tabla devuelve filas, hay registros que rompieron la constraint única `(tipo_documento, proveedor_nit, numero_factura)`. Esto solo puede pasar si se borró/alteró la constraint o si se insertó manualmente. Reportar al equipo de datos.

**Caso 3 — Auditar las últimas corridas del pipeline.**
1. **"Últimas corridas del pipeline"** → muestra 10 ejecuciones con su `status` y conteo de facturas creadas.
2. Para una corrida sospechosa (`status='failed'`), copiar su `id`.
3. Activar **Modo avanzado** y ejecutar:
   ```sql
   SELECT created_at, level, message
   FROM logs_executionlog
   WHERE execution_id = <id>
   ORDER BY created_at;
   ```
4. Exportar a CSV si se necesita compartir el detalle.

**Caso 4 — Investigar un proveedor concreto.**
1. Activar **Modo avanzado**.
2. Ejecutar:
   ```sql
   SELECT fecha_emision, numero_factura, valor_factura, iva_facturado_proveedor, archivo
   FROM facturacion_facturaelectronica
   WHERE proveedor_nit = '900123456'
   ORDER BY fecha_emision DESC;
   ```
3. Descargar el CSV si se necesita para conciliación contable.

### 3.10 Errores y diagnóstico

| Síntoma | Causa | Acción |
|---|---|---|
| `Solo se permiten consultas SELECT (o WITH ... SELECT).` | La query empieza con otra cosa (`EXPLAIN`, `SHOW`, comentario, etc.) | Empezar con `SELECT` o `WITH cte AS (SELECT...) SELECT...` |
| `La tabla "X" no está permitida...` | La tabla no tiene prefijo `facturacion_`/`execution_`/`automation_`/`logs_` | Reescribir la query usando solo tablas autorizadas |
| `La tabla "auth_user" está bloqueada por seguridad.` | Bloqueo explícito | No es posible joinear con usuarios desde la consola. Para auditoría con usuario, pedir export a TI |
| `Error en la consulta: canceling statement due to statement timeout` | La query tardó más de 10 s | Optimizar (limitar rango, agregar `WHERE`, usar índices); el límite es no negociable desde la UI |
| `Error en la consulta: relation "X" does not exist` | Nombre de tabla mal escrito (case-sensitive en PostgreSQL si se usaron comillas) | Verificar nombre. Las tablas reales se ven en el diagrama ER |
| Login falla aunque las credenciales son válidas en `/facturacion` | El usuario no tiene permisos suficientes (el smoke test usa `/sql/schema/`) | El backend requiere `IsAuthenticated`; si el 401 persiste, verificar el grupo del usuario en Django Admin |
| Resultados llegan con `(limitado a 500)` | La query no traía `LIMIT` y devolvió ≥ 500 filas | Agregar `LIMIT N` explícito o refinar el `WHERE` |

---

## 4. Acción: Sincronizar Mercurio

### 4.1 Propósito

**Mercurio** es el portal contable interno de Finagro (`mercurio.finagro.com.co`) que recibe documentos en una bandeja de trabajo organizada por **rutas/pasos**. Cada radicado pasa por etapas; en el **Paso 1** quedan los radicados pendientes de procesamiento — habitualmente correos con facturas (`.eml`, `.msg`, PDFs) que llegaron a través del flujo contable y aún no han sido bajados.

Mercurio **no expone una API** para esos documentos. La única forma de obtenerlos es navegar la web, seleccionar cada radicado y descargar manualmente — un trabajo repetitivo y propenso a saltarse documentos.

**Sincronizar Mercurio** automatiza ese trabajo: un robot Playwright (headless) entra a Mercurio con credenciales de servicio, filtra todos los radicados en **Paso 1**, descarga sus adjuntos, identifica los PDFs que parecen factura/nota y los deja disponibles en el servidor para que el analista los consulte (ver sección 5) o los baje en masa a su equipo (sección 6).

> Este job no toca la BD del Hub ni la tabla `facturacion_facturaelectronica`. Los PDFs viven en una carpeta temporal del servidor (`/tmp/mercurio/descargas/pdfs`). Es **independiente del pipeline de correo DIAN** descrito en la sección 2 — Mercurio es una fuente **complementaria** que entrega documentos físicos/escaneados que no llegan por el buzón DIAN.

### 4.2 Cómo se dispara

Hay **un solo punto de entrada**: el botón **🌐 Sincronizar Mercurio** en la botonera superior de `/facturacion/pipeline`. No hay cron automático: la sincronización es manual.

Mientras el job corre, el botón cambia a `🔄 Sincronizando Mercurio...` y queda deshabilitado, igual que los botones contiguos de Mercurio (Ver PDFs, Descarga Masiva). Otros botones del pipeline (Descargar correo, Procesar) **sí** siguen disponibles — son procesos distintos.

### 4.3 Flujo del job

El job se ejecuta en el servidor backend, lanzado por `SincronizarMercurioView` (`backend/modules/facturacion/views.py:896`). Diagrama de alto nivel:

```
[Botón Sincronizar Mercurio]
        │
        ▼ POST /api/facturacion/sincronizar-mercurio/stream/
[Backend Django]
        │  - Verifica MERCURIO_USER / MERCURIO_PASS (503 si faltan)
        │  - Verifica Playwright instalado (500 si falta)
        │  - Limpia /tmp/mercurio/descargas/pdfs/* y *.eml
        │
        ▼
[Playwright Chromium headless]
        │
        ├─ 1. page.goto(MERCURIO_URL) → llena user/pass → login
        ├─ 2. click "BANDEJAS → WorkFlow"
        ├─ 3. busca frame "BandejaRutas"
        ├─ 4. select "listapaso" → opción "Paso 1"
        │      ↳ si no hay radicados → fin "OK sin trabajo"
        ├─ 5. detecta total de páginas
        └─ 6. por cada página, por cada documento:
              ├─ selectDoc(idx) en el frame
              ├─ servlet TraerImagen?documento=...&tipoDocumento=...
              │     ├─ si responde PDF → guardar directo
              │     └─ si responde HTML → buscar link .pdf / .eml / .msg → descargar
              ├─ si vino .eml → email.message_from_binary_file → walk → adjuntos
              ├─ si vino .msg → extract_msg → adjuntos
              ├─ recolectar PDFs (también dentro de ZIPs anidados, hasta 5 niveles)
              ├─ analizar cada PDF (pymupdf):
              │     ├─ texto nativo → buscar patrones de factura/nota
              │     ├─ extraer "No. factura"
              │     └─ si texto pobre → OCR con tesseract español (fallback)
              ├─ deduplicar:
              │     ├─ por número de factura (gana el más grande)
              │     └─ por hash SHA1 si no hay número
              └─ guardar como {radicado}.pdf, {radicado}_2.pdf, ...
        │
        ▼
[Stream SSE de vuelta al frontend]
  data: 🔐 Iniciando login en Mercurio...
  data: ✅ Login OK
  data: 📂 Navegando a BANDEJAS → WorkFlow...
  data: 🔍 Aplicando filtro Paso=1...
  data: 📄 Páginas detectadas: 3
  data: ── Página 1 — 14 documentos ──
  data:   [1/14] ✅ 12345.pdf — 234,567 bytes
  data:   ...
  event: result
  data: { "status": "ok", "pdfs_nuevos": 38, ... }
```

### 4.4 Configuración requerida

| Variable | Para qué | Si falta |
|---|---|---|
| `MERCURIO_USER` | Usuario de servicio para login en Mercurio | `503` con mensaje `MERCURIO_USER / MERCURIO_PASS no configurados...` |
| `MERCURIO_PASS` | Clave del usuario de servicio | `503` |
| Playwright + Chromium | Driver del navegador headless | `500` con mensaje `Playwright no está instalado en el servidor.` |
| `pymupdf` (alias `fitz`) | Análisis del texto del PDF (¿es factura?) | Job corre, pero **ninguna detección de factura** funciona → todo cae a `fallback` |
| `pytesseract` + `PIL` | OCR (fallback para PDFs escaneados sin texto nativo) | Job corre, pero los PDFs sin texto nativo siempre caerán a `fallback` |
| `extract_msg` | Parseo de adjuntos `.msg` (Outlook nativo) | Job corre, pero los radicados con `.msg` no se podrán abrir |

> El stack mínimo viable es: `MERCURIO_USER`, `MERCURIO_PASS` y `playwright`. El resto degrada la calidad pero no rompe la corrida.

### 4.5 Detección y deduplicación de facturas

Un radicado puede traer **varios PDFs** (la factura, el certificado de retención, una propaganda, etc.). El job no quiere guardar todo — quiere guardar **la(s) factura(s)** asociadas al radicado. Para eso:

**Paso A — Identificar candidatos.** Por cada PDF se llama `_analizar_pdf_factura(bytes)`:

1. Abre el PDF con `pymupdf`, extrae texto nativo.
2. Normaliza (minúsculas, sin tildes, espacios colapsados).
3. Busca en el texto alguno de estos patrones:
   - `factura electronica de venta`
   - `factura de venta electronica`
   - `nota credito electronica`
   - `nota de credito electronica`
   - `nota debito electronica`
   - `nota de debito electronica`
4. Si encuentra, intenta extraer el **número de factura** con tres regex (busca `Factura No. XXX`, `No. XXX`, `N° XXX`).
5. Si el texto nativo es pobre (< 50 caracteres después de quitar espacios), corre **OCR con `tesseract`** sobre las dos primeras páginas (DPI 200, idioma español). Si el OCR encuentra patrones, marca el PDF como `via_ocr=true`.

**Paso B — Deduplicar.** Sobre los candidatos que matchearon:

1. **Por número de factura**: si varios PDFs comparten el mismo `No.`, se queda el **más pesado** (probable representación oficial). Los demás se descartan.
2. **Por hash SHA-1**: los PDFs que no tienen número se deduplican por hash byte-a-byte.

**Paso C — Fallback.** Si **ningún** PDF del radicado matcheó como factura/nota, el job guarda **el primer PDF** del lote con la marca `fallback=true`. Estos radicados se listan al final del log bajo `⚠️ Radicados sin "factura electrónica" detectada (revisar a mano)` — son los que el analista debe revisar manualmente.

**Paso D — Guardar.** El o los PDFs supervivientes se guardan como:
- `{radicado}.pdf` para el primero (o único).
- `{radicado}_2.pdf`, `{radicado}_3.pdf`, ... si el radicado legítimamente trae varias facturas.

### 4.6 Modal de progreso

Al disparar el job se abre el mismo `LogModal` que el pipeline (sección 2.6), pero **sin botón Abortar** — la sincronización de Mercurio no es interrumpible desde la UI.

| Campo | Valor |
|---|---|
| Título | `Sincronizar Mercurio` |
| Subtítulo | `Login → WorkFlow → Paso 1 → Descarga EMLs → Extracción PDFs` |
| Logs típicos | Ver bloque de ejemplo en 4.3 |
| Estado final | `✓ OK` si `errores == 0`, `✗ ERROR` si `errores > 0` |

Mientras corre, el frontend mantiene `mercurioLoading=true`, lo que deshabilita los botones de Mercurio. Al cerrarse el modal, el frontend dispara automáticamente `cargarListaPDFs()` para refrescar el panel "PDFs descargados de Mercurio" (sección 5).

### 4.7 Evento `result` y resumen final

Cuando el job termina sin excepción, emite un evento SSE `result` con este JSON:

```json
{
  "status":           "ok",
  "pdfs_nuevos":      38,
  "pdfs_skip":        0,
  "errores":          0,
  "total":            38,
  "pdf_dir":          "/tmp/mercurio/descargas/pdfs",
  "radicados_proc":   25,
  "facturas_ok":      35,
  "facturas_ocr":     2,
  "fallback_count":   3,
  "dup_internos":     4,
  "facturas_unicas":  ["FAC-12345", "NC-678", "..."],
  "duplicados":       [{ "radicados": ["7890", "7891"] }],
  "fallback_ids":     ["8001", "8003", "8007"]
}
```

| Campo | Significado |
|---|---|
| `pdfs_nuevos` | PDFs efectivamente guardados en esta corrida |
| `pdfs_skip` | (Reservado) cantidad de PDFs que ya existían — en la implementación actual siempre 0, porque la carpeta se limpia al inicio |
| `errores` | Radicados que fallaron en alguna etapa (TraerImagen 4xx/5xx, EML corrupto, etc.) |
| `total` | `pdfs_nuevos + pdfs_skip` |
| `radicados_proc` | Cuántos radicados se procesaron en total (cada uno puede dejar 0..N PDFs) |
| `facturas_ok` | Radicados donde se detectó factura sin OCR |
| `facturas_ocr` | Radicados donde la detección requirió OCR (PDF escaneado) |
| `fallback_count` | Radicados donde no se detectó factura y se guardó un PDF arbitrario |
| `dup_internos` | PDFs descartados dentro del mismo radicado (mismo `No.` o mismo hash) |
| `facturas_unicas` | Lista ordenada de números de factura distintos encontrados |
| `duplicados` | Grupos de radicados con el mismo correo/EML adjunto (el mismo correo llegó a >1 bandeja). Útil para auditoría |
| `fallback_ids` | IDs de radicado que requieren revisión manual |

En el modal, el último log antes del `result` es un resumen humano:

```
═══ Resumen ═══
📦 Radicados procesados:     25
📄 PDFs guardados:           38
🧾 Facturas únicas (por No.): 32
   ✅ Con factura detectada:  35
   🔍 Detectada vía OCR:       2
   ⚠️ Sin factura (fallback):  3
   🗑️ Duplicados internos del ZIP descartados: 4
```

### 4.8 Endpoint consumido

| Endpoint | Método | View | Auth | Timeout efectivo |
|---|---|---|---|---|
| `/api/facturacion/sincronizar-mercurio/stream/` | POST | `SincronizarMercurioView` | `IsAuthenticated` (Basic) | Largo — no hay cap del lado Django; el job termina cuando termina la página final. Algunas operaciones internas usan timeouts de Playwright (30 s para `goto`, 30–60 s para descargas) |

> El header `Authorization` se mantiene durante todo el stream SSE.

### 4.9 Manual paso a paso

**Caso 1 — Corrida rutinaria de inicio del día.**
1. Verificar con el equipo contable que Mercurio tiene radicados en Paso 1 esperando descarga (si la bandeja está vacía, no tiene sentido correr).
2. Entrar a `/facturacion/pipeline`.
3. Pulsar **🌐 Sincronizar Mercurio**.
4. Esperar el `✓ OK` final (el job puede tardar varios minutos según volumen — cada radicado implica navegación + descarga + análisis).
5. Al cerrarse el modal, el panel "PDFs descargados de Mercurio" se actualiza solo con los PDFs nuevos. Verificar `pdfs_nuevos`.
6. Si `fallback_count > 0`, ver la lista `⚠️ Radicados sin "factura electrónica" detectada` y abrirlos a mano en Mercurio para confirmar si efectivamente eran facturas o documentos auxiliares.

**Caso 2 — Validar que la corrida se completó correctamente.**
1. Al terminar, en el resumen del log: `✅ Con factura detectada >> Sin factura (fallback)` es lo esperable.
2. Si `errores > 0`, revisar las líneas con `❌` en el log para identificar qué radicados fallaron.
3. Cuando hay `duplicados` (mismo EML en varios radicados), no es necesariamente un problema — Mercurio a veces enruta el mismo correo a varias bandejas. Solo es informativo.

**Caso 3 — El job no encuentra radicados.**
1. El log mostrará: `ℹ️ No hay radicados en Paso=1 (Mercurio oculta el filtro cuando está vacío). Finalizando sin errores.`
2. Esto es **éxito**: significa que no hay trabajo pendiente. El `result` viene con `pdfs_nuevos: 0` y `errores: 0`.

**Caso 4 — Re-procesar tras un fallo parcial.**
1. La carpeta `/tmp/mercurio/descargas/pdfs/` **se limpia al inicio de cada corrida** — no hay "modo incremental". Cada corrida es full.
2. Por tanto, simplemente volver a pulsar **🌐 Sincronizar Mercurio** reintenta todo lo que esté en Paso 1 ese momento. Lo ya descargado previamente se pierde si no se bajó al equipo del analista.
3. **Recomendación operativa**: ejecutar Descarga Masiva PDFs (sección 6) **inmediatamente después** de cada sincronización para no perder los PDFs en la próxima corrida.

### 4.10 Errores y diagnóstico

| Síntoma | Causa probable | Acción |
|---|---|---|
| `503 — MERCURIO_USER / MERCURIO_PASS no configurados` | Variables de entorno ausentes en el servidor Django | Configurar en `docker-compose.yml` / `.env` del Hub y reiniciar |
| `500 — Playwright no está instalado en el servidor` | Falta el paquete o los binarios de Chromium | `pip install playwright && playwright install chromium` en el contenedor |
| Login fallido. Verifica credenciales. | El usuario de servicio cambió de clave o fue bloqueado | Pedir al equipo Mercurio que reactive/resetee el usuario |
| `Login en Mercurio no respondió a tiempo` | Mercurio lento o caído | Reintentar en unos minutos. Si persiste, abrir Mercurio manualmente para confirmar disponibilidad |
| `No se encontró el frame BandejaRutas.` | El portal cambió su estructura (frames/HTML) | Avisar al equipo de desarrollo del Hub — el selector necesita ajuste en `views.py:1407` |
| Muchos radicados con `fallback` | Falta `pymupdf` o el OCR (`pytesseract`) en el servidor | Instalar dependencias del módulo o ignorar si los radicados son documentos no-factura |
| `dup_internos` muy alto consistentemente | Los proveedores adjuntan varias copias del mismo PDF en el correo | Informativo, no es error — la deduplicación está cumpliendo su función |
| `errores > 0` en cada corrida | El servlet `TraerImagen` está rechazando peticiones (sesión inválida, rate-limit) | Revisar logs del backend; verificar que la sesión no caduque entre páginas |
| Tras la sincronización, el panel de PDFs sigue vacío | La carpeta `/tmp/mercurio/descargas/pdfs/` no existe o sin permisos | Verificar permisos del proceso Django sobre `/tmp/mercurio/` |
| Modal se cierra sin `result` | Conexión SSE se cortó (red, navegador, ngrok) | El job sigue corriendo en el servidor. Esperar y pulsar **📂 Ver PDFs Mercurio** para verificar resultado |

---

## 5. Acción: Ver PDFs Mercurio

### 5.1 Propósito

Mientras **Sincronizar Mercurio** (sección 4) es la acción que **deposita** PDFs en el servidor, **Ver PDFs Mercurio** es la acción que permite **inspeccionar y descargar uno a uno** lo que quedó disponible — sin tener que correr de nuevo la sincronización.

Casos en que se usa:
- Después de una sincronización exitosa, para revisar qué PDFs quedaron y bajar solo los que el analista necesita.
- Para verificar **antes** de pulsar Descarga Masiva si vale la pena bajar todo el lote.
- Para descargar un PDF puntual que un usuario solicitó por nombre de radicado.
- Para confirmar que la sincronización dejó archivos (auditoría rápida sin volver a correr el job).

> No descarga PDFs nuevos de Mercurio. Solo lista y sirve lo que ya está en `/tmp/mercurio/descargas/pdfs/` del servidor — el resultado de la última `Sincronizar Mercurio`.

### 5.2 Cómo se dispara

Botón **📂 Ver PDFs Mercurio** en la botonera superior de `/facturacion/pipeline`. Comportamiento:

- Pulsar el botón → `GET /api/facturacion/mercurio-pdfs/` → carga el panel "PDFs descargados de Mercurio" debajo de las tarjetas del pipeline.
- Pulsar **otra vez** → re-consulta y refresca el panel (no abre uno nuevo).
- Pulsar **✕** en la cabecera del panel → lo cierra (no borra los PDFs del servidor; solo oculta el panel en el cliente).
- Si está corriendo `Sincronizar Mercurio` (`mercurioLoading=true`), el botón queda deshabilitado.

El panel también aparece **automáticamente** al terminar una sincronización exitosa: el frontend dispara `cargarListaPDFs()` desde el callback `onResult` (ver `FacturacionPage.js:714`).

### 5.3 Layout del panel

El panel se renderiza en `FacturacionPage.js:1554-1620`, justo debajo de las tarjetas de paso 1 y paso 2:

```
┌──────────────────────────────────────────────────────────────┐
│ 📂  PDFs descargados de Mercurio — 38 archivos          [✕]  │
│     ✅ Nuevos: 38  ⏭ Ya existían: 0  ❌ Errores: 0           │ ← solo si vino de Sincronizar
├──────────────────────────────────────────────────────────────┤
│  Radicado          │       Tamaño │  Descargar               │
├────────────────────┼──────────────┼──────────────────────────┤
│  12345             │      234 KB  │  [⬇ PDF]                 │
│  12346             │      189 KB  │  [⬇ PDF]                 │
│  12347_2           │      412 KB  │  [⬇ PDF]                 │ ← segunda factura del mismo radicado
│  ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

Características del panel:
- **Cabecera verde** (`#e8f5e9`) con icono 📂, contador de archivos y botón cerrar.
- **Resumen de sincronización** (línea de chips) — visible solo si el panel se abrió tras un `Sincronizar Mercurio` exitoso. Si se abrió manualmente, esa línea no aparece.
- **Tabla scrolleable** con `maxHeight: 320px` y filas alternadas (cebra).
- Si la carpeta del servidor está vacía → mensaje centrado: `No hay PDFs disponibles aún.`

### 5.4 Cabecera del panel — tres modos

| Cuándo aparece | Contenido de la cabecera |
|---|---|
| Panel abierto manualmente (`📂 Ver PDFs Mercurio`) | Solo título y contador: `PDFs descargados de Mercurio — N archivos` |
| Panel abierto tras `Sincronizar Mercurio` con éxito | Título + contador + línea de chips: `✅ Nuevos: N`, `⏭ Ya existían: N`, `❌ Errores: N` |
| Carpeta vacía | Cabecera con `0 archivos`, cuerpo con el mensaje `No hay PDFs disponibles aún.` |

Los chips del resumen vienen del estado `mercurioResult` (capturado en el evento `result` SSE de la sincronización). Si se cierra el panel y se vuelve a abrir manualmente, el resumen no aparece (porque el estado de `mercurioResult` se borra al cerrar).

### 5.5 Tabla de PDFs

| Columna | Origen del dato | Detalle |
|---|---|---|
| **Radicado** | `pdf.nombre.replace('.pdf', '')` | Nombre del PDF sin extensión. Para radicados con varias facturas: `12345`, `12345_2`, `12345_3`, ... |
| **Tamaño** | `(pdf.size / 1024).toFixed(0) + ' KB'` | Tamaño del archivo en KB. Sin separador de miles |
| **Descargar** | — | Botón `[⬇ PDF]` con acción `descargarPDF(nombre)` |

**Ordenamiento.** Lo determina el backend (`MercurioPDFsListView`): `sorted(os.listdir(self.PDF_DIR))` — alfabético ascendente sobre el nombre del archivo. Como los radicados son numéricos, el orden suele coincidir con el orden de creación, pero **no es lexicográficamente numérico**: el `radicado 9` aparecerá después del `radicado 100`.

**Sin paginación.** Si hay cientos de PDFs, todos vienen en una sola respuesta y la tabla scrollea con `maxHeight: 320px`. No hay búsqueda ni filtrado por radicado — eso se hace manualmente vía scroll o usando la SQL Console si los radicados llegaron a estar en BD (no es el caso de Mercurio, que no toca BD).

### 5.6 Descarga individual

Al pulsar **[⬇ PDF]** en una fila, el frontend (`FacturacionPage.js:598-605`):

1. Llama `GET /api/facturacion/mercurio-pdfs/<nombre>/` con el header de autenticación.
2. Recibe el blob (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename=<nombre>`).
3. Crea un `<a>` temporal con `href = URL.createObjectURL(blob)` y `download = nombre`, simula click y libera la URL.

El navegador descarga el PDF a la carpeta de descargas estándar del usuario (no a la carpeta guardada de "Descarga Masiva", que es otra cosa — ver sección 6).

**Validación de seguridad en el backend** (`DescargarMercurioPDFView`, `views.py:835`):
- El nombre se valida con regex `^[\w\-\.]+\.pdf$` antes de abrir el archivo → bloquea path traversal (`../`, slashes, etc.).
- Si el nombre no matchea → `400 Nombre inválido.`
- Si el archivo no existe en `/tmp/mercurio/descargas/pdfs/` → `404 PDF no encontrado.`
- Si todo OK → `FileResponse` con `as_attachment=True` y el nombre original.

### 5.7 Endpoints consumidos

| Endpoint | Método | Para qué | View |
|---|---|---|---|
| `/api/facturacion/mercurio-pdfs/` | GET | Lista de PDFs disponibles con nombre y tamaño | `MercurioPDFsListView` |
| `/api/facturacion/mercurio-pdfs/<nombre>/` | GET | Descarga binaria de un PDF individual | `DescargarMercurioPDFView` |

**Respuesta de listado (200):**
```json
{
  "pdfs": [
    { "nombre": "12345.pdf",   "size": 240128 },
    { "nombre": "12346.pdf",   "size": 193456 },
    { "nombre": "12347_2.pdf", "size": 421984 }
  ]
}
```

Si la carpeta `/tmp/mercurio/descargas/pdfs` no existe (nunca se corrió `Sincronizar Mercurio` o se reinició el contenedor), la respuesta es `{"pdfs": []}` — no es error.

### 5.8 Manual paso a paso

**Caso 1 — Revisar resultado inmediato de una sincronización.**
1. Tras pulsar **🌐 Sincronizar Mercurio** y ver el `✓ OK` final, cerrar el modal.
2. El panel "PDFs descargados de Mercurio" se carga automáticamente con los chips de resumen.
3. Verificar que el contador (`N archivos`) coincide con `pdfs_nuevos` del log.
4. Hacer scroll para confirmar visualmente que los radicados esperados están presentes.

**Caso 2 — Inspeccionar sin sincronizar.**
1. En `/facturacion/pipeline`, pulsar **📂 Ver PDFs Mercurio**.
2. Si el panel aparece con archivos: son los PDFs de la **última** sincronización (o lo que haya quedado tras ella). Sin chips de resumen.
3. Si aparece `No hay PDFs disponibles aún.`: o nunca se corrió `Sincronizar Mercurio`, o se reinició el contenedor (la carpeta `/tmp/` se pierde en algunos despliegues).

**Caso 3 — Descargar un radicado puntual solicitado por un usuario.**
1. Pulsar **📂 Ver PDFs Mercurio**.
2. Scrollear hasta encontrar el radicado (los nombres son los IDs de Mercurio).
3. Pulsar **[⬇ PDF]** en esa fila. El navegador descarga el archivo.
4. Si el radicado tenía varias facturas, aparecen como `<id>.pdf`, `<id>_2.pdf`, `<id>_3.pdf` — bajar todas las que apliquen.

**Caso 4 — Buscar un radicado que no aparece.**
1. Si el radicado **no está** en la lista pero debería estar:
   - Verificar si la última sincronización lo dejó en `fallback_ids` o lo descartó por `dup_internos` (revisar el log del modal de Sincronizar).
   - Reabrir el panel con **📂 Ver PDFs Mercurio** — quizás se cerró el panel antes de que `cargarListaPDFs()` terminara.
   - Si confirmadamente falta, correr de nuevo **🌐 Sincronizar Mercurio** y revisar el detalle por radicado en el log.

### 5.9 Errores y diagnóstico

| Síntoma | Causa probable | Acción |
|---|---|---|
| Panel queda vacío después de **🌐 Sincronizar Mercurio** exitoso | El `cargarListaPDFs()` falló silenciosamente (catch vacío en `FacturacionPage.js:595`) | Pulsar **📂 Ver PDFs Mercurio** manualmente para forzar la carga |
| `No hay PDFs disponibles aún.` tras sincronizar con `pdfs_nuevos > 0` | El proceso Django no tiene permisos sobre `/tmp/mercurio/descargas/pdfs/`, o se montó como volumen efímero que se borra | Revisar configuración del contenedor; verificar que la carpeta sea persistente entre sincronización y consulta |
| Descarga de PDF responde `400 Nombre inválido.` | Path traversal o nombre con caracteres no permitidos (no debería pasar desde la UI) | Verificar si alguien está manipulando URLs manualmente; el regex acepta solo `[A-Za-z0-9_\-\.]+\.pdf` |
| Descarga responde `404 PDF no encontrado.` | El archivo fue eliminado entre la consulta de listado y el click (otra sincronización limpió la carpeta) | Recargar la lista y reintentar |
| Tabla muestra muchos `12345_2.pdf`, `12345_3.pdf` | El radicado trajo varias facturas (o no se detectó la principal y se guardaron varios candidatos por `dup_internos`) | Es comportamiento normal — descargar todos y revisar |
| Tabla muestra tamaños sospechosamente pequeños (< 20 KB) | PDF posiblemente corrupto o fallback de error en Mercurio | Descargar y abrir para verificar — si está corrupto, re-sincronizar |
| Botón `[⬇ PDF]` no descarga (no pasa nada al click) | Bloqueador de pop-ups del navegador o sesión expirada | Verificar consola del navegador; reloguear |

---

## 6. Acción: Descarga masiva PDFs Mercurio

### 6.1 Propósito

**Descarga Masiva PDFs** baja en una sola operación **todos los PDFs** que dejó la última `Sincronizar Mercurio` al equipo del analista. Resuelve el caso típico: tras correr la sincronización (sección 4), el analista necesita **todos** los PDFs en su disco para subirlos al sistema contable, archivarlos en una carpeta de red, o enviarlos a un tercero.

La diferencia con **Ver PDFs Mercurio** (sección 5) es que aquí no se inspecciona ni se descarga uno a uno: se transfieren todos. El destino es:

- En **Chrome / Edge** (y otros navegadores con [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)): una **carpeta del equipo** elegida por el analista, que se **recuerda entre sesiones** para no volver a preguntar.
- En **Firefox / Safari** y demás: un **ZIP único** (`Mercurio_PDFs.zip`) descargado por la ruta tradicional.

> Como la carpeta del servidor (`/tmp/mercurio/descargas/pdfs/`) se **limpia al inicio de cada sincronización**, este botón es el principal mecanismo para **conservar los PDFs antes de que la próxima corrida los borre**. Recomendación operativa: ejecutar Descarga Masiva **inmediatamente después de cada Sincronizar Mercurio**.

### 6.2 Cómo se dispara

En la botonera superior de `/facturacion/pipeline` aparece un **par de botones agrupados**:

| Botón | Cuándo aparece | Acción |
|---|---|---|
| **📥 Descarga Masiva PDFs** | Siempre | Lanza la descarga (con o sin carpeta recordada) |
| **📥 Descarga Masiva PDFs → `<nombre-carpeta>`** | Si hay una carpeta guardada en IndexedDB | Misma acción, pero anuncia visualmente la carpeta destino |
| **📁** (sub-botón pegado al principal) | Solo si hay carpeta guardada | Abre el selector para **cambiar la carpeta destino** sin lanzar descarga |

Los botones quedan **deshabilitados** mientras una sincronización (`mercurioLoading`) o una descarga masiva (`descargaMasivaLoading`) están corriendo. Durante la descarga, el botón principal muestra spinner + `Descargando...`.

### 6.3 Las dos rutas de descarga

El frontend decide al click en función de la capacidad del navegador (`FacturacionPage.js:630-677`).

```
[Click en Descarga Masiva]
        │
        ▼  ¿window.showDirectoryPicker existe?
        │
   ┌────┴────┐
  SÍ         NO
   │          │
   ▼          ▼
[Ruta A]    [Ruta B]
File System  ZIP único
Access API
```

#### Ruta A — File System Access API (Chrome/Edge/Brave moderno)

1. El frontend busca un `dirHandle` guardado en IndexedDB (clave `mercurio_pdfs_dir`).
2. Si **hay** handle:
   - Verifica permiso actual con `dirHandle.queryPermission({ mode: 'readwrite' })`.
   - Si está `granted`, lo usa directamente.
   - Si no, pide permiso con `dirHandle.requestPermission(...)`. Si el usuario lo niega, descarta el handle.
3. Si **no** hay handle (primera vez o permiso descartado): llama `window.showDirectoryPicker({ mode: 'readwrite' })` y el navegador abre el diálogo del SO para que el usuario elija una carpeta. El handle se guarda en IndexedDB (`saveDirHandle`) — **no la ruta absoluta** (eso lo abstrae la API), sino una referencia opaca con el `name` de la carpeta.
4. Una vez se tiene el handle, llama `_descargarADirectorio(dirHandle)`:
   - `GET /api/facturacion/mercurio-pdfs/` para obtener la lista.
   - Por cada PDF: `GET /api/facturacion/mercurio-pdfs/<nombre>/` → `dirHandle.getFileHandle(nombre, { create: true })` → `writable = await fileHandle.createWritable()` → `writable.write(blob)` → `writable.close()`.
   - Contadores `ok` / `errores` se acumulan localmente.
5. Al finalizar, alert: `Descarga masiva completada. X PDFs guardados en "<carpeta>"` (más `Y con errores` si los hubo).

#### Ruta B — ZIP único (fallback)

1. El frontend hace `GET /api/facturacion/mercurio-pdfs/masivo/` con el header de autenticación.
2. El backend (`DescargarMercurioPDFsMasivoView`):
   - Si la carpeta no existe → `404`.
   - Si no hay PDFs → `404`.
   - Lista todos los `.pdf` de `/tmp/mercurio/descargas/pdfs/`.
   - Construye un ZIP en memoria (`io.BytesIO()` + `zipfile.ZIP_DEFLATED`).
   - Responde como `FileResponse` con `Content-Disposition: attachment; filename="Mercurio_PDFs.zip"`.
3. El frontend recibe el blob, crea un `<a download="Mercurio_PDFs.zip">` temporal y simula click. El navegador guarda el ZIP en la carpeta de descargas estándar.
4. No hay carpeta recordada en esta ruta — la próxima vez el navegador volverá a poner el ZIP en su carpeta de descargas.

### 6.4 Memoria de carpeta destino (IndexedDB)

La persistencia del `dirHandle` se hace en una base IndexedDB propia del módulo:

| Propiedad | Valor |
|---|---|
| Base de datos | `facturacion_dir_db` |
| Object store | `dir_handles` |
| Clave del registro | `mercurio_pdfs_dir` |
| Helpers | `openDirDB()`, `saveDirHandle()`, `loadDirHandle()`, `clearDirHandle()` en `FacturacionPage.js:6-52` |

**Qué se persiste exactamente.** El objeto `FileSystemDirectoryHandle` que devuelve `showDirectoryPicker`. IndexedDB lo soporta como tipo estructurado (no necesita serialización). Tras un refresco de la página, el handle vuelve a estar disponible — pero el permiso de escritura **puede haber caducado** (el navegador lo controla), por eso el flujo siempre verifica `queryPermission` antes de usarlo.

**Cuándo se borra:**
- Cuando el usuario hace click en **📁** y elige una carpeta nueva → reemplaza el handle anterior.
- Cuando el usuario decide olvidar la carpeta (no expuesto en la UI actual, pero la función `limpiarCarpetaDescarga()` existe en `FacturacionPage.js:688-691` y borra el registro de IndexedDB).
- Cuando el navegador limpia datos del sitio (modo incógnito al cerrar, limpieza manual del usuario).

**Qué se ve en la UI.** Al montar la vista, `loadDirHandle()` se ejecuta y, si hay handle, su `name` se guarda en el estado `savedDirName`. Ese nombre alimenta:
- El sufijo del botón principal: `📥 Descarga Masiva PDFs → <savedDirName>`.
- El sub-botón **📁** (solo aparece si hay nombre guardado).
- El atributo `title` del botón (tooltip): `Descargar a: <savedDirName>`.

### 6.5 Cambiar la carpeta destino

El sub-botón **📁** (a la derecha del principal, sin separación visual) llama `cambiarCarpetaDescarga()`:

1. `window.showDirectoryPicker({ mode: 'readwrite' })` — diálogo del SO.
2. Si el usuario elige una carpeta → `saveDirHandle(nuevoHandle)` + `setSavedDirName(nuevoHandle.name)`.
3. Si el usuario cancela el diálogo → no hace nada.

A partir de ese momento, los futuros clicks del botón principal usan la nueva carpeta sin pedir confirmación.

> El sub-botón **no** dispara descarga; solo cambia la carpeta. Para descargar después de cambiar, hay que pulsar el botón principal.

### 6.6 Endpoints consumidos

| Endpoint | Método | Cuándo se usa | View |
|---|---|---|---|
| `/api/facturacion/mercurio-pdfs/` | GET | Ruta A — para obtener la lista de PDFs antes de descargar uno a uno | `MercurioPDFsListView` |
| `/api/facturacion/mercurio-pdfs/<nombre>/` | GET | Ruta A — descarga binaria por archivo | `DescargarMercurioPDFView` |
| `/api/facturacion/mercurio-pdfs/masivo/` | GET | Ruta B — ZIP con todos los PDFs | `DescargarMercurioPDFsMasivoView` |

> El endpoint del ZIP construye el archivo **en memoria** (`io.BytesIO()`). Para volúmenes muy grandes (miles de PDFs, GB acumulados) puede presionar la RAM del contenedor backend; la Ruta A es preferible cuando esté disponible porque evita ese costo.

### 6.7 Manual paso a paso

**Caso 1 — Primera vez en un equipo nuevo (Chrome/Edge).**
1. En `/facturacion/pipeline`, pulsar **📥 Descarga Masiva PDFs**.
2. El navegador abre el diálogo del SO. Elegir una carpeta (ej. `D:\Mercurio\PDFs_diarios`).
3. **Conceder permiso** cuando el navegador lo solicite (icono de carpeta junto a la barra de URL).
4. La descarga avanza archivo por archivo (sin barra de progreso explícita; el botón está en estado spinner).
5. Al terminar, alert: `Descarga masiva completada. N PDFs guardados en "PDFs_diarios"`.
6. El botón ahora muestra `📥 Descarga Masiva PDFs → PDFs_diarios` y aparece el sub-botón **📁**.

**Caso 2 — Operación rutinaria diaria (carpeta ya recordada).**
1. Pulsar **📥 Descarga Masiva PDFs → `<carpeta>`**.
2. Si el navegador concedió permiso permanente, no pregunta nada. Si caducó, pide reconfirmar permiso una sola vez.
3. Esperar el alert final.
4. Verificar la carpeta — los PDFs nuevos sobrescriben los del día anterior si comparten nombre (los radicados son únicos, así que en la práctica solo se acumulan).

**Caso 3 — Cambiar de carpeta destino.**
1. Pulsar el sub-botón **📁** (a la derecha del principal).
2. Elegir la nueva carpeta en el diálogo del SO.
3. **No se descarga nada todavía.** El botón principal ahora apunta a la nueva carpeta.
4. Pulsar **📥 Descarga Masiva PDFs → `<carpeta-nueva>`** para iniciar la descarga.

**Caso 4 — Navegador no compatible (Firefox/Safari).**
1. Pulsar **📥 Descarga Masiva PDFs**.
2. El navegador descarga `Mercurio_PDFs.zip` a la carpeta de descargas estándar del usuario.
3. Descomprimir manualmente y mover al destino deseado.
4. **No queda recordada ninguna carpeta** — al recargar la página no aparece el sub-botón **📁**.

**Caso 5 — Encadenar con Sincronizar Mercurio.**
1. Pulsar **🌐 Sincronizar Mercurio**. Esperar el `✓ OK` final.
2. Cerrar el modal de progreso.
3. **Inmediatamente** pulsar **📥 Descarga Masiva PDFs → `<carpeta>`**. No esperar — la próxima sincronización borrará la carpeta del servidor.
4. Confirmar la cuenta del alert contra `pdfs_nuevos` del log de sincronización.

### 6.8 Errores y diagnóstico

| Síntoma | Causa probable | Acción |
|---|---|---|
| Diálogo de selección de carpeta no abre y no pasa nada | Navegador sin File System Access API → cayó a Ruta B silenciosamente | Verificar consola; en Firefox/Safari es esperable. Buscar el ZIP en Descargas |
| `Error 404` o alert "No hay PDFs disponibles." | La carpeta del servidor está vacía (nunca se corrió Sincronizar Mercurio, o se limpió) | Correr **🌐 Sincronizar Mercurio** primero |
| Permiso de carpeta caducado en cada visita | El navegador tiene política estricta (incógnito, configuración de privacidad) | Aceptar reconceder el permiso cada vez, o usar perfil normal del navegador |
| `Descarga masiva completada. N PDFs guardados ... M con errores` | Algunos archivos fallaron al escribir (carpeta de red caída, sin espacio, archivo abierto en otro proceso) | Verificar carpeta destino, espacio en disco, archivos abiertos. Reintentar |
| Botón se queda en spinner indefinidamente | Conexión cortada con el backend durante una descarga muy larga | Recargar la página. Reintentar — la carpeta del servidor sigue intacta hasta la próxima sincronización |
| Tras refresco, el sub-botón **📁** desapareció pese a haber elegido carpeta antes | IndexedDB se borró (modo incógnito al cerrar, limpieza del navegador) | Volver a elegir la carpeta — se recuerda nuevamente |
| Ruta B (ZIP) tarda muchísimo y consume RAM del servidor | Demasiados PDFs construyendo el ZIP en memoria | Para descargas masivas grandes, usar Chrome/Edge (Ruta A). Si no es opción, dividir la operación: bajar parcial vía sección 5 |
| Los PDFs llegan a la carpeta pero con tamaños 0 KB | Error transitorio: el `fetch` devolvió blob vacío. El frontend no valida tamaño | Revisar carpeta y reintentar; el error real está en la consola del navegador o en logs del backend |
| El nombre de la carpeta mostrado en el botón no coincide con la carpeta real elegida | El handle apunta a una carpeta renombrada o movida después de elegirla | Pulsar **📁** y volver a elegir la carpeta correcta |

---

## 7. Vista `/facturacion/facturas` — Facturas extraídas

### 7.1 Propósito

Es la **vista de consulta operativa** sobre las facturas que el pipeline (sección 2) ya guardó en BD. A diferencia de `/facturacion` (estado del cron) y `/facturacion/pipeline` (ejecutar el pipeline), aquí el analista:

- **Filtra** por rango de fechas y por término libre (NIT, número, código).
- **Lee KPIs** del rango filtrado (cuántas, cuánto suman, cuántas no se pudieron correlacionar con fecha).
- **Audita** las facturas sin fecha de emisión y rastrea su ZIP origen.
- **Exporta a CSV** lo que se está viendo para enviarlo a contabilidad o conciliación.

Es la pestaña a la que se llega cuando un usuario contable pregunta "¿está cargada la factura X del proveedor Y de tal fecha?".

> Como la SQL Console (sección 3) toca la misma tabla `facturacion_facturaelectronica`, las dos vistas son complementarias: aquí se navega filtrando por la UI; allá se valida con SQL directo.

### 7.2 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Banner + Sub-nav                                       │
├─────────────────────────────────────────────────────────┤
│  📅 Filtro de fechas (Desde / Hasta + presets)          │
├─────────────────────────────────────────────────────────┤
│  KPIs (4 tarjetas):                                     │
│  [🧾 Total facturas] [📦 Facturas en FactIA]            │
│  [💰 Valor total]    [⚠️ Sin fecha emisión]             │
├─────────────────────────────────────────────────────────┤
│  Valor facturado por mes (mismo gráfico de Resumen,     │
│  pero respondiendo al rango filtrado)                   │
├─────────────────────────────────────────────────────────┤
│  Sección "Facturas extraídas (N)" + búsqueda +          │
│   límite + [↺ Actualizar] [↓ Exportar CSV]              │
│  ─────────────────────────────────────────              │
│  Tabla:                                                 │
│   # | NIT | Número | Código | Valor | IVA |             │
│   F. Emisión | F. Vencimiento | Observaciones           │
│  ─────────────────────────────────────────              │
│  Footer: "Mostrando X de Y · Total: $..."               │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Filtro de fechas

Tarjeta blanca arriba de los KPIs. Permite acotar todo el contenido de la vista al rango elegido.

**Controles:**

| Control | Detalle |
|---|---|
| `Desde` | Input `date`. Acota `fecha_emision >= desde` |
| `Hasta` | Input `date`. Acota `fecha_emision <= hasta` |
| `Este mes` | Atajo: primer día del mes actual → hoy |
| `Últimos 30 días` | Hoy − 30 días → hoy |
| `Este año` | 1 de enero del año actual → hoy |
| `Limpiar` | Borra ambas fechas. Solo habilitado si hay filtro activo |

**Banner azul informativo.** Cuando el filtro está activo, aparece debajo de la tarjeta: `Mostrando N de M facturas en el rango seleccionado.` — útil para confirmar que el filtro realmente está acotando lo que se ve.

**Reglas del filtro:**
- El filtro **excluye facturas sin `fecha_emision`** (porque no se pueden comparar). El KPI "Sin fecha emisión" lo destaca por separado.
- Cambiar cualquier control resetea el límite de filas visibles (`limite`) a 10.
- El filtrado es **del lado del cliente** sobre la lista completa cargada en `facturas`. Si la BD tiene cientos de miles de filas, todas se cargan al montar la vista — no hay paginación de servidor.

**Implementación:** `aplicarPreset()` en `FacturacionPage.js:942-958` y `facturasEnRango` en `FacturacionPage.js:908-916`.

### 7.4 KPIs (cuatro tarjetas)

Fila debajo del filtro. Cada tarjeta tiene un icono, un valor grande y un botón ⓘ que abre un **tooltip flotante** explicando qué muestra, cómo se calcula y de dónde viene el dato.

| # | Tarjeta | Valor | Qué cuenta | Reacciona al filtro |
|---|---|---|---|---|
| 1 | 🧾 **Total facturas** | `facturasEnRango.length` | Facturas con `fecha_emision` dentro del rango filtrado. Si no hay filtro, todas | Sí |
| 2 | 📦 **Facturas en FactIA** | `stats.total_facturas_extraidas` o `—` | Cantidad global que FactIA tiene en su volumen. **No segmenta por rango** | **No** |
| 3 | 💰 **Valor total** | Suma de `valor_factura` en el rango | Sumatoria simple en COP. Sin conversión de moneda | Sí |
| 4 | ⚠️ **Sin fecha emisión** | Cantidad con `fecha_emision IS NULL` en el rango | Útil para detectar facturas con XML mal formado o `SinXML`. Las facturas sin fecha **no aparecen en los conteos 1 y 3** | Sí (pero ver nota) |

**Detalles importantes:**

- **KPI 1 vs KPI 2.** Si difieren mucho, suele significar que hay facturas en FactIA que aún no se sincronizaron al backend del Hub. El tooltip del KPI 2 lo explica: "El pipeline reintenta automáticamente; si la diferencia persiste, revisa la pestaña Cron log".
- **KPI 4 con filtro.** Cuando el filtro está activo, el conteo muestra solo las que caen `dentro del rango` (en realidad, las sin fecha **no caen en ningún rango**, pero el cálculo del frontend las cuenta sobre `facturasEnRango` que las excluye, así que **el número se vuelve 0 con filtro activo**). El tooltip indica el conteo total sin filtro como referencia: `Sin filtro hay N facturas sin fecha en total.`
- **KPI 4 clickeable.** Si hay > 0 sin fecha, la tarjeta se vuelve un botón (borde ámbar + cursor pointer + chip `Ver correos →`). Al hacer click abre el modal `SinFechaModal` (sección 7.5).
- **Tooltips.** Se abren al hover/click del icono ⓘ. Componente `InfoButton`. Cada uno tiene tres bloques: *Qué muestra*, *Cómo se calcula*, *Origen del dato*.

### 7.5 Modal "Facturas sin fecha"

Se abre al hacer click en la tarjeta KPI 4 (cuando es clickeable). Componente `SinFechaModal` (`FacturacionPage.js:106-229`).

**Cabecera (banda ámbar):** `N facturas sin fecha de emisión — Estas facturas no pudieron correlacionarse con un correo en el histórico descargado.`

**Tabla:**

| Columna | Origen | Detalle |
|---|---|---|
| **NIT Proveedor** | `f.proveedor_nit` | Chip naranja resaltado |
| **Número Factura** | `f.numero_factura` | — |
| **Valor** | `f.valor_factura` | Formato COP |
| **Correo origen (ZIP)** | Derivado de `f.archivo` | Toma la carpeta padre del XML y le agrega `.zip`. Ejemplo: `historico_2026/.../semana_01/FAC_PROVEEDOR_X/file.xml` → `FAC_PROVEEDOR_X.zip` |
| **Observaciones** | `f.observaciones` | Si contiene `***`, se renderiza en cursiva |
| **Procesado** | `f.procesado_en` | Fecha/hora local Colombia |

**Footer:**
> El ZIP origen se deriva de la carpeta del XML en el histórico. Verifica que ese ZIP exista en `procesados.json`.

**Por qué importa esta vista.** Cuando aparecen facturas sin fecha, el flujo de investigación recomendado es:
1. Anotar el ZIP origen de la columna 4.
2. Verificar que ese ZIP esté en el volumen de FactIA (`historico_2026/...`).
3. Confirmar que `procesados.json` lo tiene marcado como procesado.
4. Si todo está bien, abrir el XML original y revisar por qué el campo `<cbc:IssueDate>` venía vacío o malformado.

**Detalle UX:** el modal se cierra al hacer click fuera (en el backdrop) o en el botón "Cerrar". El click en el contenido no propaga (`e.stopPropagation()`).

### 7.6 Sección de tabla

#### Cabecera

| Control | Detalle |
|---|---|
| Título | `Facturas extraídas (N)` donde `N = total` (todas las facturas en BD, no filtradas) |
| Búsqueda | Input libre. Filtra por `proveedor_nit`, `numero_factura` o `codigo` (case-insensitive, contiene). Aplica **sobre `facturasEnRango`**, por lo que combina con el filtro de fechas |
| Límite | Select `10 / 50 / 100`. Solo afecta cuántas filas se renderizan; el dataset completo sigue en memoria |
| ↺ Actualizar | Re-dispara `GET /api/facturacion/facturas/` |
| ↓ Exportar CSV | Descarga CSV de **todas** las facturas (`facturas`), no del filtro actual |

#### Banner amarillo (condicional)

Aparece encima de la tabla cuando:
- Hay búsqueda activa: `Mostrando X de Y resultados · Valor filtrado: $...`
- Hay más resultados que el límite (sin búsqueda): `Mostrando 10 de N · Para ver más usa el buscador o descarga el CSV`

#### Tabla principal

Columnas y formato:

| Columna | Origen | Render |
|---|---|---|
| `#` | Índice 1..N | Gris claro |
| `NIT Proveedor` | `f.proveedor_nit` | Chip gris monoespaciado |
| `Número Factura` | `f.numero_factura` | Verde oscuro, negrita |
| `Código` | `f.codigo` | Gris |
| `Valor Factura` | `f.valor_factura` | Azul `$1.234.567`, alineado a la derecha |
| `IVA` | `f.iva_facturado_proveedor` | Gris, alineado a la derecha |
| `F. Emisión` | `f.fecha_emision` | Chip azul `DD/MM/YYYY` |
| `F. Vencimiento` | `f.fecha_vencimiento` | Chip rosa `DD/MM/YYYY` |
| `Observaciones` | `f.observaciones` | Cursiva si contiene `***` (marca interna de FactIA) |

**Estados de la tabla:**

| Estado | Render |
|---|---|
| Cargando | Spinner centrado + texto `Cargando facturas...` |
| Sin búsqueda y sin facturas | Icono 🧾 + `Sin facturas aún · Ejecuta el pipeline para descargar y procesar facturas.` |
| Con búsqueda sin resultados | Icono 🧾 + `Sin resultados para la búsqueda · Prueba con otro término.` |
| Con datos | Tabla normal |

#### Footer

Banda inferior: `Mostrando X de Y registros` (izquierda) y `Total: $...` (derecha, verde oscuro). El total es el valor sumado de las facturas filtradas (`valorFiltrado`).

### 7.7 Exportar CSV

Función `exportarCSV()` (`FacturacionPage.js:895-905`):

- **Qué exporta.** Todas las facturas cargadas (`facturas`), **no** las filtradas. Si se quiere exportar solo el filtro, hoy no hay forma desde la UI — se debe usar la SQL Console (sección 3) con la query equivalente.
- **Columnas.** `NIT Proveedor, Número Factura, Código, Valor Factura, IVA, Fecha Emisión, Fecha Vencimiento, Observaciones`.
- **Formato.** UTF-8 con BOM (`﻿`) para que Excel lo abra correctamente en español. Cada celda envuelta en comillas dobles. Separador `,`.
- **Nombre del archivo.** `facturas_YYYY-MM-DD.csv` (fecha de hoy).

> Si la BD tiene muchas filas y solo se quiere un subset (ej. un solo proveedor), conviene **filtrar primero con la búsqueda** y exportar — no, no funciona, exporta todo. Para subsets reales, usar la SQL Console.

### 7.8 Endpoints consumidos

| Endpoint | Método | Para qué | View |
|---|---|---|---|
| `/api/facturacion/facturas/` | GET | Lista completa de facturas + total | `ListarFacturasView` |
| `/api/facturacion/stats/` | GET | Solo `total_facturas_extraidas` para el KPI 2 | `StatsDescargaView` |

Ambas se disparan en paralelo al montar la vista, igual que en Resumen. El frontend no pagina ni hace consultas incrementales; mantiene todo el dataset en memoria.

**Estructura de `/facturas/`:**

```json
{
  "facturas": [
    {
      "id": 123,
      "tipo_documento": "Invoice",
      "proveedor_nit": "900123456",
      "numero_factura": "FAC-001",
      "codigo": "...",
      "valor_factura": 1234567.00,
      "iva_facturado_proveedor": 234567.00,
      "fecha_emision": "2026-04-15",
      "fecha_vencimiento": "2026-05-15",
      "observaciones": "...",
      "archivo": "historico_2026/.../FAC/factura.xml",
      "procesado_en": "2026-04-16T11:23:00Z"
    }
  ],
  "total": 1234
}
```

Las facturas vienen ordenadas por `fecha_emision DESC NULLS LAST, procesado_en DESC`.

### 7.9 Manual paso a paso

**Caso 1 — Buscar una factura puntual por NIT.**
1. En `/facturacion/facturas`, escribir el NIT en el cuadro de búsqueda.
2. La tabla se filtra al instante y el banner amarillo indica cuántos resultados hay.
3. Si la búsqueda es muy ancha, refinar con número de factura o código.
4. El `Total` del footer suma solo lo filtrado por búsqueda dentro del rango activo.

**Caso 2 — Verificar el total facturado del mes en curso.**
1. Pulsar el preset **Este mes** en el filtro de fechas.
2. El KPI 💰 `Valor total` y el footer de la tabla muestran la cifra del mes.
3. Validar contra la SQL Console (sección 3) usando la query "Validar Valor total facturado" con las mismas fechas.

**Caso 3 — Investigar facturas sin fecha.**
1. Si el KPI ⚠️ `Sin fecha emisión` muestra > 0, hacer click en la tarjeta.
2. En el modal, anotar los ZIP origen de las facturas problemáticas.
3. Coordinar con el equipo técnico para revisar esos XML en el volumen de FactIA.
4. Cuando se corrija el XML y se reprocese (sección 2), las facturas deberían salir del modal en la próxima recarga (↺ Actualizar).

**Caso 4 — Exportar todas las facturas a contabilidad.**
1. Pulsar **↓ Exportar CSV**. Se descarga `facturas_YYYY-MM-DD.csv` con todo el dataset.
2. Abrir en Excel — el BOM UTF-8 hace que las tildes y la `ñ` se vean correctamente.
3. Si solo se necesita un subset, **no usar este botón**: ir a la SQL Console con la query apropiada y exportar desde ahí.

**Caso 5 — Comparar el "Total" de la UI con el global de FactIA.**
1. Limpiar el filtro de fechas (botón `Limpiar`).
2. Comparar KPI 1 (`Total facturas`) con KPI 2 (`Facturas en FactIA`).
3. Si KPI 1 < KPI 2, hay facturas en FactIA que aún no se persistieron al Hub. Esperar a la próxima corrida del cron o disparar manualmente **⚙️ Clasificar y extraer metadata** en `/facturacion/pipeline` (sección 2).
4. Si KPI 1 > KPI 2, hay registros legacy en BD que ya no están en el volumen de FactIA. Es esperable si se hizo limpieza histórica del servicio.

### 7.10 Errores y diagnóstico

| Síntoma | Causa probable | Acción |
|---|---|---|
| `Cargando facturas...` indefinido | El endpoint `/facturas/` no respondió o se cortó la conexión | Pulsar **↺ Actualizar**. Verificar conectividad con el backend |
| KPI 2 muestra `—` | `/stats/` falló (FactIA no respondió, timeout 10 s) | Verificar el servicio FactIA. El resto de la vista funciona sin ese dato |
| Tabla muestra `Sin facturas aún` pero la cobertura del Resumen indica que se descargó | Las facturas se descargaron como ZIPs pero no se ha corrido **Procesar** | Ir a `/facturacion/pipeline` y pulsar **⚙️ Clasificar y extraer metadata** |
| Filtro de fechas no muestra ningún resultado pero hay facturas visibles sin filtro | Todas las facturas del rango tienen `fecha_emision = null` y el filtro las excluye | Revisar el KPI ⚠️ `Sin fecha emisión` y abrir el modal |
| Búsqueda no encuentra una factura que está en BD | La búsqueda solo opera sobre NIT, número y código. No busca en observaciones ni en `archivo` | Usar la SQL Console con `LIKE '%texto%'` sobre las columnas necesarias |
| Banner amarillo dice "Mostrando 10 de 500" y no se ven más al scrollear | El select `Límite` está en 10 | Cambiar el select a 50 o 100, o usar buscador / CSV |
| Exportar CSV descarga un archivo con miles de filas no deseadas | Es el comportamiento actual: exporta todo, no el filtro | Usar SQL Console con la query apropiada y exportar desde ahí |
| Excel abre el CSV con caracteres extraños | El archivo se abrió ignorando el BOM | Abrir con `Datos → Desde texto` y especificar UTF-8 explícitamente |
| Modal "Sin fecha" tarda en abrir con muchas facturas | Render de tabla grande en cliente | Esperar; en facturas con miles de "sin fecha" es preferible filtrar vía SQL Console |
| Tras correr **Procesar** no aparecen las nuevas facturas | El frontend solo recarga al final del SSE; si se cerró el modal antes, hay que pulsar **↺ Actualizar** | Pulsar ↺ |
