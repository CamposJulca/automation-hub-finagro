# SIGA — Documento Técnico

## Sistema Inteligente de Gestión Administrativa — Módulo Beneficios de Salud

**Versión:** 1.0  
**Fecha:** 2026-04-22  
**Stack:** Django 4.2 + DRF + PostgreSQL/SQLite + React

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│               SigaPage.js (1646 líneas)             │
│                   Puerto: 9000                       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP /siga-api/
                       ▼
┌─────────────────────────────────────────────────────┐
│                   Nginx (Proxy)                      │
│              /siga-api/ → siga:8000/api/            │
│           client_max_body_size: 50M                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              SIGA Backend (Django + DRF)            │
│            Gunicorn — 2 workers — :8000             │
│                                                      │
│  modules/beneficios_salud/                           │
│  ├── views.py      (23 vistas, 1280 líneas)         │
│  ├── models.py     (8 modelos, 206 líneas)          │
│  ├── serializers.py (8 serializers)                  │
│  ├── urls.py       (39 rutas)                        │
│  └── services/     (6 módulos de lógica)            │
└────────┬───────────────────────┬────────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   PostgreSQL    │    │   prepagada.db   │
│  (principal)    │    │    (SQLite)      │
│  8 tablas bs_*  │    │  Datos Kactus   │
└─────────────────┘    └──────────────────┘
```

---

## 2. Estructura del Proyecto

```
/home/desarrollo/Finagro/siga/
├── backend/
│   ├── core/
│   │   ├── settings.py          # Configuración Django
│   │   ├── urls.py              # Rutas raíz
│   │   └── wsgi.py              # WSGI
│   ├── modules/
│   │   └── beneficios_salud/
│   │       ├── models.py        # 8 modelos ORM
│   │       ├── views.py         # 23 vistas API
│   │       ├── serializers.py   # 8 serializers DRF
│   │       ├── urls.py          # 39 rutas
│   │       ├── admin.py         # Admin Django
│   │       ├── migrations/      # Migraciones DB
│   │       └── services/
│   │           ├── detector.py          # Detección de proveedor
│   │           ├── reader_excel.py      # Parser Excel (.xls/.xlsx)
│   │           ├── validator.py         # Validación de registros
│   │           ├── axa_adapter.py       # Mapeo AXA → esquema unificado
│   │           ├── colsanitas_adapter.py # Mapeo Colsanitas → esquema
│   │           └── prepagada_service.py # Cálculo 80/20 + cruce Kactus
│   ├── manage.py
│   └── requirements.txt
├── docker/
│   └── Dockerfile
├── docker-compose.yml
├── storage/
│   └── landing/               # Almacenamiento de archivos Excel
├── prepagada.db               # Base SQLite de Kactus
└── facturas/                  # Ejemplos de facturas
```

---

## 3. Modelos de Datos

### 3.1 ArchivoRecibido (`bs_archivos_recibidos`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | AutoField (PK) | Identificador |
| proveedor | CharField(50) | 'axa' o 'colsanitas' |
| nombre_archivo | CharField(500) | Nombre original del archivo |
| ruta_archivo | CharField(1000) | Ruta en disco |
| fecha_recepcion | DateTimeField | Timestamp de carga |
| estado_procesamiento | CharField(20) | PENDIENTE, PROCESADO, ERROR |
| hash_archivo | CharField(64) | SHA-256 para deduplicación |
| usuario_carga | CharField(100) | Usuario que cargó |
| total_registros | IntegerField | Total de filas |
| registros_procesados | IntegerField | Filas OK |
| registros_con_error | IntegerField | Filas con error |
| numero_contrato | CharField(50) | Número de contrato extraído |
| periodo_facturacion | CharField(20) | Período de la factura |

### 3.2 BeneficioSalud (`bs_beneficios_salud`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | AutoField (PK) | Identificador |
| archivo | FK(ArchivoRecibido) | Archivo de origen |
| cedula | CharField(20) | Cédula del beneficiario |
| tipo_id | CharField(5) | Tipo de documento |
| nombre | CharField(200) | Nombre completo |
| parentesco | CharField(50) | Relación con titular |
| sub_contrato | CharField(50) | Sub-contrato |
| cedula_titular | CharField(20) | Cédula del empleado titular |
| proveedor | CharField(50) | Proveedor de salud |
| tipo_plan | CharField(50) | Tipo de plan |
| valor_base | Decimal(18,2) | Valor base (cuota) |
| descuento | Decimal(18,2) | Descuento comercial |
| iva | Decimal(18,2) | IVA |
| valor_total | Decimal(18,2) | Valor total |
| fecha_nacimiento | DateField | Fecha de nacimiento |
| edad | IntegerField | Edad calculada |
| fecha_corte | DateField | Fecha de corte |
| numero_contrato | CharField(50) | Número de contrato |
| estado_validacion | CharField(20) | OK, ADVERTENCIA, ERROR |

### 3.3 ErrorProcesamiento (`bs_errores_procesamiento`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | AutoField (PK) | Identificador |
| archivo | FK(ArchivoRecibido) | Archivo asociado |
| fila_origen | IntegerField | Número de fila en el Excel |
| tipo_error | CharField(50) | CEDULA_INVALIDA, VALOR_INVALIDO, etc. |
| descripcion | TextField | Descripción detallada |
| valor_encontrado | CharField(200) | Valor que causó el error |
| timestamp | DateTimeField | Momento del error |

### 3.4 PoliticaPrepagada (`bs_politica_prepagada`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| porcentaje_empresa | Decimal(5,2) | % empresa (ej: 80.00) |
| porcentaje_empleado | Decimal(5,2) | % empleado (ej: 20.00) |
| uvt_limite | Decimal(10,2) | Número de UVTs límite |
| valor_uvt | Decimal(12,2) | Valor monetario UVT |
| porcentaje_empresa_pensionado | Decimal(5,2) | % empresa para pensionados |
| cod_conc_* | CharField | Códigos contables |
| vigente_desde | DateField | Fecha de vigencia |
| creada_por | CharField(100) | Usuario creador |

### 3.5 PensionadoPrepagada (`bs_pensionados_prepagada`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| cedula | CharField(20) | Cédula del pensionado |
| nombre | CharField(200) | Nombre completo |
| eps | CharField(100) | EPS asignada |
| valor_mensual | Decimal(18,2) | Valor mensual |
| fecha_inicio / fecha_fin | DateField | Período de cobertura |
| activo | BooleanField | Estado activo |

### 3.6 AuxilioExterno (`bs_auxilio_externo`)
Misma estructura que PensionadoPrepagada.

### 3.7 PlanillaCalculo (`bs_planilla_calculo`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| periodo | CharField(10) | Período (MMYYYY) |
| politica | FK(PoliticaPrepagada) | Política aplicada |
| total_empleados | IntegerField | Empleados procesados |
| total_empresa | Decimal(18,2) | Total asumido empresa |
| total_empleado | Decimal(18,2) | Total asumido empleado |
| total_gravable | Decimal(18,2) | Total gravable |
| total_no_gravable | Decimal(18,2) | Total no gravable |

### 3.8 DetalleCalculo (`bs_detalle_calculo`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| planilla | FK(PlanillaCalculo) | Planilla padre |
| cedula | CharField(20) | Cédula empleado |
| nombre_en_factura | CharField(200) | Nombre según factura |
| nombre_en_kactus | CharField(200) | Nombre según Kactus |
| eps | CharField(100) | EPS |
| num_beneficiarios | IntegerField | Número de beneficiarios |
| total_familia | Decimal(18,2) | Total familia |
| valor_empresa | Decimal(18,2) | Parte empresa |
| valor_empleado | Decimal(18,2) | Parte empleado |
| apoyo_no_gravable | Decimal(18,2) | Apoyo no gravable |
| apoyo_gravable | Decimal(18,2) | Apoyo gravable |
| estado_cruce | CharField(20) | OK, SIN_KACTUS, SIN_FACTURA |
| sue_basi | Decimal(18,2) | Salario básico Kactus |
| tip_cont | CharField(5) | Tipo contrato |

---

## 4. API REST — Endpoints

### 4.1 Gestión de Archivos

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| POST | `/api/beneficios-salud/upload/` | UploadView | Carga Excel (multipart) |
| GET | `/api/beneficios-salud/archivos/` | ArchivoListView | Lista archivos cargados |
| GET | `/api/beneficios-salud/archivos/{id}/` | ArchivoDetailView | Detalle + errores |

### 4.2 Consulta de Beneficiarios

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| GET | `/api/beneficios-salud/beneficios/` | BeneficioListView | Lista beneficiarios |
| GET | `/api/beneficios-salud/exportar/` | ExportarExcelView | Exportar a Excel multi-hoja |

### 4.3 Análisis y Reportes

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| GET | `/api/beneficios-salud/novedades/` | NovedadesView | Comparación de archivos |
| GET | `/api/beneficios-salud/dashboard/` | DashboardView | Métricas ejecutivas |
| GET | `/api/beneficios-salud/causacion/` | CausacionView | Resumen por EPS |
| GET | `/api/beneficios-salud/conciliacion/` | ConciliacionView | Conciliación entre períodos |
| GET | `/api/beneficios-salud/informe-efr/` | InformeEFRView | Informe mensual EFR |

### 4.4 Cruce y Cálculo

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| GET | `/api/beneficios-salud/cruce/` | CruceView | Cruce con Kactus |
| POST | `/api/beneficios-salud/planilla/calcular/` | PlanillaCalcularView | Ejecutar cálculo 80/20 |
| GET | `/api/beneficios-salud/planilla/` | PlanillaListView | Lista planillas |
| GET | `/api/beneficios-salud/planilla/{pk}/` | PlanillaDetailView | Detalle planilla |
| GET | `/api/beneficios-salud/planilla/{pk}/exportar/` | PlanillaExportarView | Exportar planilla |

### 4.5 Políticas y Maestros

| Método | Ruta | Vista | Descripción |
|--------|------|-------|-------------|
| GET/POST | `/api/beneficios-salud/politica/` | PoliticaView | CRUD política |
| GET/PUT | `/api/beneficios-salud/politica/{pk}/` | PoliticaDetailView | Detalle/editar política |
| GET/POST | `/api/beneficios-salud/pensionados/` | PensionadosView | CRUD pensionados |
| GET/PUT/DELETE | `/api/beneficios-salud/pensionados/{pk}/` | PensionadoDetailView | Detalle pensionado |
| GET/POST | `/api/beneficios-salud/auxilio-externo/` | AuxilioExternoView | CRUD auxilio externo |
| GET/PUT/DELETE | `/api/beneficios-salud/auxilio-externo/{pk}/` | AuxilioExternoDetailView | Detalle auxilio |

---

## 5. Servicios de Negocio

### 5.1 detector.py — Detección de Proveedor
```python
detect_provider(filename, columns) → 'axa' | 'colsanitas' | 'desconocido'
```
- Nivel 1: análisis del nombre de archivo (case-insensitive)
- Nivel 2: búsqueda de columnas marcadoras

### 5.2 reader_excel.py — Lector de Excel
```python
read_excel(filepath) → (rows: list[dict], metadata: dict)
```
- Soporta `.xlsx` (openpyxl) y `.xls` (xlrd)
- Auto-detecta fila de encabezado (filas 0-21)
- Extrae metadatos: numero_contrato, periodo_facturacion
- Normaliza nombres de columnas

### 5.3 axa_adapter.py / colsanitas_adapter.py — Adaptadores
```python
adapt(rows) → list[dict]  # Esquema unificado
```
- Mapean columnas del proveedor al esquema interno
- Colsanitas filtra filas de totales (TOTAL FAMILIA, TOTAL CONTRATO)

### 5.4 validator.py — Validador
```python
validate(records) → (registros_ok: list, errores: list[ErrorProcesamiento])
```
- 4 reglas de validación (cédula, valores, aritmética, duplicados)
- Tolerancia aritmética: ±$1.00 COP

### 5.5 prepagada_service.py — Servicio de Prepagada
```python
get_periodos_disponibles() → list[str]
get_cruce_periodo(periodo) → list[dict]
calcular_planilla(periodo, politica) → PlanillaCalculo
get_empleados_kactus() → list[dict]
```
- Conexión SQLite a `prepagada.db`
- Cálculo 80/20 con límite UVT

---

## 6. Despliegue

### 6.1 Docker

**Dockerfile:** `docker/Dockerfile`
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
RUN mkdir -p /app/db
EXPOSE 8000
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
```

