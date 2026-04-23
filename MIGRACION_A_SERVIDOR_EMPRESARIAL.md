# Especificaciones Técnicas de Migración a Servidor Empresarial

## 1. Objetivo

Definir lo estrictamente necesario para alojar `automation-hub-finagro` en un servidor empresarial.

## 2. Requisitos mínimos del servidor

### Hardware

- CPU: 4 vCPUs
- RAM: 8 GB
- Almacenamiento: SSD 100 GB
- Red: 1 Gbps

### Software

- Linux estable (Ubuntu Server, Debian, RHEL/AlmaLinux/Rocky)
- Docker 24.x+
- Docker Compose v2
- PostgreSQL 16 (o servicio compatible)
- Certificados TLS válidos y proxy inverso para HTTPS

### Volúmenes persistentes

- PostgreSQL: volumen dedicado
- Datos de servicios: volúmenes para `factia`, `siga`, `sarlaft`

### Red y seguridad

- Abrir solo puertos necesarios:
  - frontend: 9000-9004 (o proxy HTTPS)
  - backend: no exponer directamente si hay proxy
  - PostgreSQL: solo acceso interno
- Usar `ALLOWED_HOSTS` con dominios reales
- Restringir acceso SSH y Docker

## 3. Consideraciones clave

- El backend requiere `Playwright` y Chromium.
- El despliegue en producción debe usar `docker-compose.prod.yml`.
- La aplicación usa servicios internos adicionales: `nlp-camara`, `factia`, `sarlaft`, `siga`.
- Configurar `.env.prod` con:
  - `SECRET_KEY`
  - `DEBUG=False`
  - `DATABASE_URL=true`
  - `DB_*`
  - `CORS_ALLOWED_ORIGINS`
  - `NLP_CAMARA_URL`, `FACTIA_URL`

## 4. Validación inicial

- Construir y levantar contenedores: `docker compose -f docker-compose.prod.yml up -d --build`
- Verificar que el backend y frontend responden
- Confirmar conexión a PostgreSQL
- Probar flujo de facturación y servicios externos

La aplicación se compone de:

- Backend Django + Django REST Framework
- Frontend React
- Base de datos PostgreSQL en producción (SQLite en desarrollo)
- Servicios internos adicionales en Docker Compose Prod:
  - `nlp-camara`
  - `factia`
  - `sarlaft`
  - `siga`

La orquestación de producción está modelada en `docker-compose.prod.yml`.

## 3. Componentes clave

### Backend

- Directorio: `backend/`
- Contenedor: `docker/Dockerfile.backend`
- Comando de ejecución: `python manage.py migrate --noinput && gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120`
- Dependencias requeridas: `backend/requirements.txt`
- Usa `playwright` y Chromium para funcionalidades de automatización de facturación.

### Frontend

- Directorio: `frontend/`
- Contenedor de producción: `docker/Dockerfile.frontend.prod`
- Nginx sirve el `build` React en múltiples puertos.
- Variables de ambiente: `REACT_APP_API_URL`

### Base de datos

- Producción: PostgreSQL 16-alpine
- Dev local: SQLite
- Configuración basada en `DATABASE_URL` en `backend/core/settings.py`

## 4. Variables de entorno y configuración

### Archivos de ejemplo

- `.env.example`
- `.env.prod.example`

### Variables críticas

- `SECRET_KEY`
- `DEBUG` = `False` en producción
- `ALLOWED_HOSTS`
- `DATABASE_URL=true`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `CORS_ALLOWED_ORIGINS`
- `NLP_CAMARA_URL`
- `FACTIA_URL`

### Recomendaciones

- No almacenar `SECRET_KEY` en repositorio.
- Usar credenciales seguras de base de datos.
- Limitar `ALLOWED_HOSTS` al dominio de producción.
- Configurar `CORS_ALLOWED_ORIGINS` con los dominios reales.

