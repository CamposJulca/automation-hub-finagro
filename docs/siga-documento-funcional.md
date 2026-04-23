# SIGA — Documento Funcional

## Sistema Inteligente de Gestión Administrativa — Módulo Beneficios de Salud

**Versión:** 1.0  
**Fecha:** 2026-04-22  
**Módulo:** Beneficios de Salud (Medicina Prepagada)

---

## 1. Objetivo del Módulo

SIGA automatiza la gestión de beneficios de salud (medicina prepagada) para los empleados de Finagro. Consolida facturas de múltiples proveedores de salud, calcula la distribución 80/20 empresa-empleado, y genera reportes de nómina y conciliación.

---

## 2. Alcance

| Capacidad | Descripción |
|-----------|-------------|
| Carga de archivos | Recepción de facturas Excel de AXA Colpatria y Colsanitas |
| Detección automática | Identificación del proveedor por nombre de archivo o columnas |
| Validación | Verificación de cédulas, valores numéricos y consistencia aritmética |
| Consolidación | Esquema unificado multi-proveedor |
| Cálculo 80/20 | Distribución empresa/empleado con límite UVT |
| Reportería | Dashboard, novedades, causación, conciliación, informe EFR |
| Gestión pensionados | CRUD de pensionados y auxilios externos |

---

## 3. Actores

| Actor | Rol |
|-------|-----|
| Analista de nómina | Carga archivos, ejecuta cálculos, genera reportes |
| Administrador | Configura políticas 80/20, gestiona pensionados |
| Sistema Kactus | Fuente de datos de empleados (integración vía SQLite) |

---

## 4. Flujos Funcionales

### 4.1 Carga y Procesamiento de Facturas

```
Analista sube Excel (.xlsx/.xls)
    → Detección automática de proveedor (AXA / Colsanitas)
    → Lectura y normalización de columnas
    → Validación de registros (cédula, valores, aritmética)
    → Persistencia en BD con trazabilidad de errores por fila
    → Resumen: total registros, procesados, con error
```

**Reglas de validación:**

1. **Cédula**: no nula, no vacía → Error: `CEDULA_INVALIDA`
2. **Valores numéricos**: `valor_base`, `iva`, `valor_total` ≥ 0 → Error: `VALOR_INVALIDO`
3. **Verificación aritmética**: |valor_total - (valor_base - descuento + iva)| ≤ $1.00 COP → Estado: `ADVERTENCIA`
4. **Duplicados**: mismo (cédula, sub_contrato) → Advertencia: `CEDULA_DUPLICADA`

**Casos especiales:**
- Filas de ajuste Colsanitas (Cuota=0, Total<0): se marcan como `ADVERTENCIA`

### 4.2 Detección de Proveedor

El sistema detecta automáticamente el proveedor en dos niveles:

1. **Por nombre de archivo**: busca "AXA" o "COLSANITAS" (insensible a mayúsculas)
2. **Por columnas del Excel**: si el nombre no es concluyente, analiza las columnas presentes

### 4.3 Mapeo de Columnas

**AXA Colpatria:**

| Columna origen | Campo unificado |
|----------------|-----------------|
| SUB CTO | sub_contrato |
| NUMID | cedula_titular |
| NUMERO ID.BEN | cedula |
| NOMBRE | nombre |
| PARENTESCO | parentesco |
| SUBTOTAL | valor_base |
| IVA | iva |
| TOTAL | valor_total |

**Colsanitas:**

| Columna origen | Campo unificado |
|----------------|-----------------|
| Número de Familia | sub_contrato |
| Número de Documento | cedula |
| Apellidos + Nombres | nombre |
| Cuota | valor_base |
| Descuento Comercial | descuento |
| IVA | iva |
| Total Us | valor_total |

### 4.4 Cálculo de Planilla 80/20

El cálculo distribuye el costo de medicina prepagada entre empresa y empleado según la política vigente:

```
valor_empresa    = total_familia × porcentaje_empresa / 100
valor_empleado   = total_familia × porcentaje_empleado / 100
apoyo_no_gravable = min(valor_empresa, uvt_limite × valor_uvt)
apoyo_gravable    = max(0, valor_empresa - apoyo_no_gravable)
```

