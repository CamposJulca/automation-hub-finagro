from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import Execution
from .serializers import ExecutionSerializer


class ExecutionViewSet(viewsets.ModelViewSet):
    queryset = Execution.objects.select_related('automation', 'triggered_by').all()
    serializer_class = ExecutionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['start_time', 'status']

    def get_queryset(self):
        qs = super().get_queryset()
        automation_id = self.request.query_params.get('automation')
        status = self.request.query_params.get('status')
        if automation_id:
            qs = qs.filter(automation_id=automation_id)
        if status:
            qs = qs.filter(status=status)
        return qs
