# FactIA — Documento Técnico

## Facturación Electrónica — Arquitectura y Especificación Técnica

**Versión:** 1.0  
**Fecha:** 2026-04-22  
**Stack:** Flask + Gunicorn (servicio) | Django + DRF (backend) | React (frontend) | Playwright (Mercurio)

---

## 1. Arquitectura General

```
┌──────────────────────────────────────────────────────────────────┐
│                       Frontend (React)                           │
│                  FacturacionPage.js (~1700 líneas)               │
│                       Puerto: 9000                               │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP /api/facturacion/
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Nginx (Proxy)                               │
│               /api/ → backend:8000                               │
│           proxy_read_timeout 600s (streaming)                    │
└──────────┬──────────────────────────────────┬────────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────────┐     ┌──────────────────────────────────┐
│   Backend Django + DRF  │     │     FactIA Service (Flask)       │
│   Gunicorn — 3 workers  │◄───►│   Gunicorn — 1 worker — :8002   │
│   Puerto: 8000          │     │                                  │
│                         │     │   historico_service/             │
│   modules/facturacion/  │     │   ├── graph_client.py           │
│   ├── views.py (1230 l) │     │   ├── downloader.py             │
│   ├── models.py (36 l)  │     │   └── extractor.py              │
│   ├── client.py (34 l)  │     │                                  │
│   └── urls.py (34 l)    │     │   transformacion_service/       │
│                         │     │   ├── classifier.py              │
│                         │     │   └── metadata_extractor.py     │
└──────────┬──────────────┘     └──────────┬───────────────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐       ┌────────────────────────────────────┐
│    PostgreSQL       │       │    /data/factia/ (volumen)         │
│  facturacion_*      │       │    ├── historico_2026/             │
│                     │       │    ├── extraidos/                   │
└─────────────────────┘       │    ├── curado_2026/                │
                              │    ├── rechazados_2026/             │
┌─────────────────────┐       │    ├── procesados.json             │
│  Microsoft Graph    │       │    ├── facturas_metadata.json      │
│  (Exchange Online)  │───────│    └── cron_log.json               │
└─────────────────────┘       └────────────────────────────────────┘

┌─────────────────────┐
│  Mercurio Portal    │
│  (Playwright)       │───── /tmp/mercurio/descargas/pdfs/
└─────────────────────┘
```

---

## 2. Estructura del Proyecto

### 2.1 Servicio FactIA (Flask)

```
/home/desarrollo/Finagro/FactIA/
├── app.py                          # Flask app + scheduler (706 líneas)
├── Dockerfile                      # Imagen Docker
├── requirements.txt                # Dependencias Python
├── historico_service/              # Descarga de correos
│   ├── main.py                     # Orquestador (27 líneas)
│   ├── auth.py                     # OAuth2 token (20 líneas)
│   ├── graph_client.py             # Cliente Microsoft Graph (137 líneas)
│   ├── downloader.py               # Descarga de adjuntos (140 líneas)
│   ├── extractor.py                # Extracción ZIP (57 líneas)
│   ├── storage.py                  # Estructura de carpetas (17 líneas)
│   ├── control.py                  # Control de procesados (13 líneas)
│   ├── config.py                   # Configuración (12 líneas)
│   └── logger_config.py           # Logging (17 líneas)
├── transformacion_service/         # Clasificación y metadatos
│   ├── main.py                     # Entry point (48 líneas)
│   ├── classifier.py               # Clasificador ZIP (206 líneas)
│   ├── metadata_extractor.py       # Parser XML UBL 2.0 (782 líneas)
│   ├── validator.py                # Detector tipo documento (76 líneas)
│   ├── metadata_writer.py          # Exportador CSV (35 líneas)
│   └── config.py                   # Configuración (4 líneas)
└── descargar_service/              # Scripts GUI Windows
    ├── sincronizar_facturas.py     # Script consola
    └── Sincronizarfacturasgui .py  # GUI Tkinter
```

### 2.2 Backend Django (Módulo Facturación)

