# Requerimiento de Recursos de Servidor

## Plataforma Automation Hub - FINAGRO

**Fecha de elaboración:** 24 de abril de 2026
**Elaborado por:** Dirección de Planeación Financiera - Equipo de Innovación y Tecnología
**Versión:** 1.0
**Estado:** Borrador para revisión

---

## 1. Objetivo del Documento

El presente documento tiene como finalidad detallar la **proyección de recursos computacionales** requeridos en el servidor de FINAGRO para soportar la implementación de **13 procesos de automatización** identificados en la Matriz de Innovación (marzo 2026). Estos procesos serán integrados al aplicativo **Automation Hub**, plataforma centralizada de automatización de procesos de la entidad.

El objetivo es proporcionar a la Dirección de Tecnología la información técnica necesaria para dimensionar, aprovisionar y configurar la infraestructura que soporte tanto los servicios actualmente en producción como los nuevos módulos planificados.

---

## 2. Contexto y Justificación

### 2.1 Situación Actual

Actualmente, la plataforma **Automation Hub** se encuentra en operación con los siguientes módulos desplegados mediante contenedores Docker:

| Servicio | Tecnología | Puerto Expuesto | Función |
|----------|-----------|-----------------|---------|
| Portal Principal | React 19 + Nginx | `9000` | Dashboard central, navegación entre módulos |
| Facturación Electrónica | React + Django + FactIA | `9001` | Descarga, procesamiento y sincronización de facturas electrónicas con Mercurio |
| SARLAFT | React + Django (independiente) + NLP-Cámara | `9002` | Verificación de listas restrictivas, análisis NLP de certificados de Cámara de Comercio |
| Gestión Administrativa | React + Django | `9003` | Módulo de gestión administrativa general |
| Mesa de Ayuda | React + Django | `9004` | Sistema interno de tickets y soporte |
| SIGA (Salud) | Django (independiente) | Interno | Gestión de beneficios de salud para empleados |
| ICR | Django (módulo backend) | Interno vía API | Módulo de Incentivo a la Capitalización Rural |

### 2.2 Stack Tecnológico Actual

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Frontend** | React (SPA) | 19.2.x |
| **Servidor web / Reverse Proxy** | Nginx (Alpine) | Última estable |
| **Backend principal** | Django + Django REST Framework | 5.0+ |
| **Servidor WSGI** | Gunicorn (3 workers, timeout 120s) | 21.2+ |
| **Base de datos principal** | PostgreSQL (Alpine) | 16.x |
| **Bases de datos secundarias** | SQLite | 3.x (SARLAFT, SIGA) |
| **Automatización web** | Playwright + Chromium headless | 1.40+ |
| **Procesamiento NLP** | Servicio NLP-Cámara (Python) | Custom |
| **Procesamiento de facturas** | Servicio FactIA (Python) | Custom |
| **Runtime** | Python | 3.12 |
| **Runtime frontend** | Node.js | 20.x (solo build) |
| **Orquestación** | Docker + Docker Compose v2 | 24+ |

### 2.3 Arquitectura de Contenedores Actual

```
                                    INTERNET / RED INTERNA FINAGRO
                                               │
                                    ┌──────────┴──────────┐
                                    │   SERVIDOR ACTUAL    │
                                    │                      │
    ┌───────────────────────────────┤  Puertos: 9000-9004  │
    │                               └──────────┬──────────┘
    │                                          │
    │  ┌───────────────────────────────────────────────────────────┐
    │  │                    Docker Network: finagro-net             │
    │  │                                                           │
    │  │  ┌─────────────────────┐                                  │
    │  │  │   frontend (Nginx)  │ ← Puertos 9000-9004              │
    │  │  │   React SPA build   │   Reverse proxy a servicios      │
    │  │  └────────┬────────────┘                                  │
    │  │           │                                               │
    │  │     ┌─────┴─────┬──────────────┬──────────────┐           │
    │  │     ▼           ▼              ▼              ▼           │
    │  │  ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐      │
    │  │  │backend │  │sarlaft │  │  siga    │  │ factia   │      │
    │  │  │Django  │  │Django  │  │ Django   │  │ Python   │      │
    │  │  │Gunicorn│  │        │  │          │  │          │      │
    │  │  └───┬────┘  └───┬────┘  └────┬─────┘  └──────────┘      │
    │  │      │           │            │                           │
    │  │      ▼           │            │                           │
    │  │  ┌────────┐      │       ┌────┴─────┐                     │
    │  │  │  db    │      │       │ SQLite   │                     │
    │  │  │Postgres│      │       │ (local)  │                     │
    │  │  │  16    │      │       └──────────┘                     │
    │  │  └────────┘      │                                        │
    │  │      ▲           ▼                                        │
    │  │      │     ┌──────────┐                                   │
    │  │      │     │nlp-camara│                                   │
    │  │      │     │ Python   │                                   │
    │  │      │     └──────────┘                                   │
    │  │      │                                                    │
    │  └──────┴────────────────────────────────────────────────────┘
    │
    │  Contenedores activos: 7
    │  Volúmenes persistentes: postgres_data_prod, factia_data,
    │                          siga_db, siga_landing, sarlaft_db
    └──────────────────────────────────────────────────────────────
```

**Total de contenedores actuales:** 7 servicios
**Volúmenes persistentes:** 5

---

## 3. Matriz de Innovación - Procesos a Implementar

