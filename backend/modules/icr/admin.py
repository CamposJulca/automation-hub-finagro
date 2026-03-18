from django.contrib import admin
from .models import ContratoICR, BolsaICR, ReglaICR, PorcentajeICR, InscripcionICR, EvaluacionRegla


@admin.register(ContratoICR)
class ContratoICRAdmin(admin.ModelAdmin):
    list_display  = ['codigo', 'nombre', 'tipo', 'valor_total', 'periodo_inicio', 'periodo_fin', 'activo']
    list_filter   = ['tipo', 'activo']
    search_fields = ['codigo', 'nombre']


@admin.register(BolsaICR)
class BolsaICRAdmin(admin.ModelAdmin):
    list_display  = ['codigo', 'nombre', 'contrato', 'valor_asignado', 'inscripcion_automatica', 'activa']
    list_filter   = ['activa', 'inscripcion_automatica', 'contrato']
    search_fields = ['codigo', 'nombre']


@admin.register(ReglaICR)
class ReglaICRAdmin(admin.ModelAdmin):
    list_display  = ['bolsa', 'tipo', 'parametro', 'activa', 'orden']
    list_filter   = ['tipo', 'activa', 'bolsa']


@admin.register(PorcentajeICR)
class PorcentajeICRAdmin(admin.ModelAdmin):
    list_display = ['bolsa', 'tipo_productor', 'porcentaje', 'tope_uvb', 'valor_uvb']
    list_filter  = ['tipo_productor', 'bolsa']


@admin.register(InscripcionICR)
class InscripcionICRAdmin(admin.ModelAdmin):
    list_display  = ['id_agros', 'tipo_productor', 'valor_credito', 'estado', 'consecutivo', 'bolsa', 'importado_en']
    list_filter   = ['estado', 'tipo_productor', 'bolsa']
    search_fields = ['id_agros', 'productor_id', 'consecutivo', 'intermediario']
    ordering      = ['-importado_en']


@admin.register(EvaluacionRegla)
class EvaluacionReglaAdmin(admin.ModelAdmin):
    list_display  = ['inscripcion', 'codigo_regla', 'valor_evaluado', 'resultado', 'evaluado_en']
    list_filter   = ['resultado']
    search_fields = ['inscripcion__id_agros', 'codigo_regla']
