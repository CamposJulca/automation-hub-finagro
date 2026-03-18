# ICR — Resumen Ejecutivo de Datos Demo (Ambiente de Pruebas)

> **Estado:** Datos ficticios cargados para validación del flujo completo.
> **Fecha:** Marzo 2026

---

## Contratos configurados

| Código | Nombre | Tipo | Presupuesto Total | Vigencia |
|--------|--------|------|-------------------|----------|
| `ICR-2026-NAL-001` | Contrato Nacional Agropecuario 2026 | Nacional | $15.000.000.000 | Ene–Dic 2026 |
| `ICR-2026-COMP-001` | Contrato Complementario Café y Cacao 2026 | Complementario | $5.000.000.000 | Ene–Dic 2026 |

---

## Bolsas presupuestales

| Código | Nombre | Contrato | Presupuesto | Inscripción Automática |
|--------|--------|----------|-------------|------------------------|
| B1 | Bolsa Ganadería y Agricultura | NAL-001 | $8.000.000.000 | No (manual) |
| B2 | Bolsa Pequeños Productores | NAL-001 | $7.000.000.000 | **Sí (automática)** |
| B1 | Bolsa Café y Cacao | COMP-001 | $5.000.000.000 | No (manual) |

> La bolsa B2 tiene `inscripcion_automatica = True`, lo que significa que al preinscribir,
> las operaciones elegibles pasan directo a estado **inscrita** sin paso manual de formalización.

---

## Reglas de elegibilidad

### Bolsa Ganadería y Agricultura (NAL-001 / B1)
| Tipo de regla | Parámetro |
|---------------|-----------|
| Tipo de productor | mediano, grande |
| Valor mínimo de crédito | $50.000.000 |
| Valor máximo de crédito | $2.135.250.000 |
| Fecha de vigencia | 2026-01-01 a 2026-12-31 |
| Actividades permitidas | ganadería, agricultura, porcicultura, avicultura |

### Bolsa Pequeños Productores (NAL-001 / B2)
| Tipo de regla | Parámetro |
|---------------|-----------|
| Tipo de productor | pequeño |
| Valor mínimo de crédito | $5.000.000 |
| Valor máximo de crédito | $500.000.000 |
| Fecha de vigencia | 2026-01-01 a 2026-12-31 |
| Actividades permitidas | agricultura, horticultura, fruticultura, acuicultura |

### Bolsa Café y Cacao (COMP-001 / B1)
| Tipo de regla | Parámetro |
|---------------|-----------|
| Tipo de productor | pequeño, mediano |
| Valor mínimo de crédito | $10.000.000 |
| Fecha de vigencia | 2026-01-01 a 2026-12-31 |
| Actividades permitidas | café, cacao, caficultura, cacaocultura |
| Departamentos | Antioquia, Huila, Nariño, Cauca, Tolima, Risaralda, Caldas, Quindío |

---

## Porcentajes ICR por tipo de productor

| Bolsa | Tipo productor | % ICR | Tope UVB | Valor UVB |
|-------|---------------|-------|----------|-----------|
| NAL-001 / B1 | Mediano | 35% | 1.500 UVB | $1.423.500 |
| NAL-001 / B1 | Grande | 20% | 1.500 UVB | $1.423.500 |
| COMP-001 / B1 | Pequeño | 40% | 8.700 UVB | $1.423.500 |
| COMP-001 / B1 | Mediano | 30% | 3.000 UVB | $1.423.500 |
| NAL-001 / B2 | Pequeño | 40% | 8.700 UVB | $1.423.500 |

---

## Inscripciones de prueba (15 operaciones)

### Resumen por estado

| Estado | Operaciones | Valor crédito | Valor ICR |
|--------|-------------|---------------|-----------|
| Inscrita | 9 | $825.000.000 | $293.000.000 |
| Preinscrita | 3 | $1.250.000.000 | $317.500.000 |
| Anulada | 1 | $1.200.000.000 | — |
| No elegible | 2 | $53.000.000 | — |
| **Total** | **15** | **$3.328.000.000** | **$293.000.000** |

### Detalle completo

