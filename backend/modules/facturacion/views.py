from decimal import Decimal, InvalidOperation

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
from .client import FactIAClient


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

        try:
            respuesta = FactIAClient().descargar()
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