Los siguientes 13 procesos fueron identificados, evaluados y priorizados según criterios de recurrencia (30%), riesgo (30%), duración (25%) y tipo de proceso (15%). Se presentan ordenados por puntuación de mayor a menor impacto:

### 3.1 Prioridad ALTA (Puntuación > 0.40)

#### P1 - Automatización de Distribución de Comunicaciones Salientes
- **Puntuación:** 0.7625 (la más alta)
- **Área:** Dirección de Servicios Generales - Gestión Documental
- **Responsable:** Byronn Waldir Morales Mora; Leidy Paola Hernández Fuentes
- **Tipo:** Operativo
- **Recurrencia mensual:** 26,627 eventos/mes
- **Duración manual:** 20 horas/mes
- **Riesgo identificado:** 3 (Alto)
- **Situación:** La distribución de comunicaciones salientes se realiza por múltiples canales (correo certificado, mensajería física, courier, SMS y WhatsApp). Solo el correo certificado tiene integración automática con Mercurio. Los envíos por SMS, WhatsApp y masivos son completamente manuales: se envían desde plataformas externas, se descargan soportes y se cargan manualmente en Mercurio como evidencia.
- **Necesidad:** Automatizar la distribución y el cargue de evidencias de envío en canales no integrados y en procesos masivos, garantizando trazabilidad completa.
- **Componentes técnicos requeridos:**
  - Worker de procesamiento de colas para envíos masivos
  - Integración con APIs de SMS (proveedor actual o Twilio/similar)
  - Integración con API de WhatsApp Business
  - Conector con sistema Mercurio para cargue automático de evidencias
  - Sistema de reintentos y dead-letter queue
  - Dashboard de monitoreo de envíos y estados

#### P2 - Seguimiento Automatizado de Derechos de Petición
- **Puntuación:** 0.4969
- **Área:** Dirección de Relacionamiento - Gestión de Canales y Usuarios
- **Responsable:** Luisa Fernanda Gallego Pelaez
- **Tipo:** Normativo
- **Recurrencia mensual:** 5 ciclos/mes
- **Duración manual:** 15 horas/mes
- **Riesgo identificado:** 3 (Alto)
- **Situación:** El seguimiento se realiza extrayendo información de Mercurio a Excel, haciendo limpieza de datos, cruces con BUSCARV y consolidación manual para generar informes semanales de vencimientos y cierre mensual de cumplimiento. Una sola persona con 10 años de experiencia concentra este conocimiento.
- **Necesidad:** Automatizar la extracción, procesamiento y generación de informes de seguimiento (semanal y mensual) de derechos de petición desde Mercurio, incluyendo alertas y control de vencimientos.
- **Componentes técnicos requeridos:**
  - Conector de extracción de datos desde Mercurio (API o scraping con Playwright)
  - Motor de reglas para cálculo de vencimientos y estados
  - Generador automático de informes (PDF/Excel)
  - Sistema de alertas por correo electrónico
  - Scheduler para ejecución periódica (semanal/mensual)
  - Dashboard de seguimiento en tiempo real

#### P3 - Respuestas Automatizadas a Peticiones Repetitivas (IA)
- **Puntuación:** 0.4484
- **Área:** Dirección de Relacionamiento - Gestión de Canales y Usuarios
- **Responsable:** Luisa Fernanda Gallego Pelaez
- **Tipo:** Normativo
- **Recurrencia mensual:** 417 peticiones/mes (~5,000/año)
- **Duración manual:** 30 horas/mes
- **Riesgo identificado:** 2 (Medio)
- **Situación:** Las peticiones incluyen múltiples solicitudes repetitivas sobre portafolio, estados de cuenta y otros temas con respuestas estandarizables. Actualmente se gestionan manualmente por diferentes direcciones.
- **Necesidad:** Implementar respuestas automatizadas mediante plantillas parametrizadas o IA para solicitudes frecuentes, derivando solo los casos complejos a profesionales.
- **Componentes técnicos requeridos:**
  - Motor de clasificación de peticiones (NLP/IA)
  - Base de conocimiento con plantillas de respuesta parametrizadas
  - Integración con modelo de lenguaje (LLM) para generación de respuestas
  - Sistema de revisión/aprobación antes de envío
  - Métricas de precisión y tasa de resolución automática
  - Integración con Mercurio para trazabilidad

### 3.2 Prioridad MEDIA (Puntuación 0.25 - 0.40)

#### P4 - Optimización de Herramienta de Presupuesto
- **Puntuación:** 0.4002
- **Área:** Dirección de Planeación Financiera - Direccionamiento Estratégico
- **Responsable:** Diego Andrés Cortés Rojas; Brayan Andrey Garavito Mateus
- **Tipo:** Estratégico
- **Recurrencia mensual:** 16 ciclos/mes
- **Duración manual:** 80 horas/mes
- **Riesgo identificado:** 1 (Bajo)
- **Necesidad:** Optimizar la herramienta de elaboración de presupuesto para mejorar la captura, consolidación y análisis de información proveniente de múltiples áreas. Ya existe una aplicación en R que requiere mejoras.
- **Componentes técnicos requeridos:**
  - Módulo web de captura de información por áreas (formularios dinámicos)
  - Motor de consolidación y validación de datos
  - Integración o migración desde scripts R existentes
  - Generador de reportes y dashboards de presupuesto
  - Control de versiones de presupuesto
  - Flujo de aprobación por niveles

