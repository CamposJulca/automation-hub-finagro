from rest_framework import serializers
from .models import Automation


class AutomationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Automation
        fields = '__all__'
