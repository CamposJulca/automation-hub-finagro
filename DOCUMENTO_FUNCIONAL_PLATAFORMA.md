# Automation Hub Finagro
## Plataforma de Automatización Institucional
### Del proceso manual disperso a la operación institucional inteligente y centralizada.

---

## ¿Qué es Automation Hub Finagro?

**Automation Hub Finagro** es la plataforma tecnológica central que concentra, orquesta y automatiza los procesos operativos críticos de la institución que históricamente se ejecutaban de forma manual, dispersa y sin trazabilidad.

No es un sistema de gestión de documentos ni un portal informativo. Es un **hub de automatización**: un núcleo donde cada proceso institucional relevante tiene un módulo dedicado que lo ejecuta, lo valida, lo registra y lo pone a disposición del equipo en tiempo real, sin depender de la intervención manual de un funcionario para cada paso.

El sistema está diseñado para crecer. Cada nuevo proceso susceptible de automatización puede incorporarse como un módulo adicional dentro de la misma plataforma, sin afectar los módulos existentes.

---

## El Desafío Institucional

Finagro opera procesos institucionales críticos que involucran grandes volúmenes de datos, múltiples fuentes externas y requisitos regulatorios estrictos. Antes de Automation Hub, estos procesos compartían el mismo patrón de riesgos:

- **Dependencia del analista:** Cada proceso dependía del criterio, la disponibilidad y la velocidad de la persona asignada. La operación se detenía cuando esa persona no estaba disponible.
- **Sin trazabilidad:** No existía registro sistemático de quién procesó qué, cuándo ni con qué resultado. Las auditorías internas requerían reconstruir manualmente el historial.
- **Sin estandarización:** Cada área tenía su propio esquema de trabajo: hojas de cálculo locales, correos sin protocolo, archivos sin versionamiento. La misma operación podía ejecutarse de forma diferente cada mes.
- **Sin consolidación:** Los resultados de distintas fuentes (proveedores, sistemas externos, entidades regulatorias) se unificaban manualmente, con riesgo de errores de mapeo, duplicidades y pérdida de información.

---

## Propuesta de Valor

Automation Hub Finagro centraliza en un único portal web los procesos que antes requerían múltiples herramientas, múltiples personas y múltiples horas. Cada módulo automatiza un flujo completo: desde la recepción del dato de entrada hasta la generación del resultado listo para uso institucional.

El sistema garantiza que **el mismo proceso se ejecute de la misma manera cada vez**, con validación automática, registro de errores, trazabilidad completa y resultados disponibles en segundos, no en horas.

---

## Módulos Activos

### 1. Facturación Electrónica (FactIA)

**¿Qué automatiza?**
La gestión de facturas electrónicas que los proveedores envían al buzón `facturacion@finagro.com.co`. El módulo se conecta a Microsoft 365, descarga los archivos ZIP adjuntos, clasifica los documentos según el estándar DIAN (facturas, notas crédito, respuestas de la DIAN) y extrae automáticamente los metadatos de cada factura válida: NIT del proveedor, número, valor, IVA y fechas.

**¿Qué entrega?**
Un registro consolidado de todas las facturas recibidas, disponible para consulta desde el portal y exportable para el proceso contable. El pipeline corre automáticamente tres veces al día (6:00 AM, 11:00 AM y 4:00 PM hora Bogotá).

**Problema que resuelve:** Eliminación de la descarga manual de correos, descompresión artesanal de ZIPs y transcripción de datos de facturas XML.

---

### 2. SARLAFT — Control de Riesgo

**¿Qué automatiza?**
La consulta de representantes legales y vinculados de empresas a través de los certificados de existencia y representación legal de la Cámara de Comercio. El módulo procesa el PDF del certificado, extrae mediante inteligencia artificial los datos de la empresa (nombre, NIT, representantes, roles y documentos de identidad) y los prepara para verificación contra listas restrictivas.

**¿Qué entrega?**
Un registro estructurado de los representantes extraídos del certificado, listo para el proceso de validación de SARLAFT sin digitación manual.

**Problema que resuelve:** Eliminación de la lectura manual de certificados PDF y la transcripción de datos de representantes para los procesos de debida diligencia.

---

### 3. ICR — Incentivo a la Capitalización Rural

**¿Qué automatiza?**
El ciclo completo de gestión del Incentivo a la Capitalización Rural: importación de contratos desde AGROS, configuración de bolsas de incentivo, aplicación de reglas de elegibilidad, preinscripción de operaciones, formalización y generación del consecutivo institucional. El módulo cuenta con un motor de reglas configurable que evalúa automáticamente si cada operación cumple los criterios de la bolsa vigente.

