from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum, Q
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from automation.models import Automation
from execution.models import Execution
from logs.models import ExecutionLog

from .models import (
    ContratoICR, BolsaICR, ReglaICR, PorcentajeICR,
    InscripcionICR, EvaluacionRegla,
)
from .serializers import (
    ContratoICRSerializer, BolsaICRSerializer, BolsaICRResumenSerializer,
    ReglaICRSerializer, PorcentajeICRSerializer,
    InscripcionICRSerializer, EvaluacionReglaSerializer,
)
from .services.etl_agros import importar_desde_excel, importar_desde_csv
from .services.rule_engine import BolsaRuleEngine
from .services.consecutivo import generar_consecutivo


def _get_or_create_automation(nombre='Evaluación ICR'):
    auto, _ = Automation.objects.get_or_create(
        module='icr', name=nombre,
        defaults={'description': 'Incentivo a la Capitalización Rural — gestión de inscripciones.'},
    )
    return auto


# ═══════════════════════════════════════════════════════════════════════════════
# A. CATÁLOGO CRUD — Contratos, Bolsas, Reglas, Porcentajes
# ═══════════════════════════════════════════════════════════════════════════════

class ContratosListView(APIView):
    """GET /api/icr/contratos/   POST /api/icr/contratos/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ContratoICR.objects.prefetch_related('bolsas').all()
        return Response(ContratoICRSerializer(qs, many=True).data)

    def post(self, request):
        ser = ContratoICRSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class ContratoDetailView(APIView):
    """GET/PUT/DELETE /api/icr/contratos/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return ContratoICR.objects.prefetch_related('bolsas').get(pk=pk)
        except ContratoICR.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        return Response(ContratoICRSerializer(obj).data)

    def put(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        ser = ContratoICRSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BolsasListView(APIView):
    """GET /api/icr/bolsas/?contrato_id=   POST /api/icr/bolsas/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = BolsaICR.objects.select_related('contrato').prefetch_related('reglas', 'porcentajes')
        contrato_id = request.query_params.get('contrato_id')
        if contrato_id:
            qs = qs.filter(contrato_id=contrato_id)
        return Response(BolsaICRSerializer(qs, many=True).data)

    def post(self, request):
        ser = BolsaICRSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class BolsaDetailView(APIView):
    """GET/PUT/DELETE /api/icr/bolsas/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return BolsaICR.objects.select_related('contrato').prefetch_related('reglas', 'porcentajes').get(pk=pk)
        except BolsaICR.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        return Response(BolsaICRSerializer(obj).data)

    def put(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        ser = BolsaICRSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReglasListView(APIView):
    """GET /api/icr/reglas/?bolsa_id=   POST /api/icr/reglas/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ReglaICR.objects.select_related('bolsa')
        bolsa_id = request.query_params.get('bolsa_id')
        if bolsa_id:
            qs = qs.filter(bolsa_id=bolsa_id)
        return Response(ReglaICRSerializer(qs, many=True).data)

    def post(self, request):
        ser = ReglaICRSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class ReglaDetailView(APIView):
    """GET/PUT/DELETE /api/icr/reglas/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return ReglaICR.objects.get(pk=pk)
        except ReglaICR.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        return Response(ReglaICRSerializer(obj).data)

    def put(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        ser = ReglaICRSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PorcentajesListView(APIView):
    """GET /api/icr/porcentajes/?bolsa_id=   POST /api/icr/porcentajes/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = PorcentajeICR.objects.select_related('bolsa')
        bolsa_id = request.query_params.get('bolsa_id')
        if bolsa_id:
            qs = qs.filter(bolsa_id=bolsa_id)
        return Response(PorcentajeICRSerializer(qs, many=True).data)

    def post(self, request):
        ser = PorcentajeICRSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class PorcentajeDetailView(APIView):
    """GET/PUT/DELETE /api/icr/porcentajes/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return PorcentajeICR.objects.get(pk=pk)
        except PorcentajeICR.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        return Response(PorcentajeICRSerializer(obj).data)

    def put(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        ser = PorcentajeICRSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'error': 'No encontrado.'}, status=404)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════════
# B. ACCIONES DEL CICLO DE VIDA
# ═══════════════════════════════════════════════════════════════════════════════

class ImportarInscripcionesView(APIView):
    """
    POST /api/icr/importar/

    Importa operaciones de crédito desde Excel (.xlsx) o CSV (.csv).
    Crea InscripcionICR en estado 'sin_evaluar'.
    """
    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'error': 'Se requiere campo "archivo" (.xlsx o .csv).'}, status=400)

        nombre = archivo.name.lower()
        if nombre.endswith('.xlsx'):
            validos, errores_parse = importar_desde_excel(archivo)
        elif nombre.endswith('.csv'):
            validos, errores_parse = importar_desde_csv(archivo)
        else:
            return Response({'error': 'Formato no soportado. Use .xlsx o .csv.'}, status=400)

        automation = _get_or_create_automation('Importación AGROS')
        execution = Execution.objects.create(
            automation=automation, status='running',
            start_time=timezone.now(), triggered_by=request.user,
        )
        ExecutionLog.objects.create(
            execution=execution, level='info',
            message=f'Importando "{archivo.name}": {len(validos)} filas válidas, {len(errores_parse)} con error.',
        )

        importadas, errores_db = 0, []
        for datos in validos:
            try:
                InscripcionICR.objects.update_or_create(
                    id_agros=datos['id_agros'],
                    defaults={**datos, 'execution': execution, 'estado': 'sin_evaluar'},
                )
                importadas += 1
            except Exception as exc:
                msg = f'Error en {datos["id_agros"]}: {exc}'
                errores_db.append(msg)
                ExecutionLog.objects.create(execution=execution, level='error', message=msg)

        execution.status = 'success' if not errores_db else 'failed'
        execution.end_time = timezone.now()
        execution.save()
        ExecutionLog.objects.create(
            execution=execution, level='info',
            message=f'Importación completada: {importadas} operaciones.',
        )

        return Response({
            'execution_id': execution.id,
            'operaciones_importadas': importadas,
            'errores_parseo': errores_parse,
            'errores_db': errores_db,
        }, status=201)


