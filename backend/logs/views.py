from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import ExecutionLog
from .serializers import ExecutionLogSerializer


class ExecutionLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ExecutionLog.objects.select_related('execution').all()
    serializer_class = ExecutionLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['timestamp']

    def get_queryset(self):
        qs = super().get_queryset()
        execution_id = self.request.query_params.get('execution')
        level = self.request.query_params.get('level')
        if execution_id:
            qs = qs.filter(execution_id=execution_id)
        if level:
            qs = qs.filter(level=level)
        return qs
