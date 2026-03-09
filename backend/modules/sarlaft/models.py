from django.db import models
from execution.models import Execution


class CertificadoCamara(models.Model):
    execution = models.ForeignKey(
        Execution, on_delete=models.CASCADE, related_name='certificados'
    )
    archivo = models.CharField(max_length=255)
    razon_social = models.CharField(max_length=500, blank=True)
    nit = models.CharField(max_length=50, blank=True)
    representante = models.CharField(max_length=255, blank=True)
    tipo_doc = models.CharField(max_length=20, blank=True)
    cedula = models.CharField(max_length=50, blank=True)
    procesado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-procesado_en']

    def __str__(self):
        return f'{self.razon_social} ({self.nit})'
