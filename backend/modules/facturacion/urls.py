from django.urls import path
from .views import (
    DescargarFacturasView, ProcesarFacturasView, ListarFacturasView,
    DescargarStreamView, ProcesarStreamView, AbortarView, StatsDescargaView,
)

urlpatterns = [
    path('descargar/',        DescargarFacturasView.as_view(), name='facturacion-descargar'),
    path('procesar/',         ProcesarFacturasView.as_view(),  name='facturacion-procesar'),
    path('facturas/',         ListarFacturasView.as_view(),    name='facturacion-facturas'),
    path('stats/',            StatsDescargaView.as_view(),     name='facturacion-stats'),
    path('descargar/stream/', DescargarStreamView.as_view(),   name='facturacion-descargar-stream'),
    path('procesar/stream/',  ProcesarStreamView.as_view(),    name='facturacion-procesar-stream'),
    path('abortar/',          AbortarView.as_view(),           name='facturacion-abortar'),
]
