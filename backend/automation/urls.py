from rest_framework.routers import DefaultRouter
from .views import AutomationViewSet, NecesidadInnovacionViewSet

router = DefaultRouter()
router.register(r'automations', AutomationViewSet)
router.register(r'innovacion', NecesidadInnovacionViewSet)

urlpatterns = router.urls