```
/home/desarrollo/Finagro/automation-hub-finagro/backend/modules/facturacion/
├── models.py                       # 1 modelo (36 líneas)
├── views.py                        # 15+ vistas API (1230 líneas)
├── serializers.py                  # 1 serializer (14 líneas)
├── urls.py                         # 20+ rutas (34 líneas)
├── client.py                       # Cliente HTTP FactIA (34 líneas)
└── migrations/
    ├── 0001_initial.py
    └── 0002_tipo_documento.py
```

---

## 3. Modelo de Datos

### 3.1 FacturaElectronica

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | AutoField (PK) | Identificador |
| execution | FK(Execution) | Ejecución asociada (audit trail) |
| tipo_documento | CharField(30) | Invoice, CreditNote, DebitNote, SinXML, Unknown |
| proveedor_nit | CharField(50) | NIT del proveedor |
| numero_factura | CharField(500) | Número de factura (solo dígitos) |
| codigo | CharField(20) | Código interno |
| valor_factura | Decimal(18,2) | Valor total a pagar |
| iva_facturado_proveedor | Decimal(18,2) | IVA facturado |
| fecha_emision | DateField | Fecha de emisión |
| fecha_vencimiento | DateField | Fecha de vencimiento |
| observaciones | TextField | Observaciones del XML |
| archivo | CharField(1000) | Ruta del archivo fuente |
| procesado_en | DateTimeField (auto) | Timestamp de procesamiento |

**Constraint único:** `(tipo_documento, proveedor_nit, numero_factura)`

---

## 4. API REST — Endpoints

### 4.1 Descarga y Procesamiento

| Método | Ruta | Vista | Timeout | Descripción |
|--------|------|-------|---------|-------------|
| POST | `/api/facturacion/descargar/` | DescargarFacturasView | 600s | Descarga correos (síncrono) |
| POST | `/api/facturacion/descargar/stream/` | DescargarStreamView | — | Descarga con SSE |
| POST | `/api/facturacion/procesar/` | ProcesarFacturasView | 300s | Clasificar + extraer metadatos |
| POST | `/api/facturacion/procesar/stream/` | ProcesarStreamView | — | Procesar con SSE |
| POST | `/api/facturacion/abortar/` | AbortView | — | Cancelar operación en curso |

### 4.2 Consulta

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| GET | `/api/facturacion/facturas/` | ListarFacturasView | Lista todas las facturas |
| GET | `/api/facturacion/stats/` | StatsDescargaView | Estadísticas de descarga |
| GET | `/api/facturacion/semanas/` | ListarSemanasView | Semanas disponibles |
| GET | `/api/facturacion/cron-log/` | CronLogView | Historial de ejecuciones cron |

### 4.3 Descarga de Archivos

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| GET | `/api/facturacion/descargar-carpetas/` | DescargarCarpetasView | ZIP completo de extraídos |
| GET | `/api/facturacion/descargar-carpetas/info/` | InfoCarpetasView | Metadata sin descarga |
| GET | `/api/facturacion/descargar-pdfs/` | DescargarPDFsView | PDFs por semana |
| GET | `/api/facturacion/descargar-script/` | DescargarScriptView | Script PowerShell |
| GET | `/api/facturacion/descargar-instalador/` | DescargarInstaladorView | Instalador .exe/.bat |

### 4.4 Sincronización Interna

| Método | Ruta | Vista | Auth | Descripción |
|--------|------|-------|------|-------------|
| POST | `/api/facturacion/sincronizar-cron/` | SincronizarCronView | X-Cron-Token | Llamada interna del cron |

### 4.5 Mercurio

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| POST | `/api/facturacion/abrir-mercurio/` | AbrirMercurioView | Test de login |
| POST | `/api/facturacion/sincronizar-mercurio/stream/` | SincronizarMercurioView | Pipeline completo SSE |
| GET | `/api/facturacion/mercurio-pdfs/` | MercurioPDFsListView | Lista PDFs |
| GET | `/api/facturacion/mercurio-pdfs/{nombre}/` | DescargarMercurioPDFView | Descarga individual |
| GET | `/api/facturacion/mercurio-pdfs/masivo/` | DescargarMercurioPDFsMasivoView | ZIP masivo |