class PreinscribirView(APIView):
    """
    POST /api/icr/preinscribir/

    Evalúa todas las operaciones en estado 'sin_evaluar' contra las reglas
    de las bolsas activas. Las elegibles pasan a 'preinscrita' (o 'inscrita'
    si la bolsa tiene inscripcion_automatica=True).

    Body opcional: {"bolsa_id": <int>}  para usar una bolsa específica.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        bolsa_id = request.data.get('bolsa_id')
        pendientes = InscripcionICR.objects.filter(estado='sin_evaluar')
        if not pendientes.exists():
            return Response({'mensaje': 'No hay operaciones sin evaluar.', 'evaluadas': 0})

        # Determinar bolsas a evaluar
        if bolsa_id:
            try:
                bolsas = [BolsaICR.objects.get(pk=bolsa_id, activa=True)]
            except BolsaICR.DoesNotExist:
                return Response({'error': 'Bolsa no encontrada o inactiva.'}, status=400)
        else:
            bolsas = list(BolsaICR.objects.filter(activa=True).select_related('contrato').filter(contrato__activo=True))

        if not bolsas:
            return Response({'error': 'No hay bolsas activas configuradas.'}, status=400)

        automation = _get_or_create_automation('Preinscripción ICR')
        execution = Execution.objects.create(
            automation=automation, status='running',
            start_time=timezone.now(), triggered_by=request.user,
        )
        ExecutionLog.objects.create(
            execution=execution, level='info',
            message=f'Evaluando {pendientes.count()} operaciones contra {len(bolsas)} bolsa(s).',
        )

        preinscriptas, no_elegibles, auto_inscritas = 0, 0, 0

        for ins in pendientes.select_related('bolsa'):
            bolsa_match, engine, resultados = BolsaRuleEngine.encontrar_bolsa(ins, bolsas)
            todas_ok = bolsa_match is not None

            # Limpiar evaluaciones previas y persistir nuevas
            ins.evaluaciones.all().delete()
            if resultados:
                EvaluacionRegla.objects.bulk_create([
                    EvaluacionRegla(
                        inscripcion=ins,
                        regla=r.get('regla_obj'),
                        codigo_regla=r['codigo_regla'],
                        descripcion=r['descripcion'],
                        valor_evaluado=r['valor_evaluado'],
                        resultado=r['resultado'],
                    )
                    for r in resultados
                ])
            elif not bolsas:
                # Sin reglas configuradas → no elegible
                pass

            if todas_ok:
                porcentaje, valor_icr = engine.calcular_icr(ins, True)
                ins.bolsa = bolsa_match
                ins.porcentaje_icr = porcentaje
                ins.valor_icr = valor_icr
                ins.motivo_no_elegible = ''
                ins.preinscrito_en = timezone.now()

                if bolsa_match.inscripcion_automatica:
                    # Inscripción automática (HU56)
                    with transaction.atomic():
                        ins.consecutivo = generar_consecutivo(bolsa_match)
                        ins.estado = 'inscrita'
                        ins.formalizado_por = request.user
                        ins.formalizado_en = timezone.now()
                    auto_inscritas += 1
                    ExecutionLog.objects.create(
                        execution=execution, level='info',
                        message=f'Op {ins.id_agros}: AUTO-INSCRITA {ins.consecutivo} | ICR {int(porcentaje*100)}% = ${valor_icr:,.0f}',
                    )
                else:
                    ins.estado = 'preinscrita'
                    preinscriptas += 1
                    ExecutionLog.objects.create(
                        execution=execution, level='info',
                        message=f'Op {ins.id_agros}: PREINSCRITA | ICR {int(porcentaje*100)}% = ${valor_icr:,.0f}',
                    )
            else:
                # Construir motivo con las reglas que fallaron (si se evaluaron)
                if resultados:
                    fallos = [r['descripcion'] for r in resultados if not r['resultado']]
                    motivo = ' | '.join(fallos) if fallos else 'Sin bolsa activa con presupuesto disponible.'
                else:
                    motivo = 'Sin bolsas configuradas o sin presupuesto disponible.'
                ins.estado = 'no_elegible'
                ins.motivo_no_elegible = motivo
                no_elegibles += 1
                ExecutionLog.objects.create(
                    execution=execution, level='warning',
                    message=f'Op {ins.id_agros}: NO ELEGIBLE — {motivo[:120]}',
                )

            ins.save()

        execution.status = 'success'
        execution.end_time = timezone.now()
        execution.save()

        return Response({
            'execution_id': execution.id,
            'preinscriptas':  preinscriptas,
            'auto_inscritas': auto_inscritas,
            'no_elegibles':   no_elegibles,
            'total_evaluadas': preinscriptas + no_elegibles + auto_inscritas,
        })


class FormalizarView(APIView):
    """
    POST /api/icr/formalizar/

    Confirma preinscripciones pendientes → estado 'inscrita' + consecutivo.
    Body: {"inscripcion_ids": [1, 2, 3]}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('inscripcion_ids', [])
        if not ids:
            return Response({'error': 'Se requiere "inscripcion_ids".'}, status=400)

        formalizadas = []
        errores = []

        with transaction.atomic():
            inscripciones = (
                InscripcionICR.objects
                .select_for_update()
                .filter(id__in=ids, estado='preinscrita')
                .select_related('bolsa')
            )

            for ins in inscripciones:
                try:
                    ins.consecutivo    = generar_consecutivo(ins.bolsa)
                    ins.estado         = 'inscrita'
                    ins.formalizado_por = request.user
                    ins.formalizado_en  = timezone.now()
                    ins.save()
                    formalizadas.append({'id': ins.id, 'id_agros': ins.id_agros, 'consecutivo': ins.consecutivo})
                except Exception as exc:
                    errores.append({'id': ins.id, 'error': str(exc)})

        return Response({
            'formalizadas': formalizadas,
            'total': len(formalizadas),
            'errores': errores,
        })