**Parámetros de política:**
- `porcentaje_empresa`: porcentaje que asume la empresa (ej: 80%)
- `porcentaje_empleado`: porcentaje que asume el empleado (ej: 20%)
- `uvt_limite`: número de UVTs para límite no gravable
- `valor_uvt`: valor monetario de la UVT vigente
- `porcentaje_empresa_pensionado`: porcentaje especial para pensionados

### 4.5 Comparación de Novedades

Compara dos archivos (período nuevo vs anterior) e identifica:
- **Ingresos**: beneficiarios nuevos (presentes solo en archivo nuevo)
- **Retiros**: beneficiarios retirados (presentes solo en archivo anterior)
- **Cambios de valor**: beneficiarios con diferencia en valor_total

### 4.6 Reportes

| Reporte | Descripción | Parámetros |
|---------|-------------|------------|
| Dashboard | Resumen ejecutivo: conteos, montos por proveedor, evolución | Ninguno |
| Novedades | Ingresos, retiros y cambios entre dos períodos | archivo_nuevo, archivo_anterior |
| Causación | Resumen por EPS para un período | periodo (MMYYYY) |
| Conciliación | Comparación período a período de planilla | periodo_nuevo, periodo_anterior |
| Informe EFR | Reporte mensual: planilla + pensionados + auxilio externo | periodo (MMYYYY) |
| Exportar Excel | Libro consolidado multi-hoja (Consolidado, AXA, Colsanitas) | Filtros opcionales |

---

## 5. Gestión de Pensionados y Auxilio Externo

### 5.1 Pensionados
Registro de pensionados con medicina prepagada cubierta parcialmente por la empresa:
- Cédula, nombre, EPS, valor mensual
- Fechas de inicio/fin, estado activo
- Observaciones

### 5.2 Auxilio Externo
Registro de auxilios de salud para personal con cobertura externa:
- Mismos campos que pensionados
- Gestión independiente (CRUD completo)

---

## 6. Integración con Kactus

SIGA se conecta con el sistema de nómina Kactus mediante una base de datos SQLite (`prepagada.db`) que contiene:

- **Tabla `facturas_eps`**: datos de facturación por EPS y período
- **Vista `v_cruce`**: cruce de beneficiarios con empleados activos en Kactus
- **Datos de empleados**: cédula, nombre, tipo de contrato, salario básico

El cruce permite:
- Validar que los beneficiarios facturados corresponden a empleados activos
- Identificar el estado del cruce: `OK`, `SIN_KACTUS`, `SIN_FACTURA`
- Obtener datos de nómina necesarios para el cálculo de planilla

---

## 7. Interfaz de Usuario

La interfaz web se accede desde el portal principal en la ruta `/siga` y ofrece:

1. **Zona de carga**: arrastrar y soltar archivos Excel
2. **Lista de archivos**: historial de cargas con estado y estadísticas
3. **Vista detalle**: errores de procesamiento por fila
4. **Buscador de beneficiarios**: consulta por cédula
5. **Módulo de cruce**: visualización de cruce con Kactus
6. **Calculadora de planilla**: ejecución del cálculo 80/20
7. **Panel de reportes**: causación, conciliación, informe EFR
8. **Gestión de maestros**: políticas, pensionados, auxilios externos

---

## 8. Reglas de Negocio

| # | Regla | Detalle |
|---|-------|---------|
| RN-01 | Un archivo no puede cargarse dos veces | Se verifica por hash SHA-256 |
| RN-02 | La tolerancia aritmética es ±$1.00 COP | Diferencias mayores generan advertencia |
| RN-03 | Los duplicados por (cédula, sub_contrato) se registran como advertencia | No se eliminan |
| RN-04 | El cálculo 80/20 usa la política vigente más reciente | Campo `vigente_desde` |
| RN-05 | El apoyo no gravable no puede exceder el límite UVT | `uvt_limite × valor_uvt` |
| RN-06 | Pensionados tienen un porcentaje empresa diferenciado | `porcentaje_empresa_pensionado` |
| RN-07 | Solo se soportan proveedores AXA Colpatria y Colsanitas | Otros generan error |
| RN-08 | Los archivos .xls y .xlsx son soportados | Detección automática de formato |
