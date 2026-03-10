from rest_framework import serializers
from .models import FacturaElectronica


class FacturaElectronicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacturaElectronica
        fields = [
            'id', 'proveedor_nit', 'numero_factura', 'codigo',
            'valor_factura', 'iva_facturado_proveedor',
            'fecha_emision', 'fecha_vencimiento',
            'observaciones', 'archivo', 'procesado_en',
        ]
