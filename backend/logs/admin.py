from django.contrib import admin
from .models import ExecutionLog


@admin.register(ExecutionLog)
class ExecutionLogAdmin(admin.ModelAdmin):
    list_display = ('execution', 'level', 'message', 'timestamp')
    list_filter = ('level',)
    raw_id_fields = ('execution',)