| ID | AGROS | Productor | Actividad | Municipio / Dpto. | Crédito | Bolsa | % ICR | Valor ICR | Estado | Consecutivo | Nota |
|----|-------|-----------|-----------|-------------------|---------|-------|-------|-----------|--------|-------------|------|
| 1 | AGROS-2026-00001 | Mediano | Ganadería | Medellín / Antioquia | $300.000.000 | NAL B1 | 35% | $105.000.000 | Preinscrita | — | |
| 2 | AGROS-2026-00002 | Grande | Agricultura | Bogotá / Cundinamarca | $800.000.000 | NAL B1 | 20% | $160.000.000 | Preinscrita | — | |
| 3 | AGROS-2026-00003 | Mediano | Porcicultura | Cali / Valle del Cauca | $150.000.000 | NAL B1 | 35% | $52.500.000 | Preinscrita | — | |
| 4 | AGROS-2026-00004 | Grande | Avicultura | Bucaramanga / Santander | $1.200.000.000 | NAL B1 | 20% | $240.000.000 | **Anulada** | — | |
| 5 | AGROS-2026-00005 | Mediano | Ganadería | Tunja / Boyacá | $45.000.000 | — | — | — | **No elegible** | — | Crédito < $50M (mínimo B1) |
| 6 | AGROS-2026-00006 | Pequeño | Agricultura | Pasto / Nariño | $25.000.000 | NAL B2 | 40% | $10.000.000 | Inscrita | 26-000005 | Auto-inscrita |
| 7 | AGROS-2026-00007 | Pequeño | Horticultura | Duitama / Boyacá | $80.000.000 | NAL B2 | 40% | $32.000.000 | Inscrita | 26-000004 | Auto-inscrita |
| 8 | AGROS-2026-00008 | Pequeño | Fruticultura | Zipaquirá / Cundinamarca | $15.000.000 | NAL B2 | 40% | $6.000.000 | Inscrita | 26-000003 | Auto-inscrita |
| 9 | AGROS-2026-00009 | Pequeño | Acuicultura | Neiva / Huila | $40.000.000 | NAL B2 | 40% | $16.000.000 | Inscrita | 26-000002 | Auto-inscrita |
| 10 | AGROS-2026-00010 | Pequeño | Agricultura | Ibagué / Tolima | $200.000.000 | NAL B2 | 40% | $80.000.000 | Inscrita | 26-000001 | Auto-inscrita |
| 11 | AGROS-2026-00011 | Pequeño | Caficultura | Andes / Antioquia | $35.000.000 | COMP B1 | 40% | $14.000.000 | Inscrita | 26-000009 | Manual |
| 12 | AGROS-2026-00012 | Mediano | Café | Pitalito / Huila | $120.000.000 | COMP B1 | 30% | $36.000.000 | Inscrita | 26-000008 | Manual |
| 13 | AGROS-2026-00013 | Pequeño | Cacao | Chaparral / Tolima | $60.000.000 | COMP B1 | 40% | $24.000.000 | Inscrita | 26-000007 | Manual |
| 14 | AGROS-2026-00014 | Mediano | Cacaocultura | La Unión / Nariño | $250.000.000 | COMP B1 | 30% | $75.000.000 | Inscrita | 26-000006 | Manual |
| 15 | AGROS-2026-00015 | Pequeño | Café | Chinchiná / Caldas | $8.000.000 | — | — | — | **No elegible** | — | Crédito < $10M (mínimo COMP B1) |

---

## Motor de reglas de negocio

El motor (`BolsaRuleEngine`) es **dinámico y basado en base de datos**: no tiene reglas
hardcodeadas. Lee las `ReglaICR` y `PorcentajeICR` configuradas por bolsa en tiempo de
ejecución.

### Tipos de regla disponibles

Cada bolsa puede tener **N reglas activas** evaluadas en orden (`orden` ASC). La operación
es elegible solo si **todas las reglas pasan** (AND lógico).

