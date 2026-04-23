# Facturación Electrónica — Documentación del Dashboard

**Módulo:** Facturación Electrónica DIAN  
**URL:** `https://automation-hub-finagro.ngrok.io/facturacion`  
**Autenticación:** Credenciales de Django Admin (Basic Auth)

---

## 1. Banner superior

El banner muestra el título del módulo y dos métricas globales:

| Métrica | Descripción |
|---------|-------------|
| **Facturas** | Cantidad total de registros de facturas electrónicas almacenados en la base de datos PostgreSQL (tabla `facturacion_facturaelectronica`). |
| **Valor total** | Suma del campo `valor_factura` de todos los registros, expresado en millones de pesos colombianos (ej: `$1.250M`). |

**Fuente de datos:** `GET /api/facturacion/facturas/` → campo `total` y suma calculada en frontend con `totalValor(facturas)`.

---

## 2. Tarjetas KPI (fila de 4 tarjetas)

Inmediatamente debajo del banner hay una fila de 4 tarjetas con indicadores clave:

### 2.1 Total facturas

| Propiedad | Detalle |
|-----------|---------|
| **Icono** | 🧾 (fondo azul claro `#e3f2fd`) |
| **Valor** | Número total de facturas en la base de datos |
| **Fuente** | `GET /api/facturacion/facturas/` → `response.total` |
| **Qué cuenta** | Todas las facturas electrónicas persistidas en BD, incluyendo tipos: Factura Electrónica, Nota Crédito, Nota Débito, Sin XML y Desconocido |

### 2.2 Facturas en FactIA

| Propiedad | Detalle |
|-----------|---------|
| **Icono** | 📦 (fondo púrpura claro `#f3e5f5`) |
| **Valor** | Número de facturas extraídas por el servicio FactIA |
| **Fuente** | `GET /api/facturacion/stats/` → `response.total_facturas_extraidas` |
| **Qué cuenta** | Cantidad de facturas que el microservicio FactIA (Flask) ha logrado extraer de los archivos XML dentro de los ZIPs descargados del correo `facturacion@finagro.com.co`. Este número puede diferir del total en BD porque: (a) algunas facturas pueden no haberse sincronizado aún a la BD, o (b) pueden existir registros en BD de ejecuciones anteriores que ya no están en FactIA |

### 2.3 Valor total

| Propiedad | Detalle |
|-----------|---------|
| **Icono** | 💰 (fondo verde claro `#e8f5e9`) |
| **Valor** | Suma de `valor_factura` de todas las facturas en BD, formateado en pesos colombianos (ej: `$1.234.567`) |
| **Fuente** | Calculado en frontend: `facturas.reduce(suma de valor_factura)` |
| **Qué representa** | El valor bruto total facturado por todos los proveedores registrados. Incluye facturas electrónicas, notas crédito y notas débito. No es un neto (no resta notas crédito del total) |

### 2.4 Sin fecha emisión

| Propiedad | Detalle |
|-----------|---------|
| **Icono** | ⚠️ (fondo amarillo `#fff8e1`) si hay facturas sin fecha; ✅ (fondo gris) si todas tienen fecha |
| **Valor** | Cantidad de facturas donde `fecha_emision` es `null` |
| **Fuente** | Calculado en frontend: `facturas.filter(f => !f.fecha_emision).length` |
| **Interacción** | Si el valor es > 0, la tarjeta es **clickeable**. Al hacer clic abre un modal (`SinFechaModal`) que lista las facturas sin fecha de emisión, mostrando: NIT del proveedor, número de factura, valor, y el nombre del ZIP de origen |
| **Por qué importa** | Las facturas sin fecha de emisión no pueden agruparse correctamente en los reportes por mes. Generalmente corresponden a ZIPs que contenían XMLs malformados o archivos clasificados como `SinXML` |

---

## 3. Valor facturado por mes (tarjetas horizontales)

Debajo de los KPIs hay una fila horizontal scrolleable de tarjetas, una por cada mes:

| Propiedad | Detalle |
|-----------|---------|
| **Agrupación** | Por el campo `fecha_emision` (YYYY-MM). Las facturas sin fecha se agrupan bajo "Sin fecha" |
| **Valor mostrado** | Suma de `valor_factura` para ese mes, en millones (ej: `$245M`) |
| **Barra de progreso** | Proporción relativa al mes con mayor valor (el mes más alto = 100%) |
| **Conteo** | Número de facturas en ese mes (ej: "23 facturas") |
| **Orden** | Cronológico ascendente (enero → diciembre) |
| **Fuente** | Calculado en frontend agrupando `facturas` por `fecha_emision.slice(0,7)` |

---

## 4. Tareas programadas (3 tarjetas)

Tres tarjetas muestran el estado de las ejecuciones automáticas del cron:

