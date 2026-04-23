from django.db import models
from execution.models import Execution


class FacturaElectronica(models.Model):

    TIPO_CHOICES = [
        ('Invoice',    'Factura Electrónica'),
        ('CreditNote', 'Nota Crédito'),
        ('DebitNote',  'Nota Débito'),
        ('SinXML',     'Sin XML'),
        ('Unknown',    'Desconocido'),
    ]

    execution = models.ForeignKey(
        Execution, on_delete=models.CASCADE, related_name='facturas'
    )
    tipo_documento = models.CharField(max_length=30, choices=TIPO_CHOICES, default='Invoice')
    proveedor_nit = models.CharField(max_length=50, blank=True)
    numero_factura = models.CharField(max_length=500, blank=True)
    codigo = models.CharField(max_length=20, blank=True)
    valor_factura = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    iva_facturado_proveedor = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    fecha_emision = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    archivo = models.CharField(max_length=1000, blank=True)
    procesado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-procesado_en']
        unique_together = ['tipo_documento', 'proveedor_nit', 'numero_factura']

    def __str__(self):
        return f'[{self.tipo_documento}] {self.numero_factura} - NIT {self.proveedor_nit}'
