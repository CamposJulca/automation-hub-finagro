from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import Automation
from .serializers import AutomationSerializer


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
