from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from automation.models import Automation
from execution.models import Execution
from logs.models import ExecutionLog
from .models import CertificadoCamara
from .serializers import CertificadoCamaraSerializer
from .client import NlpCamaraClient


class ExtraerCertificadosView(APIView):
    """
    POST /api/sarlaft/certificados/

    Recibe uno o varios PDFs de Camara de Comercio, delega la extraccion
    al servicio nlp-camara y persiste los resultados.
    """
    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        archivos = request.FILES.getlist('archivos')
        if not archivos:
            return Response(
                {'error': 'Se requiere al menos un archivo PDF.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Buscar o crear la automatizacion SARLAFT en el catalogo
        automation, _ = Automation.objects.get_or_create(
            module='sarlaft',
            name='Extraccion Camara de Comercio',
            defaults={'description': 'Extrae datos de certificados de existencia via nlp-camara.'},
        )

        # Registrar ejecucion
        execution = Execution.objects.create(
            automation=automation,
            status='running',
            start_time=timezone.now(),
            triggered_by=request.user,
        )
        ExecutionLog.objects.create(
            execution=execution,
            level='info',
            message=f'Iniciando extraccion de {len(archivos)} certificado(s).',
        )

        try:
            respuesta = NlpCamaraClient().extraer_certificados(archivos)
        except Exception as exc:
            execution.status = 'failed'
            execution.end_time = timezone.now()
            execution.save()
            ExecutionLog.objects.create(
                execution=execution,
                level='error',
                message=f'Error al contactar nlp-camara: {exc}',
            )
            return Response(
                {'error': f'Servicio nlp-camara no disponible: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Persistir resultados
        certificados_creados = []
        for dato in respuesta.get('resultados', []):
            cert = CertificadoCamara.objects.create(
                execution=execution,
                archivo=dato.get('archivo', ''),
                razon_social=dato.get('razon_social', ''),
                nit=dato.get('nit', ''),
                representante=dato.get('representante', ''),
                tipo_doc=dato.get('tipo_doc', ''),
                cedula=dato.get('cedula', ''),
            )
            certificados_creados.append(cert)
            ExecutionLog.objects.create(
                execution=execution,
                level='info',
                message=f"Procesado: {dato.get('archivo')} → {dato.get('razon_social')} ({dato.get('nit')})",
            )

        for error in respuesta.get('errores', []):
            ExecutionLog.objects.create(
                execution=execution,
                level='error',
                message=f"Error en {error.get('archivo')}: {error.get('error')}",
            )

        execution.status = 'success' if not respuesta.get('errores') else 'failed'
        execution.end_time = timezone.now()
        execution.save()

        return Response({
            'execution_id': execution.id,
            'resultados': CertificadoCamaraSerializer(certificados_creados, many=True).data,
            'errores': respuesta.get('errores', []),
        }, status=status.HTTP_201_CREATED)
