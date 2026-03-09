from rest_framework import serializers
from .models import CertificadoCamara


class CertificadoCamaraSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificadoCamara
        fields = '__all__'