### 6.2 Docker Compose

```yaml
services:
  siga:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "9010:8000"
    volumes:
      - ./storage:/app/../storage
      - siga_db:/app/db
    environment:
      - DEBUG=1
      - PREPAGADA_DB_PATH=/app/db/prepagada.db
```

### 6.3 Nginx (integración con plataforma)

```nginx
location /siga-api/ {
    proxy_pass         http://siga:8000/api/;
    proxy_read_timeout 120s;
    client_max_body_size 50M;
}
```

### 6.4 Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| DEBUG | Modo debug Django | 1 |
| PREPAGADA_DB_PATH | Ruta a SQLite de Kactus | /app/db/prepagada.db |
| DATABASE_URL | URL PostgreSQL (opcional) | SQLite |
| DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT | Conexión PostgreSQL | — |

---

## 7. Dependencias

```
Django==4.2.11
djangorestframework==3.15.1
pandas==2.2.1
openpyxl==3.1.2
xlrd==2.0.1
python-dotenv==1.0.1
gunicorn==21.2.0
psycopg2-binary==2.9.9
```

---

## 8. Métricas del Código

| Métrica | Valor |
|---------|-------|
| Modelos | 8 |
| Vistas API | 23 clases |
| Endpoints | 39 rutas |
| Serializers | 8 |
| Servicios | 6 módulos |
| Líneas backend | ~2,500 |
| Frontend | 1,646 líneas (SigaPage.js) |
