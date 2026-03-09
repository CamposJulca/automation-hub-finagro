from rest_framework import serializers
from .models import Execution


class ExecutionSerializer(serializers.ModelSerializer):
    automation_name = serializers.CharField(source='automation.name', read_only=True)
    triggered_by_username = serializers.CharField(source='triggered_by.username', read_only=True)

    class Meta:
        model = Execution
        fields = '__all__'