| Tipo | Parámetro (campo `parametro`) | Lógica de evaluación |
|------|-------------------------------|----------------------|
| `tipo_productor` | Lista separada por coma. Ej: `pequeño,mediano` | `ins.tipo_productor IN [valores]` |
| `valor_minimo` | Número decimal. Ej: `50000000` | `ins.valor_credito >= parametro` |
| `valor_maximo` | Número decimal. Ej: `2135250000` | `ins.valor_credito <= parametro` |
| `fecha_vigencia` | Rango ISO separado por coma. Ej: `2026-01-01,2026-12-31` | `inicio <= ins.fecha_credito <= fin` |
| `actividad` | Palabras clave separadas por coma. Ej: `café,cacao,caficultura` | Coincidencia parcial (contiene) contra `ins.actividad` |
| `municipio` | Municipios y/o departamentos por coma. Ej: `antioquia,huila` | Coincidencia parcial contra `ins.municipio` **o** `ins.departamento` |

> **Tipo desconocido:** si se configura un tipo no reconocido, el motor lo deja pasar
> (`True`) sin bloquear, para garantizar compatibilidad futura.

### Cálculo del incentivo ICR

Cuando una operación pasa **todas** las reglas de una bolsa, el motor calcula el incentivo
así:

```
valor_base   = min(ins.valor_credito, tope_uvb × valor_uvb)
valor_icr    = porcentaje × valor_base
```

El **tope UVB** limita el valor del crédito elegible para evitar subsidios sobre montos
excesivos. Ejemplo con pequeño productor (40%, tope 8.700 UVB, UVB = $1.423.500):

```
tope_valor_credito = 8.700 × $1.423.500 = $12.384.450.000
→ cualquier crédito ≤ ese tope paga ICR sobre el valor completo
```

### Selección de bolsa (preinscripción)

El motor recorre las bolsas activas **en el orden que retorna el queryset** y asigna la
operación a la **primera bolsa que cumple todas sus reglas Y tiene presupuesto disponible**:

```python
for bolsa in bolsas_activas:
    if bolsa.valor_disponible <= 0:
        continue          # bolsa sin presupuesto → saltar
    if todas_las_reglas_pasan(operacion, bolsa):
        asignar(operacion, bolsa)
        break             # primera que aplica, no busca más
→ si ninguna aplica: estado = 'no_elegible'
```

### Inscripción automática vs. manual

| Bolsa | `inscripcion_automatica` | Resultado tras preinscribir |
|-------|--------------------------|-----------------------------|
| `False` (manual) | Requiere paso explícito de formalización | Estado → `preinscrita` |
| `True` (automática) | Se formaliza en el mismo paso | Estado → `inscrita` + consecutivo generado |

### Consecutivo

Se genera como `YY-NNNNNN` (año 2 dígitos + secuencial 6 dígitos con ceros a la izquierda).
Ejemplo: `26-000001`. Se asigna en el momento de formalizar (manual o automático) y no
puede modificarse después.

### Auditoría de reglas

Cada evaluación persiste en `EvaluacionRegla`:

| Campo | Descripción |
|-------|-------------|
| `inscripcion` | Operación evaluada |
| `regla` | Regla evaluada |
| `valor_evaluado` | Valor concreto que se comparó (ej. `$300.000.000,00`) |
| `resultado` | `True` / `False` |
| `evaluado_en` | Timestamp |

---

## Qué flujos están validados

- [x] **Importar operaciones** desde Excel/CSV → estado `sin_evaluar`
- [x] **Preinscribir** → evalúa reglas, asigna bolsa y calcula ICR
- [x] **Inscripción automática** (bolsa B2) → pasa directo a `inscrita` con consecutivo
- [x] **Formalizar** (bolsas manuales) → de `preinscrita` a `inscrita` con consecutivo
- [x] **Anular** → registra motivo y marca como `anulada`
- [x] **No elegibilidad** → opera. 5 (crédito bajo para B1) y op. 15 (crédito bajo para COMP B1)
- [x] **Dashboard de KPIs** → totales por estado y ejecución presupuestal por bolsa
- [x] **Auditoría de reglas** → trazabilidad de evaluación por operación

---

## Intermediarios financieros en los datos demo

- Banco Agrario (mayoría)
- Bancolombia
- BBVA
- Davivienda

---

> **Nota:** Todos los datos (nombres, montos, municipios, fechas) son ficticios y de uso
> exclusivo para pruebas del sistema. No corresponden a operaciones reales de Finagro.
