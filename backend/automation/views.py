from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Automation, NecesidadInnovacion
from .serializers import AutomationSerializer, NecesidadInnovacionSerializer

TIPO_VALOR = {'Operativo': 3, 'Normativo': 2, 'Estrategico': 1}


def calcular_scores(necesidades):
    """
    Fórmula del Excel:
      score = (rec / max_rec) * 0.30
            + (dur / max_dur) * 0.25
            + (riesgo / 3)   * 0.30
            + (tipo_val / 3) * 0.15
    max_rec y max_dur son dinámicos sobre el dataset.
    """
    if not necesidades:
        return []
    max_rec = max(n.recurrencia_mensual for n in necesidades) or 1
    max_dur = max(float(n.duracion_horas) for n in necesidades) or 1
    result = []
    for n in necesidades:
        tipo_val = TIPO_VALOR.get(n.tipo_objetivo, 1)
        score = (
            (n.recurrencia_mensual / max_rec) * 0.30 +
            (float(n.duracion_horas) / max_dur) * 0.25 +
            (n.riesgo / 3) * 0.30 +
            (tipo_val / 3) * 0.15
        )
        result.append((n, round(score, 4)))
    result.sort(key=lambda x: x[1], reverse=True)
    return result


class AutomationViewSet(viewsets.ModelViewSet):
    queryset = Automation.objects.all()
    serializer_class = AutomationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'module', 'description']

    def get_queryset(self):
        qs = super().get_queryset()
        module = self.request.query_params.get('module')
        active = self.request.query_params.get('active')
        if module:
            qs = qs.filter(module=module)
        if active is not None:
            qs = qs.filter(active=active.lower() == 'true')
        return qs


class NecesidadInnovacionViewSet(viewsets.ModelViewSet):
    queryset = NecesidadInnovacion.objects.all()
    serializer_class = NecesidadInnovacionSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        necesidades = list(self.get_queryset())
        scored = calcular_scores(necesidades)
        data = []
        for necesidad, score in scored:
            s = NecesidadInnovacionSerializer(necesidad)
            item = s.data
            item['puntuacion'] = score
            data.append(item)
        return Response(data)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        # Recalcular y devolver la lista completa con scores
        necesidades = list(NecesidadInnovacion.objects.all())
        scored = calcular_scores(necesidades)
        data = []
        for necesidad, score in scored:
            s = NecesidadInnovacionSerializer(necesidad)
            item = s.data
            item['puntuacion'] = score
            data.append(item)
        return Response(data, status=response.status_code)