#### P5 - Automatización de Correspondencia Recibida + Mercurio
- **Puntuación:** 0.3805
- **Área:** Dirección de Servicios Generales - Gestión Documental
- **Responsable:** Byronn Waldir Morales Mora; Leidy Paola Hernández Fuentes
- **Tipo:** Operativo
- **Recurrencia mensual:** 1,600 comunicaciones/mes
- **Duración manual:** 20 horas/mes
- **Riesgo identificado:** 2 (Medio)
- **Situación:** Las comunicaciones llegan a buzones institucionales, se descargan, revisan y cargan en Mercurio manualmente. Campos como asunto, observaciones y tipificación se diligencian por copiar/pegar. Mercurio presenta lentitud al procesar y guardar.
- **Necesidad:** Automatizar la captura de datos de las comunicaciones recibidas e integrar el correo con Mercurio para reducir digitación, acelerar la radicación y disminuir errores.
- **Componentes técnicos requeridos:**
  - Conector IMAP/Exchange para lectura automática de buzones
  - Motor de extracción de metadatos (OCR para adjuntos, NLP para asunto/tipificación)
  - Integración automatizada con Mercurio (API o RPA con Playwright)
  - Cola de procesamiento para picos de volumen
  - Dashboard de monitoreo de radicación

#### P6 - Publicación Simultánea en Redes Sociales
- **Puntuación:** 0.2789
- **Área:** Relaciones Corporativas y Comunicaciones - Gestión de Comunicaciones
- **Responsable:** Manuela Giraldo Restrepo
- **Tipo:** Operativo
- **Recurrencia mensual:** 66 publicaciones/mes
- **Duración manual:** 25 horas/mes
- **Riesgo identificado:** 1 (Bajo)
- **Necesidad:** Implementar herramienta que permita publicar simultáneamente en Instagram, Facebook y X (Twitter) desde un solo punto.
- **Componentes técnicos requeridos:**
  - Integración con API de Meta (Facebook/Instagram)
  - Integración con API de X (Twitter)
  - Editor de contenido con vista previa por plataforma
  - Programación de publicaciones (scheduler)
  - Almacenamiento de medios (imágenes/videos)

#### P7 - Workflow Centralizado de Solicitudes
- **Puntuación:** 0.2752
- **Área:** Dirección de Planeación Financiera - Direccionamiento Estratégico
- **Responsable:** Brayan Andrey Garavito Mateus; Diego Andrés Cortés Rojas
- **Tipo:** Estratégico
- **Recurrencia mensual:** 20 solicitudes/mes
- **Duración manual:** 40 horas/mes
- **Riesgo identificado:** 1 (Bajo)
- **Necesidad:** Implementar un aplicativo tipo workflow integrado que permita canalizar, hacer seguimiento y gestionar solicitudes de manera centralizada a nivel de toda la entidad.
- **Componentes técnicos requeridos:**
  - Motor de workflow con estados configurables
  - Formularios dinámicos por tipo de solicitud
  - Sistema de notificaciones (email/in-app)
  - Dashboard de seguimiento y KPIs
  - Módulo de reportería
  - API REST para integraciones

#### P8 - Monitoreo Automático de Noticias del Sector
- **Puntuación:** 0.2627
- **Área:** Relaciones Corporativas y Comunicaciones - Gestión de Comunicaciones
- **Responsable:** Kevin Steven Bohorquez Guevara
- **Tipo:** Operativo
- **Recurrencia mensual:** 20 ciclos/mes (diario)
- **Duración manual:** 20 horas/mes
- **Riesgo identificado:** 1 (Bajo)
- **Necesidad:** Automatizar la recolección y envío de noticias relevantes del sector agropecuario y financiero.
- **Componentes técnicos requeridos:**
  - Web scraper de fuentes de noticias configurables
  - Motor de clasificación y relevancia (NLP)
  - Generador de resumen diario (newsletter automático)
  - Scheduler de ejecución diaria
  - Distribución por correo electrónico

#### P9 - Chatbot para Respuestas en Redes Sociales
- **Puntuación:** 0.2627
- **Área:** Relaciones Corporativas y Comunicaciones - Gestión de Comunicaciones
- **Responsable:** Manuela Giraldo Restrepo
- **Tipo:** Operativo
- **Recurrencia mensual:** 20 ciclos/mes
- **Duración manual:** 20 horas/mes
- **Riesgo identificado:** 1 (Bajo)
- **Necesidad:** Implementar respuestas automáticas (chatbot) para preguntas frecuentes en redes sociales de FINAGRO.
- **Componentes técnicos requeridos:**
  - Chatbot con base de conocimiento de preguntas frecuentes
  - Integración con API de Meta (Messenger, Instagram DM)
  - Integración con API de X (mensajes directos)
  - Panel de administración de respuestas
  - Escalamiento a agente humano cuando sea necesario
  - Métricas de interacción y resolución

### 3.3 Prioridad ESTÁNDAR (Puntuación < 0.25)

#### P10 - Informes Automatizados de Redes Sociales
- **Puntuación:** 0.2251
- **Área:** Relaciones Corporativas y Comunicaciones
- **Responsable:** Manuela Giraldo Restrepo
- **Tipo:** Operativo
- **Recurrencia mensual:** 5 informes/mes
- **Duración manual:** 8 horas/mes
- **Necesidad:** Automatizar la generación de informes de redes sociales con métricas consolidadas.
- **Componentes técnicos requeridos:**
  - Integración con APIs de métricas (Meta Insights, X Analytics)
  - Generador de reportes en PDF/Excel
  - Dashboards interactivos
  - Scheduler de generación periódica