## 5. Red y puertos usados

### Expuestos en producción

- Backend: puerto `8000` internamente, proxy a través de Nginx o balanceador
- Frontend: puertos `9000` a `9004` para los distintos contextos de aplicación
- PostgreSQL: `5432` (interno entre contenedores)

### Servicios internos

- `nlp-camara`: `8001`
- `factia`: `8002`
- `sarlaft`: depende de su propio Dockerfile externo
- `siga`: depende de su propio Dockerfile externo

## 6. Pasos de migración

### 6.1 Preparación del servidor

1. Provisionar servidor Linux con Docker y Docker Compose.
2. Asegurar recursos suficientes para:
   - Contenedores Docker
   - PostgreSQL
   - Nginx y servicios internos
   - Playwright / Chromium
3. Configurar almacenamiento persistente para volúmenes de Docker.

### 6.2 Configuración de despliegue

1. Copiar `docker-compose.prod.yml` al servidor.
2. Crear `.env.prod` a partir de `.env.prod.example`.
3. Ajustar valores de producción:
   - `SECRET_KEY`
   - `DB_*`
   - `ALLOWED_HOSTS`
   - `CORS_ALLOWED_ORIGINS`
   - `NLP_CAMARA_URL`, `FACTIA_URL`
4. Confirmar que los contextos `../nlp-camara`, `../FactIA`, `../sarlaft`, `../siga` son accesibles en el árbol de despliegue.

### 6.3 Build y despliegue

1. Construir imágenes de Docker desde el servidor.
2. Ejecutar: `docker compose -f docker-compose.prod.yml up -d --build`
3. Verificar:
   - `backend` levanta correctamente
   - `frontend` y Nginx sirven contenido
   - `db` está accesible
   - `nlp-camara`, `factia`, `sarlaft`, `siga` funcionan

## 7. Ajustes de seguridad

- Forzar HTTPS en los dominios de producción.
- Configurar firewall para abrir solo puertos necesarios.
- Usar certificados TLS válidos.
- Configurar límites de recursos y reinicios automáticos de Docker.
- Usar contraseñas robustas y accesos restringidos.

## 8. Consideraciones de base de datos

- No usar SQLite en producción.
- PostgreSQL debe estar respaldado con estrategias de backup regulares.
- Configurar volumen persistente para datos: `postgres_data_prod`.
- Validar conexiones desde el backend y los servicios dependientes.

## 9. Operaciones y mantenimiento

### Backup

- Base de datos PostgreSQL
- Datos de volúmenes externos (`factia_data`, `siga_db`, `siga_landing`, `sarlaft_db`)

### Logs

- Revisar logs de Docker para `backend`, `frontend`, `db` y servicios internos.
- Configurar rotación de logs si es necesario.

### Actualizaciones

- Actualizar dependencias de Python en `backend/requirements.txt` con cuidado.
- Actualizar dependencias de Node en `frontend/package.json` cuando se requiera.
- Reconstruir imágenes con `docker compose -f docker-compose.prod.yml build`.

## 10. Validación posterior a la migración

- Acceder al frontend en el dominio de producción.
- Probar autenticación y endpoints de API.
- Verificar integración con servicios externos:
  - NLP Cámara
  - FactIA
  - SARLAFT
  - SIGA
- Confirmar que los flujos de facturación automáticos funcionan y que Playwright puede iniciar Chromium.

## 11. Riesgos conocidos

- Dependencia de `Playwright` y Chromium en el contenedor backend.
- Servicios externos que deben ser desplegados y accesibles en la misma red de Docker.
- Variables de entorno sensibles mal configuradas.

## 12. Recomendaciones finales

- Mantener un repositorio de configuración separado para producción.
- Implementar monitoreo de contenedores y alertas.
- Realizar pruebas de carga si el servidor empresarial tendrá tráfico alto.
- Documentar cambios de infraestructura y credenciales en un vault seguro.