**¿Qué entrega?**
Un registro completo del ciclo de vida de cada inscripción ICR: desde la importación del contrato hasta la formalización, con trazabilidad de auditoría en cada etapa y un panel de KPIs en tiempo real.

**Problema que resuelve:** Eliminación de la evaluación manual de elegibilidad operación por operación, la generación manual de consecutivos y la dispersión del historial de inscripciones en hojas de cálculo.

---

### 4. SIGA — Beneficios de Salud

**¿Qué automatiza?**
La conciliación mensual de los archivos de facturación de las aseguradoras de salud (AXA Colpatria y Colsanitas). El módulo recibe los archivos Excel de cada proveedor, detecta automáticamente su estructura, normaliza los esquemas heterogéneos a un formato unificado, valida la integridad de cada registro y calcula la liquidación de medicina prepagada bajo el modelo 80/20 (empresa/empleado) con base en la política institucional vigente y los límites de UVT aplicables.

**¿Qué entrega?**
Un registro consolidado de todos los beneficiarios activos por período, un reporte exportable en Excel con tres hojas (Consolidado, AXA, Colsanitas) y la planilla de liquidación 80/20 con los códigos contables correspondientes.

**Problema que resuelve:** Eliminación de la conciliación manual de dos archivos con estructuras distintas, la validación artesanal de valores y la liquidación de prepagada en hojas de cálculo externas sin control de UVT.

---

### 5. Innovación — Priorización de Automatizaciones

**¿Qué automatiza?**
La priorización objetiva de necesidades de automatización institucional. El módulo aplica un modelo de scoring configurable que pondera cuatro dimensiones de cada proceso candidato: frecuencia de ejecución, duración del proceso, nivel de riesgo operativo y alineación con objetivos estratégicos.

**¿Qué entrega?**
Un ranking ordenado de los procesos con mayor potencial de automatización, con puntaje calculado y justificación por dimensión, como insumo para la planeación del portafolio de TI.

**Problema que resuelve:** Eliminación de la priorización subjetiva o por demanda de los proyectos de automatización.

---

## Arquitectura General

```
                    ┌─────────────────────────────────────┐
                    │        AUTOMATION HUB FINAGRO        │
                    │     Portal web centralizado          │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                         │
          ▼                        ▼                         ▼
  ┌──────────────┐       ┌──────────────────┐      ┌──────────────────┐
  │   Frontend   │       │  Backend Django   │      │  Servicios       │
  │   React SPA  │◄─────►│  API REST        │◄────►│  Especializados  │
  │  (Nginx)     │       │  (Gunicorn)      │      │                  │
  └──────────────┘       └────────┬─────────┘      │ · FactIA (Flask) │
                                  │                 │ · NLP Cámara     │
                                  ▼                 │ · SIGA (Django)  │
                         ┌──────────────┐           │ · SARLAFT        │
                         │  PostgreSQL  │           └──────────────────┘
                         │  Base de     │
                         │  datos       │
                         └──────────────┘
```

**El portal web** es el punto de acceso único para todos los módulos. Cada módulo tiene su propia sección dentro del portal, accesible desde la barra de navegación lateral.

**El backend Django** expone una API REST que conecta el portal con la lógica de negocio y la base de datos institucional.

**Los servicios especializados** son microservicios independientes que ejecutan operaciones de alta complejidad (procesamiento de PDFs, descarga de correos, cálculos de nómina) y son invocados por el backend según sea necesario.

---

## Acceso y Módulos por Portal

El sistema está disponible a través de cinco portales diferenciados, cada uno con un dominio dedicado:

| Portal | Módulo principal | Acceso |
|---|---|---|
| `automation-hub-finagro` | Dashboard general + todos los módulos | Abierto (autenticación por módulo) |
| `facturacion-electronica` | Facturación Electrónica DIAN | Abierto |
| `sarlaft` | Control de Riesgo SARLAFT | Requiere usuario y contraseña |
| `gestion-administrativa` | Gestión Administrativa | En desarrollo |
| `mesa-ayuda` | Mesa de Ayuda | En desarrollo |

---

## Principios de Diseño

- **Un solo punto de entrada:** El analista accede a todos los procesos desde un único portal, sin instalar software ni gestionar múltiples sistemas.
- **Trazabilidad por defecto:** Cada operación queda registrada: quién la ejecutó, cuándo, con qué resultado y con qué datos de entrada.
- **Fallo visible, no silencioso:** Los errores son clasificados, descritos y disponibles para revisión. Ningún dato inválido entra al sistema sin registro de causa.
- **Modular y extensible:** Cada proceso es un módulo independiente. Agregar un nuevo proceso no afecta los existentes.
- **Automatización primero, intervención por excepción:** El sistema opera autónomamente. El funcionario interviene solo para revisar resultados o resolver casos excepcionales.
