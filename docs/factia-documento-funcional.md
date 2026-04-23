# FactIA — Documento Funcional

## Facturación Electrónica — Sistema de Descarga, Clasificación y Distribución

**Versión:** 1.0  
**Fecha:** 2026-04-22  
**Módulo:** Facturación Electrónica + Mercurio

---

## 1. Objetivo del Módulo

FactIA automatiza el ciclo completo de facturación electrónica de Finagro: descarga automática de facturas desde el correo electrónico, clasificación por tipo de documento, extracción de metadatos XML, persistencia en base de datos, y distribución a usuarios finales. Además, integra la sincronización con el sistema Mercurio para descarga de documentos del flujo de trabajo interno.

---

## 2. Alcance

| Capacidad | Descripción |
|-----------|-------------|
| Descarga automática | Conexión al buzón facturacion@finagro.com.co vía Microsoft Graph API |
| Clasificación | Detección de tipo: Factura, Nota Crédito, Nota Débito, Respuesta, Sin XML |
| Extracción de metadatos | Parsing XML UBL 2.0: NIT, número factura, valor, fechas, IVA |
| Persistencia | Almacenamiento en PostgreSQL con trazabilidad de ejecución |
| Distribución | Descarga por semana, script PowerShell para sincronización local |
| Programación automática | 3 ejecuciones diarias (06:00, 11:00, 16:00 hora Colombia) |
| Mercurio | Descarga robótica de PDFs desde el portal Mercurio (WorkFlow Paso 1) |

---

## 3. Actores

| Actor | Rol |
|-------|-----|
| Sistema (cron) | Ejecuta descarga y procesamiento automático 3 veces al día |
| Analista de facturación | Consulta facturas, descarga PDFs, ejecuta sincronización manual |
| Usuario final (Windows) | Usa script PowerShell para sincronizar PDFs localmente |
| Mercurio | Sistema contable interno de donde se descargan documentos adicionales |

---

## 4. Flujos Funcionales

### 4.1 Descarga de Correos (Historico Service)

```
Buzón facturacion@finagro.com.co (Microsoft Exchange)
    → Autenticación OAuth2 (client credentials)
    → Consulta mensajes con adjuntos ZIP (desde START_DATE)
    → Descarga adjuntos (threads paralelos, 90s timeout)
    → Almacenamiento: historico_2026/{año}/{mes}/{semana}/
    → Extracción ZIP: extraidos/{año}/{mes}/{semana}/{nombre}/
    → Registro en procesados.json (evita re-descarga)
```

**Organización de archivos:**
```
historico_2026/
  2026/
    01_january/
      semana_01/
        factura_proveedor_x.zip
        factura_proveedor_y.zip
extraidos/
  2026/
    01_january/
      semana_01/
        factura_proveedor_x/
          *.xml, *.pdf
```

### 4.2 Clasificación (Transformacion Service)

El clasificador analiza el contenido XML de cada ZIP y determina el tipo de documento:

| Tipo | Descripción | Destino |
|------|-------------|---------|
| Invoice | Factura electrónica | curado_2026/facturas/ |
| CreditNote | Nota crédito | rechazados_2026/CreditNote/ |
| DebitNote | Nota débito | rechazados_2026/DebitNote/ |
| ApplicationResponse | Respuesta del sistema | rechazados_2026/ApplicationResponse/ |
| AttachedDocument | Documento adjunto | rechazados_2026/AttachedDocument/ |
| SinXML | Sin XML encontrado | rechazados_2026/SinXML/ |
| Unknown | No identificado | rechazados_2026/Unknown/ |

**Regla de prioridad:** Si un ZIP contiene múltiples XMLs, se aplica la jerarquía: Invoice > CreditNote > DebitNote > ApplicationResponse > otros.

### 4.3 Extracción de Metadatos

Del XML UBL 2.0 se extraen los siguientes campos:

| Campo | XPath UBL | Descripción |
|-------|-----------|-------------|
| nit_proveedor | cac:AccountingSupplierParty/cbc:CompanyID | NIT del proveedor |
| numero_factura | cbc:ID (solo dígitos) | Número de factura |
| valor_total | cac:LegalMonetaryTotal/cbc:PayableAmount | Valor a pagar |
| tipo_documento | Raíz del XML | Invoice, CreditNote, etc. |
| fecha_emision | cbc:IssueDate | Fecha de emisión |
| fecha_vencimiento | cbc:DueDate | Fecha de vencimiento |
| iva_facturado_proveedor | cac:TaxTotal/cbc:TaxAmount | IVA facturado |
| observaciones | cbc:Note | Observaciones |

**Casos especiales:**
- AttachedDocument con Invoice embebida en CDATA: se extrae el XML interno
- Namespaces XML: se eliminan para simplificar el parsing

### 4.4 Programación Automática (Cron)