#### P11 - Simulador de Comisión PAC
- **Puntuación:** 0.2201
- **Área:** Gerencia Administrativa - Gestión Operativa
- **Responsable:** Dalia Marcela Leaño Ardila
- **Tipo:** Operativo
- **Recurrencia mensual:** 400 consultas/mes
- **Duración manual:** 5 horas/mes
- **Necesidad:** Rediseñar el simulador de comisión PAC para incluir los nuevos tipos de clasificación, beneficiarios, esquemas y condiciones vigentes desde abril 2026.
- **Componentes técnicos requeridos:**
  - Motor de cálculo parametrizable (tipos de productor, beneficiario, esquema)
  - Interfaz web intuitiva para intermediarios financieros
  - Administrador de reglas de negocio (sin necesidad de código)
  - Exportación de resultados a PDF
  - Posible acceso externo (intermediarios financieros)

#### P12 - Gestión Remota de Carteleras Digitales
- **Puntuación:** 0.2188
- **Área:** Relaciones Corporativas y Comunicaciones
- **Responsable:** Angie Carolina Melo Merchan
- **Tipo:** Operativo
- **Recurrencia mensual:** 1 actualización/mes
- **Duración manual:** 6 horas/mes
- **Necesidad:** Implementar solución centralizada para gestionar carteleras digitales de forma remota sin uso de USB.
- **Componentes técnicos requeridos:**
  - Panel de administración de contenido por pantalla
  - API de publicación remota
  - Programación de contenido por horarios
  - Cliente en las pantallas (Raspberry Pi o smart TV con navegador)
  - Almacenamiento de medios

#### P13 - Herramienta de Mailing con Métricas
- **Puntuación:** 0.1503
- **Área:** Relaciones Corporativas y Comunicaciones
- **Responsable:** Angie Carolina Melo Merchan
- **Tipo:** Estratégico
- **Recurrencia mensual:** 26 envíos/mes
- **Duración manual:** 0 horas/mes (actualmente no se mide)
- **Necesidad:** Implementar herramienta de mailing que permita medir aperturas, clics e interacción de los comunicados internos.
- **Componentes técnicos requeridos:**
  - Motor de envío de correos masivos (SMTP relay)
  - Sistema de tracking (pixel de apertura, tracking de clics)
  - Editor de plantillas HTML para comunicados
  - Dashboard de métricas en tiempo real
  - Segmentación de audiencias
  - Integración con directorio activo de FINAGRO

---

## 4. Agrupación Técnica de Módulos

Los 13 procesos se agrupan en **8 unidades de despliegue** para optimizar recursos y reducir la complejidad operativa:

### Grupo A: Integración Mercurio (P1, P2, P5)
**Nuevo contenedor: `mercurio-bridge`**

Los procesos P1 (distribución saliente), P2 (seguimiento PQR) y P5 (correspondencia recibida) comparten la necesidad de interactuar con el sistema Mercurio. Se propone un servicio unificado que actúe como puente entre Automation Hub y Mercurio.

| Componente | Detalle |
|-----------|---------|
| Runtime | Python 3.12 + Playwright (Chromium headless) |
| Framework | Django + Celery (procesamiento asíncrono) |
| Message Broker | Redis 7.x (para colas de Celery) |
| Workers | 3 workers de Celery (1 por proceso) |
| Scheduler | Celery Beat (tareas programadas) |
| Almacenamiento | Volumen para evidencias descargadas y generación de informes |
| Integraciones externas | API SMS, API WhatsApp Business, SMTP, Mercurio |

**Estimación de recursos:**

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM (servicio) | 1 GB | 2 GB |
| RAM (Redis) | 256 MB | 512 MB |
| RAM (Chromium workers) | 1 GB | 2 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disco | 10 GB | 20 GB |

### Grupo B: Motor de IA/NLP (P3, P9)
**Nuevo contenedor: `nlp-respuestas`**

Los procesos P3 (respuestas automatizadas a peticiones) y P9 (chatbot redes sociales) comparten la necesidad de procesamiento de lenguaje natural y generación de respuestas inteligentes.

| Componente | Detalle |
|-----------|---------|
| Runtime | Python 3.12 |
| Framework | FastAPI (para inferencia de baja latencia) |
| Modelo NLP | Opción A: API externa (Claude/OpenAI) - liviano en servidor |
|  | Opción B: Modelo local (sentence-transformers) - intensivo en servidor |
| Base de conocimiento | PostgreSQL (embeddings) o ChromaDB/Qdrant (vectorial) |
| Caché | Redis compartido con Grupo A |

**Estimación de recursos (según opción):**

| Recurso | Opción A (API externa) | Opción B (modelo local) |
|---------|----------------------|------------------------|
| RAM | 1 GB | 4–8 GB |
| CPU | 0.5 vCPU | 2–4 vCPU |
| GPU | No requerida | Recomendada (NVIDIA T4/similar) |
| Disco | 2 GB | 10 GB (modelos) |

> **Recomendación:** Opción A (API externa) para fase inicial. Minimiza recursos de servidor y permite escalar calidad del modelo sin impacto en infraestructura.

### Grupo C: Presupuesto (P4)
**Nuevo módulo en backend existente: `modules/presupuesto`**

Se integra como módulo adicional del backend Django existente, sin necesidad de contenedor independiente.

