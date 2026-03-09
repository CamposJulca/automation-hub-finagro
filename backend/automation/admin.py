from django.contrib import admin
from .models import Automation


@admin.register(Automation)
class AutomationAdmin(admin.ModelAdmin):
    list_display = ('name', 'module', 'active', 'created_at')
    list_filter = ('module', 'active')
    search_fields = ('name', 'description')
