import json
from decimal import Decimal, InvalidOperation

import requests as _requests

from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
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
        facturas = FacturaElectronica.objects.all()
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
    Genera y sirve el instalador .bat con la URL del servidor actual.
    No requiere autenticacion.
    """
    permission_classes = []

    def get(self, request):
        from django.http import HttpResponse
        scheme = request.META.get('HTTP_X_FORWARDED_PROTO', request.scheme)
        host   = request.META.get('HTTP_X_FORWARDED_HOST', request.get_host())
        script_url = f'{scheme}://{host}/api/facturacion/descargar-script/'
        content = _bat_content(script_url)
        resp = HttpResponse(content.encode('ascii'), content_type='application/octet-stream')
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
