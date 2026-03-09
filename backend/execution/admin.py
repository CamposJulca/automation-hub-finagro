from django.contrib import admin
from .models import Execution


@admin.register(Execution)
class ExecutionAdmin(admin.ModelAdmin):
    list_display = ('automation', 'status', 'start_time', 'end_time', 'triggered_by')
    list_filter = ('status',)
    raw_id_fields = ('automation', 'triggered_by')
