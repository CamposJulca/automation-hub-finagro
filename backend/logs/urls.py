from rest_framework.routers import DefaultRouter
from .views import ExecutionLogViewSet

router = DefaultRouter()
router.register(r'logs', ExecutionLogViewSet)

urlpatterns = router.urls