| Slot | Horario | Rango de correos que procesa |
|------|---------|------------------------------|
| 🌅 **6:00 AM** | Inicio de jornada | Correos recibidos entre las 4:00 PM del día anterior y las 6:00 AM de hoy |
| ☀️ **11:00 AM** | Media mañana | Correos recibidos entre las 6:00 AM y las 11:00 AM de hoy |
| 🌆 **4:00 PM** | Cierre de tarde | Correos recibidos entre las 11:00 AM y las 4:00 PM de hoy |

**Cada tarjeta muestra:**

| Campo | Descripción |
|-------|-------------|
| **Estado** | Badge `✓ OK` (verde), `✗ ERROR` (rojo) o `Pendiente` (gris) |
| **Última ejecución** | Fecha y hora de la última vez que corrió el cron para ese slot |
| **Correos encontrados** | Cantidad de mensajes del buzón que fueron procesados en esa ejecución (`mensajes_procesados`) |
| **Facturas guardadas** | Cantidad de facturas nuevas que se persistieron en la BD en esa ejecución (`facturas_guardadas`) |

**Fuente de datos:** `GET /api/facturacion/cron-log/` → proxy a FactIA (`GET /api/cron-log/`). El cron corre de lunes a viernes automáticamente desde el servicio FactIA.

**Flujo del cron:**
1. FactIA ejecuta la descarga de correos para el rango de fechas del slot
2. FactIA clasifica y extrae metadata de los ZIPs descargados
3. FactIA llama a `POST /api/facturacion/sincronizar-cron/` (backend Django) con un token interno para persistir las facturas en BD
4. El resultado se registra en `cron_log.json` dentro del volumen de FactIA

---

## 5. Cobertura de descarga (tabla)

Tabla que muestra cuántos ZIPs se han descargado por mes desde el buzón:

| Columna | Descripción |
|---------|-------------|
| **Mes** | Mes y año (ej: "Enero 2026") |
| **ZIPs** | Cantidad de archivos ZIP descargados para ese mes |
| **Correos** | Cantidad de correos que contenían al menos un ZIP adjunto |
| **Barra** | Proporción visual relativa al mes con más ZIPs |

**Fila de totales:**

| Campo | Descripción |
|-------|-------------|
| **Total ZIPs** | Suma de todos los ZIPs descargados en el histórico |
| **Rango de fechas** | Fecha del correo más antiguo → fecha del más reciente |
| **Pipeline resumen** | `X ZIPs descargados → Y facturas extraídas por FactIA → Z guardadas en BD` |

**Fuente de datos:** `GET /api/facturacion/stats/` → proxy a FactIA (`GET /api/stats/`). Los datos incluyen:
- `por_mes[]`: array con `{mes, zips, correos}` por cada mes
- `total_zips`: total de ZIPs
- `total_con_zip`: total de correos con ZIP
- `total_facturas_extraidas`: facturas que FactIA extrajo de los XMLs
- `fecha_min`, `fecha_max`: rango de fechas cubierto

---

## 6. Modelo de datos

Las facturas se almacenan en la tabla `facturacion_facturaelectronica`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipo_documento` | CharField(30) | Tipo: `Invoice`, `CreditNote`, `DebitNote`, `SinXML`, `Unknown` |
| `proveedor_nit` | CharField(50) | NIT del proveedor emisor |
| `numero_factura` | CharField(500) | Número de la factura electrónica |
| `codigo` | CharField(20) | Código interno de la factura |
| `valor_factura` | Decimal(18,2) | Valor bruto de la factura en COP |
| `iva_facturado_proveedor` | Decimal(18,2) | IVA facturado |
| `fecha_emision` | Date (nullable) | Fecha de emisión de la factura |
| `fecha_vencimiento` | Date (nullable) | Fecha de vencimiento |
| `observaciones` | TextField | Notas adicionales |
| `archivo` | CharField(1000) | Ruta del archivo XML fuente |
| `procesado_en` | DateTime (auto) | Timestamp de cuándo se persistió en BD |

**Clave única:** `(tipo_documento, proveedor_nit, numero_factura)` — evita duplicados al re-procesar.

---

## 7. Flujo de datos completo

```
Buzón facturacion@finagro.com.co
        │
        ▼ (Microsoft Graph API)
  FactIA descarga correos con ZIPs
        │
        ▼ (Clasificación + XML parsing)
  FactIA extrae metadata de facturas
        │
        ▼ (POST /sincronizar-cron/ o botón "Procesar")
  Backend Django persiste en PostgreSQL
        │
        ▼ (GET /facturas/ + GET /stats/)
  Frontend calcula y muestra KPIs, tarjetas y tablas
```

---

## 8. Endpoints que alimentan el dashboard

| Endpoint | Método | Qué devuelve |
|----------|--------|-------------|
| `/api/facturacion/facturas/` | GET | Lista completa de facturas en BD + total |
| `/api/facturacion/stats/` | GET | Estadísticas de descarga: ZIPs por mes, totales, rango de fechas |
| `/api/facturacion/cron-log/` | GET | Historial de ejecuciones automáticas del cron |