class AnularView(APIView):
    """
    POST /api/icr/anular/

    Anula inscripciones en estado preinscrita o inscrita.
    Body: {"inscripcion_ids": [1, 2], "motivo": "..."}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids    = request.data.get('inscripcion_ids', [])
        motivo = request.data.get('motivo', '').strip()
        if not ids:
            return Response({'error': 'Se requiere "inscripcion_ids".'}, status=400)
        if not motivo:
            return Response({'error': 'Se requiere "motivo" de anulación.'}, status=400)

        anuladas = (
            InscripcionICR.objects
            .filter(id__in=ids, estado__in=['preinscrita', 'inscrita'])
            .update(
                estado='anulada',
                anulado_en=timezone.now(),
                motivo_anulacion=motivo,
            )
        )
        return Response({'anuladas': anuladas})


# ═══════════════════════════════════════════════════════════════════════════════
# C. CONSULTA
# ═══════════════════════════════════════════════════════════════════════════════

class InscripcionesListView(APIView):
    """
    GET /api/icr/inscripciones/

    Filtros: ?estado= ?bolsa_id= ?contrato_id= ?tipo_productor= ?search=
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = InscripcionICR.objects.select_related('bolsa__contrato', 'formalizado_por')

        estado        = request.query_params.get('estado')
        bolsa_id      = request.query_params.get('bolsa_id')
        contrato_id   = request.query_params.get('contrato_id')
        tipo_productor = request.query_params.get('tipo_productor')
        search        = request.query_params.get('search', '').strip()

        if estado:
            qs = qs.filter(estado=estado)
        if bolsa_id:
            qs = qs.filter(bolsa_id=bolsa_id)
        if contrato_id:
            qs = qs.filter(bolsa__contrato_id=contrato_id)
        if tipo_productor:
            qs = qs.filter(tipo_productor=tipo_productor)
        if search:
            qs = qs.filter(
                Q(id_agros__icontains=search) |
                Q(productor_id__icontains=search) |
                Q(municipio__icontains=search) |
                Q(departamento__icontains=search) |
                Q(consecutivo__icontains=search) |
                Q(intermediario__icontains=search)
            )

        return Response({
            'inscripciones': InscripcionICRSerializer(qs, many=True).data,
            'total': qs.count(),
        })


