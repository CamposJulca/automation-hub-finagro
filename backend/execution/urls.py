from rest_framework.routers import DefaultRouter
from .views import ExecutionViewSet

router = DefaultRouter()
router.register(r'executions', ExecutionViewSet)

urlpatterns = router.urls
