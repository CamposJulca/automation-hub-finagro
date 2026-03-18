#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# descargar_facturas.sh
# Descarga los ZIPs de facturas desde el correo de Finagro y los extrae
# a carpetas locales en /data/factia/extraidos/.
#
# Cron (lunes-viernes):
#   0 6  * * 1-5  /ruta/scripts/descargar_facturas.sh
#   0 11 * * 1-5  /ruta/scripts/descargar_facturas.sh
#   0 16 * * 1-5  /ruta/scripts/descargar_facturas.sh
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE_FILE="/home/desarrollo/Finagro/automation-hub-finagro/docker-compose.prod.yml"
CONTAINER="automation-hub-finagro-factia-1"
FACTIA_API="http://localhost:8002"
LOG_FILE="/home/desarrollo/Finagro/automation-hub-finagro/logs/facturas_cron.log"
HORA=$(date '+%H')
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "═══ INICIO DESCARGA PROGRAMADA (slot ${HORA}:00) ═══"

# ── Verificar que el contenedor esté corriendo ────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  log "ERROR: Contenedor ${CONTAINER} no está corriendo."
  exit 1
fi

# ── Ejecutar descarga y registrar log dentro del contenedor ──────────────────
HORA_SLOT="${HORA}:00"

docker exec "${CONTAINER}" python3 - <<PYEOF
import urllib.request, urllib.error, json, os, datetime

API = "http://localhost:8002"
hora_slot = "${HORA_SLOT}"
timestamp = "${TIMESTAMP}"

def post_json(url, data=None):
    body = json.dumps(data or {}).encode()
    req  = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())

print(f"[{timestamp}] Iniciando descarga...")
try:
    result = post_json(f"{API}/api/descargar/")
    status  = result.get("status", "ok")
    mensajes = result.get("mensajes_procesados", 0)
    print(f"[{timestamp}] OK — {mensajes} mensajes procesados")
except Exception as e:
    status   = "error"
    mensajes = 0
    print(f"[{timestamp}] ERROR: {e}")

# Registrar en cron-log
try:
    post_json(f"{API}/api/cron-log/", {
        "timestamp": timestamp,
        "hora_slot": hora_slot,
        "status":    status,
        "mensajes_procesados": mensajes,
    })
    print(f"[{timestamp}] Log registrado")
except Exception as e:
    print(f"[{timestamp}] No se pudo registrar el log: {e}")
PYEOF

RESULT=$?
if [ $RESULT -eq 0 ]; then
  log "Descarga completada exitosamente (slot ${HORA_SLOT})"
else
  log "ERROR en la descarga (código $RESULT)"
fi

log "═══ FIN DESCARGA PROGRAMADA ═══"