| Componente | Detalle |
|-----------|---------|
| Backend | Nuevo módulo Django en `backend/modules/presupuesto/` |
| Frontend | Nueva página en la SPA existente |
| Puerto | Reutiliza puerto 9000 (portal principal) o nuevo puerto 9005 |
| BD | Nuevas tablas en PostgreSQL existente |

**Estimación de recursos adicionales:**

| Recurso | Adicional |
|---------|-----------|
| RAM | +512 MB (backend Django) |
| CPU | Compartido con backend existente |
| Disco | +2 GB (datos de presupuesto) |

### Grupo D: Social Media Hub (P6, P8, P10)
**Nuevo contenedor: `social-media-hub`**

Los procesos P6 (publicación multi-red), P8 (monitoreo noticias) y P10 (informes métricas) comparten la interacción con redes sociales y la necesidad de tareas programadas.

| Componente | Detalle |
|-----------|---------|
| Runtime | Python 3.12 |
| Framework | Django + Celery |
| Message Broker | Redis compartido con Grupo A |
| APIs externas | Meta Graph API, X API v2, News APIs |
| Almacenamiento | Volumen para medios (imágenes, videos) y reportes generados |

**Estimación de recursos:**

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 512 MB | 1 GB |
| CPU | 0.5 vCPU | 1 vCPU |
| Disco | 5 GB | 15 GB (medios) |

### Grupo E: Workflow (P7)
**Nuevo módulo en backend existente: `modules/workflow`**

Motor de workflow integrado en el backend Django existente.

| Componente | Detalle |
|-----------|---------|
| Backend | Nuevo módulo Django en `backend/modules/workflow/` |
| Frontend | Nueva página en la SPA |
| Puerto | Reutiliza infraestructura existente (9000 o nuevo 9006) |
| BD | Nuevas tablas en PostgreSQL existente |
| Notificaciones | SMTP + notificaciones in-app (WebSocket opcional) |

**Estimación de recursos adicionales:**

| Recurso | Adicional |
|---------|-----------|
| RAM | +512 MB |
| CPU | Compartido |
| Disco | +2 GB |

### Grupo F: Simulador PAC (P11)
**Nuevo módulo en backend existente: `modules/simulador_pac`**

Módulo autocontenido con lógica de cálculo parametrizable.

| Componente | Detalle |
|-----------|---------|
| Backend | Nuevo módulo Django en `backend/modules/simulador_pac/` |
| Frontend | Nueva página en la SPA |
| Puerto | Puerto 9003 (Gestión Administrativa) o nuevo |
| BD | Nuevas tablas en PostgreSQL (reglas de negocio, tarifas) |
| Acceso | Posible acceso externo para intermediarios financieros |

**Estimación de recursos adicionales:**

| Recurso | Adicional |
|---------|-----------|
| RAM | +256 MB |
| CPU | Compartido |
| Disco | +1 GB |

### Grupo G: Carteleras Digitales (P12)
**Nuevo contenedor ligero: `signage-manager`**

| Componente | Detalle |
|-----------|---------|
| Runtime | Python 3.12 o Node.js 20 |
| Framework | FastAPI o Express.js |
| Almacenamiento | Volumen para contenido multimedia |
| Clientes | Navegadores en pantallas remotas (pull model via API) |

**Estimación de recursos:**

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 256 MB | 512 MB |
| CPU | 0.25 vCPU | 0.5 vCPU |
| Disco | 2 GB | 5 GB (medios) |

### Grupo H: Mailing con Métricas (P13)
**Nuevo contenedor: `mailing-service`**

| Componente | Detalle |
|-----------|---------|
| Runtime | Python 3.12 |
| Framework | Django + Celery |
| SMTP | Relay SMTP institucional o servicio externo (SendGrid/SES) |
| Tracking | Pixel de apertura + redirect de clics |
| BD | PostgreSQL compartida (logs de envío, métricas) |

**Estimación de recursos:**

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 512 MB | 1 GB |
| CPU | 0.5 vCPU | 1 vCPU |
| Disco | 3 GB | 10 GB (logs de tracking) |

---

## 5. Infraestructura Compartida Adicional

Además de los grupos anteriores, se requieren servicios compartidos que no existen en la infraestructura actual:

### 5.1 Redis (Message Broker + Caché)

Requerido por los Grupos A, B, D y H que utilizan Celery para procesamiento asíncrono.

| Componente | Detalle |
|-----------|---------|
| Imagen | `redis:7-alpine` |
| Función | Message broker para Celery + caché de sesiones y datos temporales |
| Persistencia | RDB snapshots cada 60 segundos |

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 512 MB | 1 GB |
| CPU | 0.5 vCPU | 1 vCPU |
| Disco | 1 GB | 2 GB |

### 5.2 Ampliación de PostgreSQL

La base de datos actual deberá alojar nuevos schemas y tablas para los módulos integrados (P4, P7, P11) y datos de los servicios nuevos.

| Aspecto | Estimación |
|---------|-----------|
| Tablas adicionales | ~40-60 tablas nuevas |
| Crecimiento de datos estimado (año 1) | 5-10 GB |
| Conexiones concurrentes adicionales | +15-20 conexiones |
| RAM adicional recomendada para PostgreSQL | +2 GB (shared_buffers, work_mem) |

### 5.3 Volúmenes de Almacenamiento Adicionales

