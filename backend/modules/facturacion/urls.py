from django.urls import path
from .views import DescargarFacturasView, ProcesarFacturasView, ListarFacturasView

urlpatterns = [
    path('descargar/', DescargarFacturasView.as_view(), name='facturacion-descargar'),
    path('procesar/',  ProcesarFacturasView.as_view(),  name='facturacion-procesar'),
    path('facturas/',  ListarFacturasView.as_view(),    name='facturacion-facturas'),
]
