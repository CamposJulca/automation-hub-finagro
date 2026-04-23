from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('automation.urls')),
    path('api/', include('execution.urls')),
    path('api/', include('logs.urls')),
    path('api/facturacion/',  include('modules.facturacion.urls')),
    path('api/icr/',          include('modules.icr.urls')),
]
