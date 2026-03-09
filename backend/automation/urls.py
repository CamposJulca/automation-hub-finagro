from rest_framework.routers import DefaultRouter
from .views import AutomationViewSet

router = DefaultRouter()
router.register(r'automations', AutomationViewSet)

urlpatterns = router.urls