| Volumen | Servicio | Tamaño Estimado |
|---------|----------|----------------|
| `mercurio_evidencias` | mercurio-bridge | 10-20 GB |
| `mercurio_informes` | mercurio-bridge | 5 GB |
| `social_media_assets` | social-media-hub | 10-15 GB |
| `mailing_logs` | mailing-service | 5-10 GB |
| `signage_content` | signage-manager | 3-5 GB |
| `redis_data` | redis | 1-2 GB |
| `nlp_models` | nlp-respuestas (Opción B) | 5-10 GB |

**Total almacenamiento adicional en volúmenes:** 39-77 GB

---

## 6. Proyección Consolidada de Recursos

### 6.1 Resumen por Servicio

| Servicio | Estado | RAM (min) | RAM (rec) | CPU (min) | CPU (rec) | Disco |
|----------|--------|-----------|-----------|-----------|-----------|-------|
| **SERVICIOS EXISTENTES** | | | | | | |
| frontend (Nginx) | Existente | 128 MB | 256 MB | 0.25 | 0.5 | 500 MB |
| backend (Django/Gunicorn) | Existente | 512 MB | 1 GB | 1 | 2 | 2 GB |
| db (PostgreSQL 16) | Existente | 1 GB | 2 GB | 1 | 2 | 10 GB |
| nlp-camara | Existente | 512 MB | 1 GB | 0.5 | 1 | 1 GB |
| factia | Existente | 512 MB | 1 GB | 0.5 | 1 | 5 GB |
| sarlaft | Existente | 256 MB | 512 MB | 0.25 | 0.5 | 1 GB |
| siga | Existente | 256 MB | 512 MB | 0.25 | 0.5 | 2 GB |
| **Subtotal existentes** | | **3.2 GB** | **6.3 GB** | **3.75** | **7.5** | **21.5 GB** |
| | | | | | | |
| **SERVICIOS NUEVOS** | | | | | | |
| mercurio-bridge + workers | Nuevo | 2.25 GB | 4.5 GB | 1 | 2 | 20 GB |
| nlp-respuestas (Opción A) | Nuevo | 1 GB | 1.5 GB | 0.5 | 1 | 2 GB |
| social-media-hub | Nuevo | 512 MB | 1 GB | 0.5 | 1 | 15 GB |
| signage-manager | Nuevo | 256 MB | 512 MB | 0.25 | 0.5 | 5 GB |
| mailing-service | Nuevo | 512 MB | 1 GB | 0.5 | 1 | 10 GB |
| redis | Nuevo | 512 MB | 1 GB | 0.5 | 1 | 2 GB |
| Ampliación backend (P4,P7,P11) | Ampliación | 1.25 GB | 2 GB | - | - | 5 GB |
| Ampliación PostgreSQL | Ampliación | 2 GB | 4 GB | 0.5 | 1 | 10 GB |
| **Subtotal nuevos** | | **8.3 GB** | **15.5 GB** | **3.75** | **7.5** | **69 GB** |
| | | | | | | |
| **TOTAL GENERAL** | | **11.5 GB** | **21.8 GB** | **7.5** | **15** | **90.5 GB** |

### 6.2 Resumen de Contenedores

| Concepto | Actual | Proyectado |
|----------|--------|-----------|
| Contenedores de aplicación | 7 | **12** (+5 nuevos) |
| Volúmenes Docker persistentes | 5 | **12** (+7 nuevos) |
| Puertos expuestos | 5 (9000-9004) | **7-8** (+2-3 nuevos) |
| Redes Docker | 1 | **1** (misma finagro-net) |
| Bases de datos | 1 PostgreSQL + 2 SQLite | **1 PostgreSQL + 1 Redis + 2 SQLite** |

### 6.3 Mapa de Puertos Proyectado

| Puerto | Servicio | Acceso |
|--------|---------|--------|
| `9000` | Portal principal Automation Hub | Interno |
| `9001` | Facturación Electrónica | Interno |
| `9002` | SARLAFT | Interno |
| `9003` | Gestión Administrativa + Simulador PAC | Interno |
| `9004` | Mesa de Ayuda | Interno |
| `9005` | Presupuesto + Workflow (nuevo) | Interno |
| `9006` | Comunicaciones (Social Media + Mailing + Carteleras) (nuevo) | Interno |
| `9007` | Simulador PAC (si requiere acceso externo para intermediarios) | **Externo (DMZ)** |

---

## 7. Especificación de Servidor Requerido

### 7.1 Opción A - Servidor Único (Recomendada para fase inicial)

| Componente | Especificación Mínima | Especificación Recomendada | Justificación |
|------------|----------------------|---------------------------|---------------|
| **CPU** | 8 vCPU / 8 cores | **16 vCPU / 16 cores** | 15 vCPU de demanda proyectada + margen operativo de 10% |
| **RAM** | 16 GB DDR4 | **32 GB DDR4** | 21.8 GB de demanda proyectada + margen para picos y SO |
| **Disco principal (SO + Docker)** | 100 GB SSD | **200 GB SSD** | 90.5 GB proyectados + imágenes Docker + logs del SO |
| **Disco datos (volúmenes)** | 150 GB SSD | **300 GB SSD** | Volúmenes persistentes + crecimiento anual estimado de 50 GB |
| **Red** | 1 Gbps | **1 Gbps** | Suficiente para tráfico interno + APIs externas |
| **Sistema Operativo** | Ubuntu 22.04 LTS | **Ubuntu 22.04 LTS** | Soporte LTS hasta 2027, compatibilidad total con Docker |
| **Docker** | Docker Engine 24+ | **Docker Engine 24+ con Compose v2** | Requerido por la arquitectura actual de docker-compose |
| **GPU** | No requerida | **No requerida** (Opción A - APIs externas para IA) | Solo necesaria si se elige modelo NLP local |