---

## 5. Componentes Técnicos Clave

### 5.1 Microsoft Graph Client

**Archivo:** `historico_service/graph_client.py`

- **Autenticación:** OAuth2 client credentials flow contra Azure AD
- **Endpoint:** `https://graph.microsoft.com/v1.0/users/{MAILBOX}/messages`
- **Paginación:** 10 mensajes por página, paginación automática con `@odata.nextLink`
- **Resiliencia:**
  - Retry automático en 401 (refresh token)
  - Backoff exponencial en 429 (rate limit)
  - Retry en 500/502/503/504
  - Máximo 3 intentos por request
  - Timeout por chunk: 30s
  - Timeout total de descarga: 90s

### 5.2 Clasificador de ZIPs

**Archivo:** `transformacion_service/classifier.py`

- Escanea `historico_2026/` buscando ZIPs
- Extrae XMLs y detecta raíz del documento
- Aplica jerarquía de prioridad para clasificación
- Mueve a carpeta destino: `curado_2026/` o `rechazados_2026/`

### 5.3 Extractor de Metadatos XML

**Archivo:** `transformacion_service/metadata_extractor.py` (782 líneas)

- Parsing XML con namespaces UBL 2.0:
  - `cbc`: `urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2`
  - `cac`: `urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2`
- Manejo de AttachedDocument con CDATA embebido
- Eliminación de namespaces para compatibilidad
- Conversión decimal para campos monetarios

### 5.4 Scheduler (APScheduler)

**Archivo:** `app.py` (líneas 697-702)

```python
_scheduler = BackgroundScheduler(timezone='America/Bogota')
_scheduler.add_job(lambda: _run_cron_slot('06:00'), CronTrigger(hour=6, minute=0))
_scheduler.add_job(lambda: _run_cron_slot('11:00'), CronTrigger(hour=11, minute=0))
_scheduler.add_job(lambda: _run_cron_slot('16:00'), CronTrigger(hour=16, minute=0))
```

### 5.5 SSE (Server-Sent Events)

Tanto Flask (FactIA) como Django (backend) implementan streaming SSE:

```
data: mensaje de log\n\n           → Log en tiempo real
event: result\ndata: {json}\n\n    → Resultado final
event: error\ndata: mensaje\n\n    → Error
```

El frontend consume con `fetch()` + `ReadableStream` parser.

### 5.6 Mercurio — Automatización Playwright

**Archivo:** `views.py` — `SincronizarMercurioView`

**Pipeline:**
1. Launch Chromium headless
2. Login con credenciales (input name='asri', name='ntrsn')
3. Esperar `ConsultarUsuarioLogueado` response
4. Hover BANDEJAS → click WorkFlow
5. Localizar frame `BandejaRutas`
6. Filtrar `select[name='listapaso']` = "1"
7. Detectar paginación (`select[name='listapagina']`)
8. Extraer documentos con regex `selectDoc(\d+)()` del HTML
9. Por cada documento:
   - Ejecutar `selectDoc{n}()` en el frame
   - Leer variables JS: `idDocumento`, `tipDocumento`
   - GET a TraerImagen via `context.request` (preserva cookies)
   - Parsear respuesta: PDF directo, HTML con link a EML/PDF
10. Para EMLs: parsear con `email` module, extraer PDF de adjuntos ZIP
11. Navegar páginas, detectar duplicados

---

## 6. Despliegue

### 6.1 Docker — Servicio FactIA

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install -r requirements.txt
RUN mkdir -p /data/factia
ENV FACTIA_DATA_DIR=/data/factia
CMD ["gunicorn", "--bind", "0.0.0.0:8002", "--timeout", "600", "--workers", "1", "app:app"]
```

### 6.2 Docker Compose (prod)

```yaml
factia:
  build:
    context: ../FactIA
    dockerfile: Dockerfile
  restart: unless-stopped
  env_file: .env.prod
  environment:
    FACTIA_DATA_DIR: /data/factia
    BACKEND_URL: http://backend:8000
  volumes:
    - factia_data:/data/factia
  networks:
    - finagro-net
