from django.urls import path
from .views import (
    DescargarFacturasView, ProcesarFacturasView, ListarFacturasView,
    DescargarStreamView, ProcesarStreamView, AbortarView, StatsDescargaView,
    SincronizarCronView, CronLogView, DescargarCarpetasView, InfoCarpetasView,
    ListarSemanasView, DescargarPDFsView,
    DescargarScriptView, DescargarInstaladorView,
)

urlpatterns = [
    path('descargar/',                  DescargarFacturasView.as_view(),  name='facturacion-descargar'),
    path('procesar/',                   ProcesarFacturasView.as_view(),   name='facturacion-procesar'),
    path('facturas/',                   ListarFacturasView.as_view(),     name='facturacion-facturas'),
    path('stats/',                      StatsDescargaView.as_view(),      name='facturacion-stats'),
    path('descargar/stream/',           DescargarStreamView.as_view(),    name='facturacion-descargar-stream'),
    path('procesar/stream/',            ProcesarStreamView.as_view(),     name='facturacion-procesar-stream'),
    path('abortar/',                    AbortarView.as_view(),            name='facturacion-abortar'),
    path('sincronizar-cron/',           SincronizarCronView.as_view(),    name='facturacion-sincronizar-cron'),
    path('cron-log/',                   CronLogView.as_view(),            name='facturacion-cron-log'),
    path('descargar-carpetas/',         DescargarCarpetasView.as_view(),  name='facturacion-descargar-carpetas'),
    path('descargar-carpetas/info/',    InfoCarpetasView.as_view(),       name='facturacion-carpetas-info'),
    path('semanas/',                    ListarSemanasView.as_view(),      name='facturacion-semanas'),
    path('descargar-pdfs/',             DescargarPDFsView.as_view(),      name='facturacion-descargar-pdfs'),
    path('descargar-script/',           DescargarScriptView.as_view(),    name='facturacion-descargar-script'),
    path('descargar-instalador/',       DescargarInstaladorView.as_view(),name='facturacion-descargar-instalador'),
]