class InscripcionDetailView(APIView):
    """GET /api/icr/inscripciones/<pk>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            ins = InscripcionICR.objects.select_related('bolsa__contrato', 'formalizado_por').get(pk=pk)
        except InscripcionICR.DoesNotExist:
            return Response({'error': 'No encontrada.'}, status=404)
        return Response(InscripcionICRSerializer(ins).data)


class StatsView(APIView):
    """
    GET /api/icr/stats/

    Retorna KPIs para el dashboard: por estado, por bolsa, totales.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Por estado
        por_estado = {
            row['estado']: row['total']
            for row in InscripcionICR.objects.values('estado').annotate(total=Count('id'))
        }

        # Por bolsa
        bolsas_data = []
        for bolsa in BolsaICR.objects.select_related('contrato').filter(activa=True):
            inscritas    = InscripcionICR.objects.filter(bolsa=bolsa, estado='inscrita')
            preinscriptas = InscripcionICR.objects.filter(bolsa=bolsa, estado='preinscrita')
            valor_icr    = inscritas.aggregate(total=Sum('valor_icr'))['total'] or Decimal('0')

            bolsas_data.append({
                'bolsa_id':          bolsa.id,
                'bolsa_codigo':      bolsa.codigo,
                'bolsa_nombre':      bolsa.nombre,
                'contrato_codigo':   bolsa.contrato.codigo,
                'valor_asignado':    bolsa.valor_asignado,
                'valor_comprometido': valor_icr,
                'valor_disponible':  bolsa.valor_asignado - valor_icr,
                'inscritas':         inscritas.count(),
                'preinscriptas':     preinscriptas.count(),
            })

        # Totales
        totales_agg = InscripcionICR.objects.filter(estado='inscrita').aggregate(
            valor_icr_total=Sum('valor_icr'),
            total=Count('id'),
        )

        return Response({
            'por_estado':   por_estado,
            'por_bolsa':    bolsas_data,
            'totales': {
                'valor_icr_inscrito':   totales_agg['valor_icr_total'] or 0,
                'total_inscritas':      totales_agg['total'] or 0,
                'total_inscripciones':  InscripcionICR.objects.count(),
            },
        })


class AuditoriaView(APIView):
    """
    GET /api/icr/auditoria/?inscripcion_id=<id>

    Retorna las evaluaciones de reglas registradas para una inscripción.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = EvaluacionRegla.objects.select_related('inscripcion', 'regla').all()
        inscripcion_id = request.query_params.get('inscripcion_id')
        if inscripcion_id:
            qs = qs.filter(inscripcion_id=inscripcion_id)
        return Response({
            'evaluaciones': EvaluacionReglaSerializer(qs, many=True).data,
            'total': qs.count(),
        })
