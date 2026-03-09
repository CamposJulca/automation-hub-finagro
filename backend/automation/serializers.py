from rest_framework import serializers
from .models import Automation, NecesidadInnovacion


class AutomationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Automation
        fields = '__all__'


class NecesidadInnovacionSerializer(serializers.ModelSerializer):
    puntuacion = serializers.FloatField(read_only=True, default=None)

    class Meta:
        model = NecesidadInnovacion
        fields = '__all__'
