from django.urls import path
from .views import ExtraerCertificadosView

urlpatterns = [
    path('certificados/', ExtraerCertificadosView.as_view(), name='sarlaft-certificados'),
]