```

### 6.3 Docker — Backend Django

```yaml
backend:
  build:
    context: .
    dockerfile: docker/Dockerfile.backend
  env_file: .env.prod
  environment:
    FACTIA_URL: http://factia:8002
  depends_on:
    - db
    - factia
```

### 6.4 Variables de Entorno

| Variable | Servicio | Descripción |
|----------|----------|-------------|
| TENANT_ID | FactIA | Azure AD Tenant ID |
| CLIENT_ID | FactIA | Azure AD App ID |
| CLIENT_SECRET | FactIA | Azure AD Secret |
| FACTIA_DATA_DIR | FactIA | Directorio de datos (default: /data/factia) |
| BACKEND_URL | FactIA | URL del backend Django |
| CRON_INTERNAL_TOKEN | Ambos | Token compartido para sincronización cron |
| FACTIA_URL | Backend | URL del servicio FactIA (default: http://localhost:8002) |

---

## 7. Almacenamiento de Datos

### 7.1 Sistema de Archivos (volumen /data/factia/)

```
/data/factia/
├── historico_2026/                  # ZIPs originales por semana
│   └── 2026/01_january/semana_01/
├── extraidos/                       # Contenido extraído de ZIPs
│   └── 2026/01_january/semana_01/
├── curado_2026/                     # Facturas clasificadas (Invoice)
│   └── facturas/2026/01/semana_01/
├── rechazados_2026/                 # Otros tipos de documento
│   ├── CreditNote/
│   ├── DebitNote/
│   ├── ApplicationResponse/
│   └── SinXML/
├── procesados.json                  # IDs de mensajes procesados
├── facturas_metadata.json           # Metadatos extraídos
└── cron_log.json                    # Log de ejecuciones cron
```

### 7.2 Mercurio

```
/tmp/mercurio/descargas/
├── *.eml                            # EMLs descargados
└── pdfs/
    └── {radicado}.pdf               # PDFs extraídos
```

---

## 8. Cliente HTTP (FactIAClient)

**Archivo:** `client.py`

```python
class FactIAClient:
    BASE = settings.FACTIA_URL  # http://factia:8002

    def descargar(fecha_desde, fecha_hasta):
        # POST /api/descargar/ — timeout 600s

    def procesar():
        # POST /api/procesar/ — timeout 300s

    def listar_facturas():
        # GET /api/facturas/ — timeout 30s
```

---

## 9. Resiliencia y Manejo de Errores

| Componente | Mecanismo | Detalle |
|------------|-----------|---------|
| Graph API | Retry + backoff | 3 intentos, backoff en 429/5xx |
| Graph API | Token refresh | Refresh automático en 401 |
| Descarga adjuntos | Threading + timeout | Threads paralelos, 90s timeout |
| Job abort | Threading event | Cancelación limpia, guarda progreso |
| Deduplicación correos | procesados.json | Evita re-descarga |
| Deduplicación BD | unique_together | Constraint (tipo, nit, numero) |
| Mercurio | Paginación inteligente | Detecta páginas duplicadas |
| Mercurio | context.request | Preserva sesión completa del navegador |

---

## 10. Dependencias

### Servicio FactIA
```
flask >= 3.0
gunicorn >= 21.2
requests >= 2.31
certifi
python-dotenv >= 1.0
APScheduler >= 3.10
pytz >= 2023.3
```

### Backend (adicionales al core Django)
```
playwright==1.58.0   # Mercurio automation
requests             # HTTP client para FactIA
```

---

## 11. Métricas del Código

| Componente | Archivos | Líneas |
|------------|----------|--------|
| FactIA app.py | 1 | 706 |
| historico_service/ | 8 | ~430 |
| transformacion_service/ | 5 | ~1,150 |
| Backend views.py | 1 | 1,230 |
| Backend models+serial+urls+client | 4 | ~120 |
| Frontend FacturacionPage.js | 1 | ~1,700 |
| **Total** | **20** | **~5,336** |
