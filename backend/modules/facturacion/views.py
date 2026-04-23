import json
import os
from decimal import Decimal, InvalidOperation

import requests as _requests

from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from automation.models import Automation
from execution.models import Execution
from logs.models import ExecutionLog
from .models import FacturaElectronica
from .serializers import FacturaElectronicaSerializer
from .client import FactIAClient, FACTIA_URL


def _get_or_create_automation():
    automation, _ = Automation.objects.get_or_create(
        module='facturacion',
        name='Facturación Electrónica DIAN',
        defaults={'description': 'Descarga y extrae metadata de facturas electrónicas vía FactIA.'},
    )
    return automation


def _to_decimal(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


class DescargarFacturasView(APIView):
    """
    POST /api/facturacion/descargar/

    Descarga los ZIPs de facturas desde el buzón de correo (Microsoft Graph).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        automation = _get_or_create_automation()
        execution = Execution.objects.create(
            automation=automation,
            status='running',
            start_time=timezone.now(),
            triggered_by=request.user,
        )
        ExecutionLog.objects.create(
            execution=execution,
            level='info',
            message='Iniciando descarga del histórico de correos.',
        )

        fecha_desde = request.data.get('fecha_desde')
        fecha_hasta = request.data.get('fecha_hasta')

        try:
            respuesta = FactIAClient().descargar(fecha_desde=fecha_desde, fecha_hasta=fecha_hasta)
        except Exception as exc:
            execution.status = 'failed'
            execution.end_time = timezone.now()
            execution.save()
            ExecutionLog.objects.create(
                execution=execution,
                level='error',
                message=f'Error al contactar factia: {exc}',
            )
            return Response(
                {'error': f'Servicio FactIA no disponible: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        execution.status = 'success'
        execution.end_time = timezone.now()
        execution.save()
        ExecutionLog.objects.create(
            execution=execution,
            level='info',
            message=f"Descarga completada. Mensajes procesados: {respuesta.get('mensajes_procesados', 0)}",
        )

        return Response({
            'execution_id': execution.id,
            'mensajes_procesados': respuesta.get('mensajes_procesados', 0),
        }, status=status.HTTP_200_OK)


class ProcesarFacturasView(APIView):
    """
    POST /api/facturacion/procesar/

    Clasifica los ZIPs y extrae metadata de las facturas XML.
    Persiste los resultados en la base de datos.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        automation = _get_or_create_automation()
        execution = Execution.objects.create(
            automation=automation,
            status='running',
            start_time=timezone.now(),
            triggered_by=request.user,
        )
        ExecutionLog.objects.create(
            execution=execution,
            level='info',
            message='Iniciando clasificación y extracción de metadata.',
        )

        try:
            respuesta = FactIAClient().procesar()
        except Exception as exc:
            execution.status = 'failed'
            execution.end_time = timezone.now()
            execution.save()
            ExecutionLog.objects.create(
                execution=execution,
                level='error',
                message=f'Error al contactar factia: {exc}',
            )
            return Response(
                {'error': f'Servicio FactIA no disponible: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        facturas_creadas = []
        for dato in respuesta.get('facturas', []):
            try:
                factura, _ = FacturaElectronica.objects.update_or_create(
                    tipo_documento=dato.get('tipo_documento', 'Invoice'),
                    proveedor_nit=dato.get('proveedor_nit', ''),
                    numero_factura=dato.get('numero_factura', ''),
                    defaults={
                        'execution': execution,
                        'codigo': dato.get('codigo', ''),
                        'valor_factura': _to_decimal(dato.get('valor_factura')),
                        'iva_facturado_proveedor': _to_decimal(dato.get('iva_facturado_proveedor')),
                        'fecha_emision': dato.get('fecha_emision') or None,
                        'fecha_vencimiento': dato.get('fecha_vencimiento') or None,
                        'observaciones': dato.get('observaciones', ''),
                        'archivo': dato.get('archivo', ''),
                    },
                )
                facturas_creadas.append(factura)
                ExecutionLog.objects.create(
                    execution=execution,
                    level='info',
                    message=f"Factura: {dato.get('numero_factura')} | NIT: {dato.get('proveedor_nit')} | Valor: {dato.get('valor_factura')}",
                )
            except Exception as exc:
                ExecutionLog.objects.create(
                    execution=execution,
                    level='error',
                    message=f"Error guardando factura {dato.get('numero_factura')}: {exc}",
                )

        execution.status = 'success' if respuesta.get('errores', 0) == 0 else 'failed'
        execution.end_time = timezone.now()
        execution.save()

        return Response({
            'execution_id': execution.id,
            'total': len(facturas_creadas),
            'errores': respuesta.get('errores', 0),
            'clasificacion': respuesta.get('clasificacion', {}),
            'facturas': FacturaElectronicaSerializer(facturas_creadas, many=True).data,
        }, status=status.HTTP_200_OK)


class ListarFacturasView(APIView):
    """
    GET /api/facturacion/facturas/

    Retorna las facturas guardadas en la base de datos.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import F
        facturas = FacturaElectronica.objects.all().order_by(
            F('fecha_emision').desc(nulls_last=True), '-procesado_en'
        )
        serializer = FacturaElectronicaSerializer(facturas, many=True)
        return Response({'facturas': serializer.data, 'total': facturas.count()})


# ── Stats ────────────────────────────────────────────────────────────────────

class StatsDescargaView(APIView):
    """
    GET /api/facturacion/stats/

    Retorna estadísticas del historico descargado: mensajes por mes y rango de fechas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            resp = _requests.get(f'{FACTIA_URL}/api/stats/', timeout=10)
            return Response(resp.json())
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


# ── Abort ────────────────────────────────────────────────────────────────────

class AbortarView(APIView):
    """
    POST /api/facturacion/abortar/
    Envía señal de abort al servicio FactIA para detener el job en curso.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            resp = _requests.post(f'{FACTIA_URL}/api/abort/', timeout=5)
            return Response(resp.json())
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class DescargarCarpetasView(APIView):
    """
    GET /api/facturacion/descargar-carpetas/          → sirve ZIP cacheado
    GET /api/facturacion/descargar-carpetas/?actualizar=1 → re-extrae y sirve
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.http import StreamingHttpResponse, HttpResponse
        actualizar = request.query_params.get('actualizar', '0')
        try:
            factia_resp = _requests.get(
                f'{FACTIA_URL}/api/descargar-carpetas/',
                params={'actualizar': actualizar},
                stream=True,
                timeout=600,
            )
            if factia_resp.status_code != 200:
                return Response({'error': f'FactIA respondió {factia_resp.status_code}'}, status=502)

            response = StreamingHttpResponse(
                factia_resp.iter_content(chunk_size=8192),
                content_type='application/zip',
            )
            response['Content-Disposition'] = 'attachment; filename="FacturasElectronicas.zip"'
            if 'Content-Length' in factia_resp.headers:
                response['Content-Length'] = factia_resp.headers['Content-Length']
            return response
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class InfoCarpetasView(APIView):
    """GET /api/facturacion/descargar-carpetas/info/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            resp = _requests.get(f'{FACTIA_URL}/api/descargar-carpetas/info/', timeout=15)
            return Response(resp.json())
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class SincronizarCronView(APIView):
    """
    POST /api/facturacion/sincronizar-cron/
    Llamado internamente por el scheduler de FactIA tras cada job automático.
    Autenticación: header X-Cron-Token con el token configurado en CRON_INTERNAL_TOKEN.
    Lee facturas_metadata.json desde FactIA (sin re-procesar) y las persiste en la BD.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token    = request.headers.get('X-Cron-Token', '')
        expected = os.getenv('CRON_INTERNAL_TOKEN', '')
        if not expected or token != expected:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        automation = _get_or_create_automation()
        execution  = Execution.objects.create(
            automation=automation,
            status='running',
            start_time=timezone.now(),
            triggered_by=None,
        )

        try:
            resp = _requests.get(f'{FACTIA_URL}/api/facturas/', timeout=30)
            resp.raise_for_status()
            facturas_data = resp.json().get('facturas', [])
        except Exception as exc:
            execution.status   = 'failed'
            execution.end_time = timezone.now()
            execution.save()
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        guardadas = 0
        for dato in facturas_data:
            try:
                FacturaElectronica.objects.update_or_create(
                    tipo_documento=dato.get('tipo_documento', 'Invoice'),
                    proveedor_nit=dato.get('proveedor_nit', ''),
                    numero_factura=dato.get('numero_factura', ''),
                    defaults={
                        'execution':               execution,
                        'codigo':                  dato.get('codigo', ''),
                        'valor_factura':           _to_decimal(dato.get('valor_factura')),
                        'iva_facturado_proveedor': _to_decimal(dato.get('iva_facturado_proveedor')),
                        'fecha_emision':           dato.get('fecha_emision') or None,
                        'fecha_vencimiento':       dato.get('fecha_vencimiento') or None,
                        'observaciones':           dato.get('observaciones', ''),
                        'archivo':                 dato.get('archivo', ''),
                    },
                )
                guardadas += 1
            except Exception:
                pass

        execution.status   = 'success'
        execution.end_time = timezone.now()
        execution.save()
        return Response({'total': guardadas}, status=status.HTTP_200_OK)


class CronLogView(APIView):
    """
    GET /api/facturacion/cron-log/
    Retorna el historial de ejecuciones programadas desde FactIA.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            resp = _requests.get(f'{FACTIA_URL}/api/cron-log/', timeout=10)
            return Response(resp.json())
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class ListarSemanasView(APIView):
    """GET /api/facturacion/semanas/ — lista semanas disponibles con conteo de ZIPs"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            resp = _requests.get(f'{FACTIA_URL}/api/semanas/', timeout=15)
            return Response(resp.json())
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class DescargarPDFsView(APIView):
    """
    GET /api/facturacion/descargar-pdfs/?semana=2026/01_january/semana_01
    Proxy que descarga el ZIP de PDFs renombrados para la semana indicada.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        semana = request.query_params.get('semana', '')
        if not semana:
            return Response({'error': 'Parámetro semana requerido'}, status=400)
        try:
            factia_resp = _requests.get(
                f'{FACTIA_URL}/api/descargar-pdfs/',
                params={'semana': semana},
                stream=True,
                timeout=120,
            )
            if factia_resp.status_code != 200:
                return Response({'error': f'FactIA respondió {factia_resp.status_code}'}, status=502)

            semana_label = semana.replace('/', '_')
            response = StreamingHttpResponse(
                factia_resp.iter_content(chunk_size=8192),
                content_type='application/zip',
            )
            response['Content-Disposition'] = f'attachment; filename="PDFs_{semana_label}.zip"'
            if 'Content-Length' in factia_resp.headers:
                response['Content-Length'] = factia_resp.headers['Content-Length']
            return response
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


# ── Descarga de script e instalador ──────────────────────────────────────────

# Contenido del script PowerShell (ASCII puro, sin tildes ni caracteres especiales)
_PS1_TEMPLATE = """\
# =============================================================================
# SincronizarFacturas.ps1
# Descarga los PDFs de facturas electronicas (por semana) desde el portal
# Automation Hub y los guarda en la carpeta local, sin repetir descargas.
#
# USO:
#   1. Abrir PowerShell como usuario normal (no requiere admin)
#   2. Si es la primera vez, habilitar scripts:
#      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#   3. Ejecutar:
#      .\\SincronizarFacturas.ps1
# =============================================================================

# -- Configuracion ------------------------------------------------------------
$BASE_URL  = "{base_url}"
$USUARIO   = "admin"
$PASSWORD  = "Finagro2026!"
$DESTINO   = "C:\\Users\\$env:USERNAME\\Documents\\FacturasElectronicas"
# -----------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

$cred    = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${{USUARIO}}:${{PASSWORD}}"))
$headers = @{{ Authorization = "Basic $cred" }}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Sincronizacion Facturas Electronicas    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Destino : $DESTINO"
Write-Host "Servidor: $BASE_URL"
Write-Host ""

New-Item -ItemType Directory -Force -Path $DESTINO | Out-Null

# -- 1. Obtener lista de semanas disponibles ----------------------------------
Write-Host "Consultando semanas disponibles..." -NoNewline
try {{
    $resp    = Invoke-RestMethod -Uri "$BASE_URL/api/facturacion/semanas/" -Headers $headers -Method Get
    $semanas = $resp.semanas
    Write-Host " OK ($($semanas.Count) semanas)" -ForegroundColor Green
}} catch {{
    Write-Host " ERROR: $_" -ForegroundColor Red
    exit 1
}}

# -- 2. Por cada semana, descargar solo si no existe ya -----------------------
$total_nuevas   = 0
$total_omitidas = 0

foreach ($sem in $semanas) {{
    $key    = $sem.key
    $year   = $sem.year
    $mes    = $sem.mes
    $semana = $sem.semana
    $pdfs   = $sem.total_zips

    $carpeta = Join-Path $DESTINO "$year\\$mes\\$semana"

    if (Test-Path $carpeta) {{
        $archivos = Get-ChildItem -Path $carpeta -Filter "*.pdf" -ErrorAction SilentlyContinue
        if ($archivos.Count -gt 0) {{
            Write-Host "  [OK] $key  ($($archivos.Count) PDFs ya descargados)" -ForegroundColor DarkGray
            $total_omitidas++
            continue
        }}
    }}

    Write-Host "  [>>] $key  ($pdfs facturas)..." -NoNewline -ForegroundColor Yellow
    $url    = "$BASE_URL/api/facturacion/descargar-pdfs/?semana=$([Uri]::EscapeDataString($key))"
    $tmpZip = [System.IO.Path]::GetTempFileName() + ".zip"

    try {{
        Invoke-WebRequest -Uri $url -Headers $headers -OutFile $tmpZip -UseBasicParsing
    }} catch {{
        Write-Host " ERROR descargando: $_" -ForegroundColor Red
        continue
    }}

    try {{
        New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
        Expand-Archive -Path $tmpZip -DestinationPath $carpeta -Force
        $extraidos = (Get-ChildItem -Path $carpeta -Filter "*.pdf").Count
        Write-Host " OK ($extraidos PDFs)" -ForegroundColor Green
        $total_nuevas++
    }} catch {{
        Write-Host " FALLO extrayendo: $_" -ForegroundColor Red
    }} finally {{
        Remove-Item $tmpZip -ErrorAction SilentlyContinue
    }}
}}

# -- 3. Resumen ---------------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Sincronizacion completada" -ForegroundColor Cyan
Write-Host "  Semanas nuevas descargadas : $total_nuevas" -ForegroundColor Green
Write-Host "  Semanas ya existentes      : $total_omitidas" -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Archivos en: $DESTINO"
"""


def _bat_content(script_url):
    """Genera el instalador .bat que descarga el PS1 y lo ejecuta."""
    return (
        "@echo off\r\n"
        "setlocal\r\n"
        'set "SCRIPT_URL=' + script_url + '"\r\n'
        'set "SCRIPT_PATH=%USERPROFILE%\\Documents\\SincronizarFacturas.ps1"\r\n'
        "\r\n"
        "echo.\r\n"
        "echo ==========================================\r\n"
        "echo   Instalador Facturas Electronicas\r\n"
        "echo   Finagro\r\n"
        "echo ==========================================\r\n"
        "echo.\r\n"
        "\r\n"
        "echo 1. Descargando script de sincronizacion...\r\n"
        'powershell -NoProfile -Command "Invoke-WebRequest -Uri \'%SCRIPT_URL%\' -OutFile \'%SCRIPT_PATH%\' -UseBasicParsing"\r\n'
        "if errorlevel 1 (\r\n"
        "    echo.\r\n"
        "    echo ERROR: No se pudo descargar el script.\r\n"
        "    echo Verifique su conexion a internet.\r\n"
        "    pause\r\n"
        "    exit /b 1\r\n"
        ")\r\n"
        "echo    Script guardado en: %SCRIPT_PATH%\r\n"
        "\r\n"
        "echo 2. Habilitando ejecucion de scripts PowerShell...\r\n"
        'powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force"\r\n'
        "\r\n"
        "echo 3. Ejecutando primera sincronizacion...\r\n"
        "echo.\r\n"
        'powershell -NoProfile -File "%SCRIPT_PATH%"\r\n'
        "\r\n"
        "echo.\r\n"
        "echo ==========================================\r\n"
        "echo   Listo. Para sincronizar de nuevo:\r\n"
        'echo   powershell -File "%SCRIPT_PATH%"\r\n'
        "echo ==========================================\r\n"
        "echo.\r\n"
        "pause\r\n"
    )


class DescargarScriptView(APIView):
    """
    GET /api/facturacion/descargar-script/
    Sirve el script PowerShell generado con la URL del servidor actual.
    No requiere autenticacion (el .bat lo descarga antes de tener sesion).
    """
    permission_classes = []

    def get(self, request):
        from django.http import HttpResponse
        scheme = request.META.get('HTTP_X_FORWARDED_PROTO', request.scheme)
        host   = request.META.get('HTTP_X_FORWARDED_HOST', request.get_host())
        base_url = f'{scheme}://{host}'
        content = _PS1_TEMPLATE.format(base_url=base_url)
        resp = HttpResponse(content.encode('ascii'), content_type='text/plain; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="SincronizarFacturas.ps1"'
        return resp


class DescargarInstaladorView(APIView):
    """
    GET /api/facturacion/descargar-instalador/
    Sirve SincronizarFacturas.exe si fue compilado (build.sh).
    Si el .exe no existe aún, sirve el InstaladorFacturas.bat como fallback.
    No requiere autenticacion.
    """
    permission_classes = []

    def get(self, request):
        from django.http import HttpResponse, StreamingHttpResponse
        # Intentar servir el .exe desde FactIA
        try:
            factia_resp = _requests.get(
                f'{FACTIA_URL}/api/descargar-exe/',
                stream=True, timeout=30,
            )
            if factia_resp.status_code == 200:
                resp = StreamingHttpResponse(
                    factia_resp.iter_content(chunk_size=65536),
                    content_type='application/octet-stream',
                )
                resp['Content-Disposition'] = 'attachment; filename="SincronizarFacturas.exe"'
                if 'Content-Length' in factia_resp.headers:
                    resp['Content-Length'] = factia_resp.headers['Content-Length']
                return resp
        except Exception:
            pass

        # Fallback: .bat que descarga y ejecuta el PS1
        scheme     = request.META.get('HTTP_X_FORWARDED_PROTO', request.scheme)
        host       = request.META.get('HTTP_X_FORWARDED_HOST', request.get_host())
        script_url = f'{scheme}://{host}/api/facturacion/descargar-script/'
        content    = _bat_content(script_url)
        resp       = HttpResponse(content.encode('ascii'), content_type='application/octet-stream')
        resp['Content-Disposition'] = 'attachment; filename="InstaladorFacturas.bat"'
        return resp


# ── Streaming SSE proxies ─────────────────────────────────────────────────────

class DescargarStreamView(APIView):
    """
    POST /api/facturacion/descargar/stream/

    Proxy SSE: autentica con DRF y reenvía el stream de FactIA línea a línea.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = {}
        if request.data.get('fecha_desde'):
            body['fecha_desde'] = request.data['fecha_desde']
        if request.data.get('fecha_hasta'):
            body['fecha_hasta'] = request.data['fecha_hasta']

        factia_resp = _requests.post(
            f'{FACTIA_URL}/api/descargar/stream/',
            json=body,
            stream=True,
            timeout=700,
        )

        def event_gen():
            for line in factia_resp.iter_lines():
                if line:
                    yield line.decode('utf-8', errors='replace') + '\n'

        resp = StreamingHttpResponse(event_gen(), content_type='text/event-stream; charset=utf-8')
        resp['Cache-Control']      = 'no-cache'
        resp['X-Accel-Buffering']  = 'no'
        return resp


class ProcesarStreamView(APIView):
    """
    POST /api/facturacion/procesar/stream/

    Proxy SSE: autentica con DRF, reenvía el stream de FactIA y persiste
    las facturas en la BD cuando detecta el evento 'result'.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        automation = _get_or_create_automation()
        execution = Execution.objects.create(
            automation=automation,
            status='running',
            start_time=timezone.now(),
            triggered_by=request.user,
        )

        factia_resp = _requests.post(
            f'{FACTIA_URL}/api/procesar/stream/',
            stream=True,
            timeout=700,
        )

        def event_gen():
            pending_result = False

            for line in factia_resp.iter_lines():
                if not line:
                    continue
                decoded = line.decode('utf-8', errors='replace')

                if decoded == 'event: result':
                    pending_result = True

                elif pending_result and decoded.startswith('data: '):
                    # Persistir facturas en la BD antes de reenviar el evento
                    try:
                        data = json.loads(decoded[6:])
                        for dato in data.get('facturas', []):
                            try:
                                FacturaElectronica.objects.update_or_create(
                                    tipo_documento=dato.get('tipo_documento', 'Invoice'),
                                    proveedor_nit=dato.get('proveedor_nit', ''),
                                    numero_factura=dato.get('numero_factura', ''),
                                    defaults={
                                        'execution': execution,
                                        'codigo': dato.get('codigo', ''),
                                        'valor_factura': _to_decimal(dato.get('valor_factura')),
                                        'iva_facturado_proveedor': _to_decimal(dato.get('iva_facturado_proveedor')),
                                        'fecha_emision': dato.get('fecha_emision') or None,
                                        'fecha_vencimiento': dato.get('fecha_vencimiento') or None,
                                        'observaciones': dato.get('observaciones', ''),
                                        'archivo': dato.get('archivo', ''),
                                    },
                                )
                            except Exception:
                                pass
                        execution.status = 'success' if data.get('errores', 0) == 0 else 'failed'
                    except Exception:
                        execution.status = 'failed'
                    execution.end_time = timezone.now()
                    execution.save()
                    pending_result = False

                elif decoded.startswith('event: error'):
                    execution.status = 'failed'
                    execution.end_time = timezone.now()
                    execution.save()

                yield decoded + '\n'

        resp = StreamingHttpResponse(event_gen(), content_type='text/event-stream; charset=utf-8')
        resp['Cache-Control']      = 'no-cache'
        resp['X-Accel-Buffering']  = 'no'
        return resp


class AbrirMercurioView(APIView):
    """
    POST /api/facturacion/abrir-mercurio/
    Ejecuta login robótico en Mercurio vía Playwright (headless).
    Retorna { status, mensaje, screenshot_b64 }.
    """
    permission_classes = [IsAuthenticated]

    MERCURIO_URL     = 'https://mercurio.finagro.com.co/mercurio'
    MERCURIO_USUARIO = 'Azambrano'
    MERCURIO_CLAVE   = 'Pagos2603%'

    def post(self, request):
        import base64
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return Response(
                {'status': 'error', 'mensaje': 'Playwright no está instalado en el servidor.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context()
                page    = context.new_page()

                page.goto(self.MERCURIO_URL, timeout=30000)
                page.wait_for_selector('input', timeout=15000)

                inputs = page.locator('input')
                inputs.nth(0).fill(self.MERCURIO_USUARIO)
                inputs.nth(1).fill(self.MERCURIO_CLAVE)
                page.locator("input[value='Ingresar']").click()

                page.wait_for_load_state('domcontentloaded', timeout=30000)
                page.wait_for_selector('body', state='visible', timeout=30000)
                page.wait_for_timeout(2000)

                html       = page.content()
                title      = page.title()
                final_url  = page.url
                shot_bytes = page.screenshot(full_page=False)
                browser.close()

            screenshot_b64 = base64.b64encode(shot_bytes).decode()

            if 'Login incorrecto' in html:
                return Response({
                    'status': 'error',
                    'mensaje': 'Login incorrecto. Verifica las credenciales.',
                    'screenshot_b64': screenshot_b64,
                })
            if 'Usuario Inactivo' in html:
                return Response({
                    'status': 'warning',
                    'mensaje': 'El usuario está inactivo en Mercurio.',
                    'screenshot_b64': screenshot_b64,
                })

            return Response({
                'status': 'ok',
                'mensaje': f'Login exitoso — {title}',
                'url': final_url,
                'screenshot_b64': screenshot_b64,
            })

        except Exception as exc:
            return Response(
                {'status': 'error', 'mensaje': f'Error al ejecutar Playwright: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MercurioPDFsListView(APIView):
    """
    GET /api/facturacion/mercurio-pdfs/
    Lista todos los PDFs disponibles con nombre y tamaño.
    """
    permission_classes = [IsAuthenticated]
    PDF_DIR = '/tmp/mercurio/descargas/pdfs'

    def get(self, request):
        if not os.path.isdir(self.PDF_DIR):
            return Response({'pdfs': []})

        pdfs = []
        for nombre in sorted(os.listdir(self.PDF_DIR)):
            if nombre.endswith('.pdf'):
                size = os.path.getsize(os.path.join(self.PDF_DIR, nombre))
                pdfs.append({'nombre': nombre, 'size': size})

        return Response({'pdfs': pdfs})


class DescargarMercurioPDFView(APIView):
    """
    GET /api/facturacion/mercurio-pdfs/<nombre>/
    Sirve un PDF individual para descarga directa en el browser.
    """
    permission_classes = [IsAuthenticated]
    PDF_DIR = '/tmp/mercurio/descargas/pdfs'

    def get(self, request, nombre):
        from django.http import FileResponse
        import re

        # Validar nombre para evitar path traversal
        if not re.match(r'^[\w\-\.]+\.pdf$', nombre):
            return Response({'error': 'Nombre inválido.'}, status=400)

        path = os.path.join(self.PDF_DIR, nombre)
        if not os.path.exists(path):
            return Response({'error': 'PDF no encontrado.'}, status=404)

        return FileResponse(
            open(path, 'rb'),
            content_type='application/pdf',
            as_attachment=True,
            filename=nombre,
        )


class DescargarMercurioPDFsMasivoView(APIView):
    """
    GET /api/facturacion/mercurio-pdfs/masivo/
    Empaqueta todos los PDFs de Mercurio en un ZIP y lo sirve para descarga.
    """
    permission_classes = [IsAuthenticated]
    PDF_DIR = '/tmp/mercurio/descargas/pdfs'

    def get(self, request):
        import zipfile, io

        if not os.path.isdir(self.PDF_DIR):
            return Response({'error': 'No hay PDFs disponibles.'}, status=404)

        pdfs = [f for f in sorted(os.listdir(self.PDF_DIR)) if f.endswith('.pdf')]
        if not pdfs:
            return Response({'error': 'No hay PDFs disponibles.'}, status=404)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for nombre in pdfs:
                zf.write(os.path.join(self.PDF_DIR, nombre), nombre)
        buf.seek(0)

        from django.http import FileResponse
        return FileResponse(
            buf,
            content_type='application/zip',
            as_attachment=True,
            filename='Mercurio_PDFs.zip',
        )


class SincronizarMercurioView(APIView):
    """
    POST /api/facturacion/sincronizar-mercurio/stream/
    Ejecuta el pipeline completo de Mercurio vía Playwright (headless):
      1. Login
      2. Navega WorkFlow → BandejaRutas
      3. Filtra Paso=1 y recorre todas las páginas
      4. Descarga EMLs y extrae PDFs
    Retorna SSE con líneas de log y un evento final 'result'.
    """
    permission_classes = [IsAuthenticated]

    MERCURIO_URL     = 'https://mercurio.finagro.com.co/mercurio/index.jsp'
    MERCURIO_USUARIO = 'Azambrano'
    MERCURIO_CLAVE   = 'Pagos2603%'
    DOWNLOAD_DIR     = '/tmp/mercurio/descargas'
    PDF_DIR          = '/tmp/mercurio/descargas/pdfs'

    def post(self, request):
        import re, email as _email, zipfile, io, base64
        from email import policy as _policy

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return Response(
                {'status': 'error', 'mensaje': 'Playwright no está instalado en el servidor.'},
                status=500,
            )

        os.makedirs(self.DOWNLOAD_DIR, exist_ok=True)
        os.makedirs(self.PDF_DIR,      exist_ok=True)

        def _sse(msg):
            return f'data: {msg}\n\n'

        def _sse_result(obj):
            return f'event: result\ndata: {json.dumps(obj)}\n\n'

        def _sse_error(msg):
            return f'event: error\ndata: {msg}\n\n'

        # ── helpers internos ───────────────────────────────────────────────
        def extraer_docs_de_html(html):
            doc_blocks = re.findall(r'function selectDoc(\d+)\(\)\s*\{(.*?)\}', html, re.DOTALL)
            docs = []
            for idx, block in doc_blocks:
                id_doc = re.search(r"idDocumento\s*=\s*'([^']+)'", block)
                if id_doc:
                    docs.append({'idx': idx, 'id': id_doc.group(1)})
            return docs

        def cerrar_popups_huerfanos(context, page):
            """Cierra cualquier página extra (popups) que no sea la principal."""
            for p in context.pages:
                if p != page:
                    try:
                        p.close()
                    except Exception:
                        pass

        def descargar_imagen(context, page, wf_frame, doc, dest, log_fn=None):
            """
            Descarga el documento (imagen/PDF) directamente via TraerImagen servlet,
            usando el API de Playwright (context.request) para preservar cookies y
            sesión completa del navegador.
            Si TraerImagen devuelve directamente un PDF, lo guarda.
            Si devuelve HTML, busca links a EML/PDF dentro del HTML.
            """
            n      = doc['idx']
            id_doc = doc['id']

            # Seleccionar el documento en el frame
            cerrar_popups_huerfanos(context, page)
            wf_frame.evaluate(f'selectDoc{n}();')
            page.wait_for_timeout(500)

            # Leer variables JS del documento seleccionado
            try:
                id_documento = wf_frame.evaluate('idDocumento')
                tip_documento = wf_frame.evaluate('tipDocumento')
            except Exception:
                id_documento = id_doc
                tip_documento = ''

            base_url = 'https://mercurio.finagro.com.co'
            traer_url = f'{base_url}/mercurio/servlet/TraerImagen?documento={id_documento}&tipoDocumento={tip_documento}&imagenConsulta=S'

            # Usar Playwright API request (comparte cookies/sesión con el navegador)
            api_resp = context.request.get(traer_url, timeout=30000)

            if api_resp.status != 200:
                raise Exception(f'TraerImagen HTTP {api_resp.status}')

            ct = api_resp.headers.get('content-type', '')
            body = api_resp.body()

            # Si devuelve PDF directo, guardarlo
            if 'application/pdf' in ct:
                with open(dest, 'wb') as f:
                    f.write(body)
                return 'pdf_directo'

            # Si devuelve HTML, buscar links a EML o PDF
            encoding = 'latin-1' if 'ISO-8859-1' in ct else 'utf-8'
            html_content = body.decode(encoding, errors='replace')

            # Buscar link a PDF o EML en href= o src= (con o sin comillas)
            url_match = re.search(r'(?:href|src)=["\']?([^\s"\'<>]+\.pdf)["\']?', html_content, re.IGNORECASE)
            if not url_match:
                url_match = re.search(r'(?:href|src)=["\']?([^\s"\'<>]+\.eml)["\']?', html_content, re.IGNORECASE)

            if url_match:
                file_url = url_match.group(1)
                if not file_url.startswith('http'):
                    file_url = base_url + ('' if file_url.startswith('/') else '/') + file_url
                resp_file = context.request.get(file_url, timeout=60000)
                if resp_file.status != 200:
                    raise Exception(f'Download HTTP {resp_file.status} para {file_url}')
                with open(dest, 'wb') as f:
                    f.write(resp_file.body())
                ext = 'pdf' if file_url.lower().endswith('.pdf') else 'eml'
                return f'{ext}_link'

            # Log HTML para diagnóstico (primeros 500 chars)
            snippet = html_content[:500].replace('\n', ' ')
            raise Exception(f'Sin EML/PDF en TraerImagen (Content-Type: {ct}) HTML: {snippet}')

        def extraer_pdf_de_eml(eml_path, radicado):
            with open(eml_path, 'rb') as f:
                msg = _email.message_from_binary_file(f, policy=_policy.default)
            for part in msg.walk():
                ct         = part.get_content_type()
                nombre_adj = part.get_filename() or ''
                if ct == 'application/zip' or nombre_adj.lower().endswith('.zip'):
                    payload = part.get_payload(decode=True)
                    if not payload:
                        continue
                    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
                        for archivo in zf.namelist():
                            if archivo.lower().endswith('.pdf'):
                                pdf_bytes = zf.read(archivo)
                                dest_path = os.path.join(self.PDF_DIR, f'{radicado}.pdf')
                                with open(dest_path, 'wb') as out:
                                    out.write(pdf_bytes)
                                return dest_path, len(pdf_bytes)
                elif ct == 'application/pdf' or nombre_adj.lower().endswith('.pdf'):
                    payload = part.get_payload(decode=True)
                    if payload:
                        dest_path = os.path.join(self.PDF_DIR, f'{radicado}.pdf')
                        with open(dest_path, 'wb') as out:
                            out.write(payload)
                        return dest_path, len(payload)
            return None, 0

        # ── generador SSE ──────────────────────────────────────────────────
        def generar():
            try:
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    context = browser.new_context(accept_downloads=True)
                    page    = context.new_page()
                    page.on('dialog', lambda d: d.accept())

                    # Login
                    yield _sse('🔐 Iniciando login en Mercurio...')
                    page.goto(self.MERCURIO_URL, timeout=30000)
                    page.wait_for_load_state('domcontentloaded')
                    page.wait_for_timeout(2000)
                    page.locator("input[name='asri']").click()
                    page.locator("input[name='asri']").type(self.MERCURIO_USUARIO, delay=80)
                    page.locator("input[name='ntrsn']").click()
                    page.locator("input[name='ntrsn']").type(self.MERCURIO_CLAVE, delay=80)
                    page.wait_for_timeout(500)
                    with page.expect_response(lambda r: 'ConsultarUsuarioLogueado' in r.url, timeout=15000):
                        page.locator("input[name='Submit']").click()
                    page.wait_for_url(lambda url: 'index.jsp' not in url, timeout=15000)
                    page.wait_for_load_state('domcontentloaded', timeout=15000)
                    page.wait_for_timeout(2000)

                    # La página post-login carga frames dinámicamente; intentamos
                    # leer el contenido pero si aún está navegando lo ignoramos.
                    try:
                        html_post = page.content()
                        if 'Login incorrecto' in html_post or 'Usuario Inactivo' in html_post:
                            yield _sse_error('Login fallido. Verifica credenciales.')
                            browser.close()
                            return
                    except Exception:
                        pass  # URL ya cambió → login exitoso
                    yield _sse('✅ Login OK')

                    # Navegar a WorkFlow
                    yield _sse('📂 Navegando a BANDEJAS → WorkFlow...')
                    main_frame = page.frames[0]
                    main_frame.locator('text=BANDEJAS').first.hover()
                    page.wait_for_timeout(800)
                    main_frame.locator('text=WorkFlow').first.click()
                    page.wait_for_timeout(3000)

                    def get_wf_frame():
                        return next((f for f in page.frames if 'BandejaRutas' in f.url), None)

                    wf_frame = get_wf_frame()
                    if not wf_frame:
                        yield _sse_error('No se encontró el frame BandejaRutas.')
                        browser.close()
                        return

                    # Filtrar Paso=1
                    yield _sse('🔍 Aplicando filtro Paso=1...')
                    # Leer opciones disponibles del select
                    paso_select = wf_frame.locator("select[name='listapaso']")
                    opciones_html = paso_select.evaluate('el => el.outerHTML')
                    opciones = re.findall(r'<option\s+value="([^"]*)"[^>]*>(.*?)</option>', opciones_html, re.IGNORECASE)
                    yield _sse(f'   Opciones disponibles: {opciones}')

                    # Buscar la opción que corresponda a Paso 1
                    paso_valor = None
                    for val, txt in opciones:
                        if val == '1' or txt.strip() == '1':
                            paso_valor = val
                            break
                    if paso_valor:
                        yield _sse(f'   Seleccionando valor: "{paso_valor}"')
                        try:
                            with page.expect_response(lambda r: 'BandejaRutas' in r.url and r.status == 200, timeout=20000):
                                paso_select.select_option(paso_valor)
                        except Exception as e_filtro:
                            yield _sse(f'⚠️ expect_response falló ({e_filtro}), esperando recarga del frame...')
                            page.wait_for_timeout(5000)
                        page.wait_for_timeout(2000)
                        wf_frame = get_wf_frame()
                        if not wf_frame:
                            yield _sse_error('Frame BandejaRutas no encontrado después del filtro.')
                            browser.close()
                            return
                        wf_frame.wait_for_load_state('domcontentloaded')
                        page.wait_for_timeout(1000)
                    else:
                        yield _sse(f'   ⚠️ No existe opción Paso=1 (opciones: {[v for v,_ in opciones]}). Continuando sin filtro...')

                    html = wf_frame.content()

                    # La paginación solo existe cuando hay más de una página
                    try:
                        pag_select_html = wf_frame.locator("select[name='listapagina']").evaluate(
                            'el => el.outerHTML', timeout=3000
                        )
                        paginas_opts = re.findall(
                            r'<option value="(\d+)"', pag_select_html,
                        )
                        # Extraer URL base de paginación del onchange del select
                        pag_base_match = re.search(
                            r"top\.location\s*=\s*'([^']*?pagBanRutas=)'",
                            pag_select_html,
                        )
                        pag_base_path = pag_base_match.group(1) if pag_base_match else None
                    except Exception:
                        paginas_opts = []
                        pag_base_path = None
                    total_paginas = len(paginas_opts) if paginas_opts else 1
                    yield _sse(f'📄 Páginas detectadas: {total_paginas}')

                    pdfs_ok    = 0
                    pdfs_skip  = 0
                    errores    = 0
                    pagina_actual = 0
                    prev_doc_ids = set()

                    while True:
                        html       = wf_frame.content()
                        docs_pag   = extraer_docs_de_html(html)
                        if not docs_pag:
                            break

                        # Detectar página duplicada (mismos docs que la anterior)
                        cur_ids = {d['id'] for d in docs_pag}
                        if cur_ids == prev_doc_ids:
                            yield _sse(f'── Página {pagina_actual + 1} — mismos docs, saltando ──')
                        else:
                            prev_doc_ids = cur_ids
                            yield _sse(f'── Página {pagina_actual + 1} — {len(docs_pag)} documentos ──')

                            for i, doc in enumerate(docs_pag):
                                id_doc   = doc['id']
                                pdf_dest = os.path.join(self.PDF_DIR, f'{id_doc}.pdf')
                                eml_dest = os.path.join(self.DOWNLOAD_DIR, f'{id_doc}.eml')

                                if os.path.exists(pdf_dest):
                                    yield _sse(f'  [{i+1}/{len(docs_pag)}] {id_doc} — ya procesado')
                                    pdfs_skip += 1
                                    continue

                                try:
                                    # Descarga directa via TraerImagen (sin popup)
                                    resultado = descargar_imagen(context, page, wf_frame, doc, pdf_dest)

                                    if resultado in ('pdf_directo', 'pdf_link'):
                                        size = os.path.getsize(pdf_dest)
                                        yield _sse(f'  [{i+1}/{len(docs_pag)}] ✅ {id_doc}.pdf — {size:,} bytes')
                                        pdfs_ok += 1
                                    elif resultado in ('eml', 'eml_link'):
                                        os.rename(pdf_dest, eml_dest)
                                        yield _sse(f'  [{i+1}/{len(docs_pag)}] 📥 {id_doc}.eml — {os.path.getsize(eml_dest):,} bytes')
                                        pdf_path, size = extraer_pdf_de_eml(eml_dest, id_doc)
                                        if pdf_path:
                                            yield _sse(f'  [{i+1}/{len(docs_pag)}] ✅ {id_doc}.pdf — {size:,} bytes')
                                            pdfs_ok += 1
                                        else:
                                            yield _sse(f'  [{i+1}/{len(docs_pag)}] ⚠️ {id_doc} — sin PDF en EML')
                                            errores += 1
                                except Exception as e:
                                    yield _sse(f'  [{i+1}/{len(docs_pag)}] ❌ {id_doc} — {e}')
                                    errores += 1

                                page.wait_for_timeout(200)

                        # Siguiente página
                        if not paginas_opts or pagina_actual + 1 >= len(paginas_opts):
                            yield _sse(f'✅ Última página alcanzada ({pagina_actual + 1})')
                            break

                        pagina_actual += 1
                        yield _sse(f'Navegando a página {pagina_actual + 1}...')

                        # Navegar el frame directamente (el select usa top.location
                        # que destruye el contexto de la página padre)
                        pag_value = paginas_opts[pagina_actual]
                        if pag_base_path:
                            nav_url = f'https://mercurio.finagro.com.co{pag_base_path}{pag_value}'
                        else:
                            nav_url = f'https://mercurio.finagro.com.co/mercurio/ControlDoc/BandejaRutas.jsp?pagBanRutas={pag_value}'
                        wf_frame = get_wf_frame()
                        if not wf_frame:
                            yield _sse('⚠️ Frame perdido, finalizando.')
                            break
                        wf_frame.goto(nav_url, timeout=15000)
                        wf_frame.wait_for_load_state('domcontentloaded')
                        page.wait_for_timeout(2000)
                        wf_frame = get_wf_frame()
                        if not wf_frame:
                            yield _sse('⚠️ Frame perdido después de cambiar página, finalizando.')
                            break

                    browser.close()

                yield _sse_result({
                    'status':      'ok',
                    'pdfs_nuevos': pdfs_ok,
                    'pdfs_skip':   pdfs_skip,
                    'errores':     errores,
                    'total':       pdfs_ok + pdfs_skip,
                    'pdf_dir':     self.PDF_DIR,
                })

            except Exception as exc:
                import traceback
                yield _sse(f'❌ EXCEPCIÓN: {exc}')
                yield _sse(traceback.format_exc().replace('\n', ' | '))
                yield _sse_error(str(exc))

        resp = StreamingHttpResponse(generar(), content_type='text/event-stream; charset=utf-8')
        resp['Cache-Control']     = 'no-cache'
        resp['X-Accel-Buffering'] = 'no'
        return resp