### 7.2 Opción B - Dos Servidores (Recomendada para producción escalable)

**Servidor 1 - Aplicaciones:**

| Componente | Especificación |
|------------|---------------|
| CPU | 12 vCPU |
| RAM | 24 GB DDR4 |
| Disco | 200 GB SSD |
| Función | Frontend, Backend, servicios de aplicación, Redis |

**Servidor 2 - Datos y Procesamiento:**

| Componente | Especificación |
|------------|---------------|
| CPU | 8 vCPU |
| RAM | 16 GB DDR4 |
| Disco | 500 GB SSD |
| Función | PostgreSQL, volúmenes de datos, workers Celery, Playwright |

### 7.3 Comparativa de Opciones

| Criterio | Opción A (Servidor Único) | Opción B (Dos Servidores) |
|----------|--------------------------|--------------------------|
| Costo estimado | Menor | Mayor (~60% más) |
| Complejidad operativa | Baja | Media |
| Alta disponibilidad | No | Parcial |
| Escalabilidad | Limitada | Mejor |
| Rendimiento ante picos | Compartido | Aislado |
| Recomendación | Fase inicial / MVP | Producción estable con +50 usuarios |

---

## 8. Requisitos de Red y Seguridad

### 8.1 Acceso a Internet Saliente (Outbound)

Los nuevos servicios requieren acceso a APIs externas. Se debe permitir tráfico saliente a:

| Destino | Puerto | Protocolo | Servicio que lo requiere |
|---------|--------|-----------|------------------------|
| API de Meta (graph.facebook.com) | 443 | HTTPS | Social Media Hub (P6, P9, P10) |
| API de X (api.twitter.com) | 443 | HTTPS | Social Media Hub (P6, P9, P10) |
| API de WhatsApp Business | 443 | HTTPS | Mercurio Bridge (P1) |
| Proveedor SMS | 443 | HTTPS | Mercurio Bridge (P1) |
| API de IA (api.anthropic.com u otro) | 443 | HTTPS | NLP Respuestas (P3, P9) |
| SMTP Relay (interno o externo) | 587/465 | SMTPS | Mailing Service (P13), alertas (P2) |
| Fuentes de noticias (RSS/Web) | 443/80 | HTTPS/HTTP | Social Media Hub (P8) |

### 8.2 Acceso Entrante (Inbound)

| Puerto | Protocolo | Origen | Destino |
|--------|-----------|--------|---------|
| 9000-9006 | HTTP | Red interna FINAGRO | Frontend Nginx |
| 9007 (si aplica) | HTTPS | Internet (DMZ) | Simulador PAC externo |
| 22 | SSH | IPs administradores | Servidor |

### 8.3 Consideraciones de Seguridad

- **Secretos y credenciales:** Todas las API keys, tokens y contraseñas deben gestionarse mediante variables de entorno en archivos `.env` (excluidos del repositorio) o un gestor de secretos (Vault, AWS Secrets Manager).
- **Comunicaciones internas:** La red Docker `finagro-net` mantiene el tráfico entre contenedores aislado de la red del host.
- **Datos sensibles:** Los procesos P1, P2 y P5 manejan datos de correspondencia y derechos de petición que pueden contener información personal. Se debe asegurar el cifrado en reposo de los volúmenes de datos.
- **Acceso externo (P11):** Si el simulador PAC se expone a intermediarios financieros, debe estar en DMZ con WAF y certificado SSL.
- **Backups:** Se requiere política de backup diario para PostgreSQL y volúmenes de datos.

---

## 9. Plan de Implementación por Fases

Se recomienda una implementación gradual para validar recursos y ajustar configuraciones:

### Fase 1 - Infraestructura Base (Semanas 1-2)
- Aprovisionamiento del servidor con especificaciones definidas
- Instalación de SO, Docker y Docker Compose
- Migración de servicios existentes al nuevo servidor (si aplica)
- Instalación de Redis
- Verificación de conectividad a APIs externas

### Fase 2 - Módulos de Prioridad Alta (Semanas 3-8)
- **P2:** Seguimiento automatizado de PQR (Mercurio Bridge - fase 1)
- **P5:** Correspondencia recibida automatizada (Mercurio Bridge - fase 2)
- **P1:** Distribución comunicaciones salientes (Mercurio Bridge - fase 3)
- **P3:** Motor de respuestas automatizadas (NLP Respuestas)

### Fase 3 - Módulos de Prioridad Media (Semanas 9-16)
- **P4:** Módulo de Presupuesto
- **P7:** Workflow centralizado
- **P6:** Publicación multi-red social
- **P8:** Monitoreo de noticias
- **P9:** Chatbot redes sociales

### Fase 4 - Módulos Estándar (Semanas 17-22)
- **P10:** Informes automatizados redes sociales
- **P11:** Simulador PAC
- **P12:** Carteleras digitales
- **P13:** Mailing con métricas

---

## 10. Arquitectura Proyectada