| Slot | Hora (Colombia) | Ventana UTC | Acción |
|------|-----------------|-------------|--------|
| 06:00 | 6:00 AM | 4 PM ayer → 6 AM hoy | Descarga + clasificación + sincronización |
| 11:00 | 11:00 AM | 6 AM → 11 AM hoy | Descarga + clasificación + sincronización |
| 16:00 | 4:00 PM | 11 AM → 4 PM hoy | Descarga + clasificación + sincronización |

Cada ejecución:
1. Descarga correos nuevos en la ventana de tiempo
2. Clasifica los ZIPs descargados
3. Extrae metadatos XML
4. Sincroniza con la base de datos del backend (POST con token interno)
5. Registra en cron_log.json (últimas 50 ejecuciones)

### 4.5 Distribución a Usuarios Finales

**Descarga por semana (Web):**
- El usuario selecciona una semana
- Se genera un ZIP con todos los PDFs de esa semana
- Los archivos se renombran: `{fecha_emision}_{nit}_{numero}.pdf`

**Script PowerShell (Automatización Windows):**
- Se descarga desde el portal web
- Ejecuta sincronización incremental:
  1. Lista semanas disponibles en el servidor
  2. Compara con semanas ya descargadas localmente
  3. Descarga solo semanas nuevas
  4. Extrae PDFs en estructura de carpetas
- Destino: `C:\Users\{USER}\Documents\FacturasElectronicas`

### 4.6 Sincronización con Mercurio

**Objetivo:** Descargar documentos del portal contable Mercurio que están en estado WorkFlow Paso 1.

**Flujo:**
```
Login robótico en Mercurio (Playwright headless)
    → Navegar a BANDEJAS → WorkFlow
    → Filtrar por Paso = 1
    → Para cada documento en cada página:
        → Llamar servlet TraerImagen
        → Si devuelve PDF directo: guardar
        → Si devuelve HTML con link a EML: descargar EML
        → Extraer PDF del EML (puede estar en ZIP adjunto)
    → Almacenar PDFs en /tmp/mercurio/descargas/pdfs/
```

**Gestión de PDFs de Mercurio:**
- Listado de PDFs disponibles
- Descarga individual por nombre
- Descarga masiva (ZIP con todos los PDFs)

---

## 5. Reglas de Negocio

| # | Regla | Detalle |
|---|-------|---------|
| RN-01 | No se re-descargan correos ya procesados | Control por message_id en procesados.json |
| RN-02 | Unicidad de factura | Constraint: (tipo_documento, proveedor_nit, numero_factura) |
| RN-03 | La clasificación prioriza Invoice sobre otros tipos | Si un ZIP tiene Invoice y CreditNote, se clasifica como Invoice |
| RN-04 | Solo se curan Invoices | Otros tipos van a rechazados_2026/ |
| RN-05 | El cron no requiere autenticación de usuario | Usa token interno (X-Cron-Token) |
| RN-06 | Los PDFs de Mercurio se almacenan por radicado | Nombre: {radicado}.pdf |
| RN-07 | Documentos ya descargados de Mercurio se omiten | Verificación por existencia de archivo |
| RN-08 | Reintentos automáticos en Graph API | 3 intentos con backoff exponencial |

---

## 6. Interfaz de Usuario

La interfaz web se accede desde el portal principal en la sección de Facturación y ofrece:

### 6.1 Panel Principal
- **Descargar histórico**: ejecución manual con rango de fechas
- **Procesar**: clasificar ZIPs pendientes
- **Progreso en tiempo real**: SSE (Server-Sent Events) con logs línea a línea
- **Botón de abortar**: detiene la operación en curso

### 6.2 Consulta de Facturas
- Tabla con todas las facturas procesadas
- Campos: NIT, número, valor, tipo, fecha emisión, fecha vencimiento
- Ordenamiento por fecha de procesamiento

### 6.3 Descarga por Semana
- Lista de semanas disponibles con conteo de ZIPs y PDFs
- Descarga ZIP por semana seleccionada

### 6.4 Mercurio
- **Abrir Mercurio**: test de login con captura de pantalla
- **Sincronizar Mercurio**: pipeline completo con logs en tiempo real
- **Ver PDFs Mercurio**: listado y descarga individual
- **Descarga Masiva PDFs**: ZIP con todos los PDFs

### 6.5 Estadísticas y Cron
- Estadísticas de descarga por mes
- Historial de ejecuciones cron
- Descarga de script PowerShell / instalador Windows

---

## 7. Integraciones

| Sistema | Tipo | Protocolo | Propósito |
|---------|------|-----------|-----------|
| Microsoft Exchange | API | Microsoft Graph (OAuth2) | Descarga de correos con facturas |
| Mercurio | Web scraping | Playwright (HTTPS) | Descarga de documentos contables |
| Backend Django | API interna | HTTP + Token | Persistencia de facturas en BD |
| Usuario Windows | Script | PowerShell + HTTP | Sincronización local de PDFs |