```
                            INTERNET / RED INTERNA FINAGRO
                                         │
                              ┌──────────┴──────────┐
                              │     SERVIDOR         │
                              │  16 vCPU / 32 GB RAM │
                              │  500 GB SSD          │
                              │  Ubuntu 22.04 LTS    │
                              │  Docker 24+          │
                              └──────────┬──────────┘
                                         │
    Puertos: 9000-9007                   │
    ┌────────────────────────────────────┴─────────────────────────────────┐
    │                       Docker Network: finagro-net                     │
    │                                                                      │
    │  ┌─────────────────────────────┐                                     │
    │  │    frontend (Nginx)         │ ← Puertos 9000-9007                 │
    │  │    React SPA build          │   Reverse proxy a todos los         │
    │  │    + nuevas rutas           │   servicios back-end                │
    │  └──────────┬──────────────────┘                                     │
    │             │                                                        │
    │   ┌─────┬──┴───┬─────────┬──────────┬───────────┬────────────┐       │
    │   ▼     ▼      ▼         ▼          ▼           ▼            ▼       │
    │ ┌─────┐┌──────┐┌───────┐┌──────────┐┌──────────┐┌──────────┐┌─────┐ │
    │ │back-││sarlaft││ siga ││mercurio- ││  nlp-    ││ social-  ││mail-│ │
    │ │end  ││      ││      ││ bridge   ││respuestas││media-hub ││ing  │ │
    │ │     ││      ││      ││+workers  ││          ││          ││svc  │ │
    │ └──┬──┘└──────┘└──────┘└────┬─────┘└──────────┘└──────────┘└─────┘ │
    │    │                        │                                       │
    │    │  ┌──────┐  ┌────────┐  │   ┌──────────┐   ┌──────────┐        │
    │    │  │nlp-  │  │ factia │  │   │ signage- │   │          │        │
    │    │  │camara│  │        │  │   │ manager  │   │  redis   │        │
    │    │  └──────┘  └────────┘  │   └──────────┘   │  7.x     │        │
    │    │                        │                   └────┬─────┘        │
    │    ▼                        ▼                        │              │
    │  ┌─────────────────────────────────────────┐         │              │
    │  │         PostgreSQL 16                   │◄────────┘              │
    │  │  Schemas: public, presupuesto,          │   (caché + broker)    │
    │  │  workflow, simulador_pac, mercurio,      │                       │
    │  │  social_media, mailing                  │                       │
    │  └─────────────────────────────────────────┘                       │
    │                                                                     │
    │  Contenedores: 12          Volúmenes: 12          Redis: 1         │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 11. Resumen Ejecutivo de la Solicitud

| Concepto | Detalle |
|----------|---------|
| **Procesos a automatizar** | 13 procesos identificados en la Matriz de Innovación |
| **Áreas beneficiadas** | 5 (Servicios Generales, Relacionamiento, Planeación Financiera, Comunicaciones, Gerencia Administrativa) |
| **Nuevos contenedores** | 5 servicios + 1 Redis |
| **Módulos integrados al backend existente** | 3 (presupuesto, workflow, simulador PAC) |
| **Servidor requerido** | **16 vCPU, 32 GB RAM, 500 GB SSD, Ubuntu 22.04 LTS** |
| **Software base** | Docker Engine 24+, Docker Compose v2, PostgreSQL 16, Redis 7 |
| **Acceso a internet saliente** | Requerido (APIs: Meta, X, WhatsApp, SMS, IA, SMTP) |
| **Acceso externo entrante** | Opcional (solo si simulador PAC se abre a intermediarios) |
| **Plazo estimado de implementación** | 22 semanas (5.5 meses) en 4 fases |
| **Impacto operativo** | Reducción estimada de **289 horas/mes** de trabajo manual |
| **Volumen de transacciones automatizadas** | ~29,250 eventos/mes |

---

## 12. Anexos

### Anexo A - Criterios de Priorización (Pesos)

| Factor | Peso | Descripción |
|--------|------|-------------|
| Recurrencia | 0.30 | Frecuencia mensual del proceso |
| Riesgo | 0.30 | Nivel de riesgo si el proceso no se automatiza (1-3) |
| Duración | 0.25 | Horas mensuales consumidas por el proceso manual |
| Tipo de proceso | 0.15 | Normativo (3), Operativo (2), Estratégico (1) |

### Anexo B - Valores de Tipo de Proceso

| Tipo | Valor | Justificación |
|------|-------|---------------|
| Normativo | 3 | Mayor peso por riesgo de incumplimiento legal/regulatorio |
| Operativo | 2 | Impacto directo en eficiencia operativa |
| Estratégico | 1 | Mejora a largo plazo, menor urgencia inmediata |

### Anexo C - Dependencias entre Procesos

```
P1 (Distribución saliente) ──┐
P2 (Seguimiento PQR)     ────┤── Comparten: Conector Mercurio, Redis
P5 (Correspondencia)     ────┘

P3 (Respuestas IA)  ─────────┤── Comparten: Motor NLP, Redis
P9 (Chatbot redes)  ─────────┘

P6 (Publicación multi-red) ──┐
P8 (Monitoreo noticias)   ───┤── Comparten: APIs redes sociales, Celery
P10 (Informes métricas)   ───┘

P4 (Presupuesto)  ───────────── Independiente (módulo backend)
P7 (Workflow)      ───────────── Independiente (módulo backend)
P11 (Simulador PAC) ─────────── Independiente (módulo backend)
P12 (Carteleras)   ───────────── Independiente (servicio ligero)
P13 (Mailing)      ───────────── Independiente (servicio con Celery + Redis)
```

---

*Documento generado como parte del proceso de solicitud de recursos de infraestructura para la plataforma Automation Hub de FINAGRO.*
