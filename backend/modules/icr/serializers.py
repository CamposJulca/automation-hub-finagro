from rest_framework import serializers
from .models import (
    ContratoICR, BolsaICR, ReglaICR, PorcentajeICR,
    InscripcionICR, EvaluacionRegla,
)


class ReglaICRSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = ReglaICR
        fields = ['id', 'bolsa', 'tipo', 'tipo_display', 'parametro', 'descripcion', 'activa', 'orden', 'creado_en']


class PorcentajeICRSerializer(serializers.ModelSerializer):
    tipo_productor_display = serializers.CharField(source='get_tipo_productor_display', read_only=True)
    tope_valor_credito     = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)

    class Meta:
        model = PorcentajeICR
        fields = [
            'id', 'bolsa', 'tipo_productor', 'tipo_productor_display',
            'porcentaje', 'tope_uvb', 'valor_uvb', 'tope_valor_credito',
        ]


class BolsaICRSerializer(serializers.ModelSerializer):
    reglas            = ReglaICRSerializer(many=True, read_only=True)
    porcentajes       = PorcentajeICRSerializer(many=True, read_only=True)
    valor_comprometido = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    valor_disponible   = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    contrato_nombre    = serializers.CharField(source='contrato.nombre', read_only=True)
    contrato_codigo    = serializers.CharField(source='contrato.codigo', read_only=True)

    class Meta:
        model = BolsaICR
        fields = [
            'id', 'contrato', 'contrato_codigo', 'contrato_nombre',
            'nombre', 'codigo', 'valor_asignado', 'valor_comprometido', 'valor_disponible',
            'inscripcion_automatica', 'activa', 'creado_en', 'actualizado_en',
            'reglas', 'porcentajes',
        ]


class BolsaICRResumenSerializer(serializers.ModelSerializer):
    """Versión ligera de BolsaICR sin reglas ni porcentajes anidados."""
    valor_comprometido = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    valor_disponible   = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    contrato_codigo    = serializers.CharField(source='contrato.codigo', read_only=True)

    class Meta:
        model = BolsaICR
        fields = [
            'id', 'contrato', 'contrato_codigo', 'nombre', 'codigo',
            'valor_asignado', 'valor_comprometido', 'valor_disponible',
            'inscripcion_automatica', 'activa',
        ]


class ContratoICRSerializer(serializers.ModelSerializer):
    bolsas             = BolsaICRResumenSerializer(many=True, read_only=True)
    valor_comprometido = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    valor_disponible   = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    tipo_display       = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = ContratoICR
        fields = [
            'id', 'codigo', 'nombre', 'tipo', 'tipo_display',
            'valor_total', 'valor_comprometido', 'valor_disponible',
            'periodo_inicio', 'periodo_fin', 'activo', 'creado_en',
            'bolsas',
        ]


class EvaluacionReglaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluacionRegla
        fields = [
            'id', 'inscripcion', 'regla', 'codigo_regla',
            'descripcion', 'valor_evaluado', 'resultado', 'evaluado_en',
        ]


class InscripcionICRSerializer(serializers.ModelSerializer):
    estado_display         = serializers.CharField(source='get_estado_display', read_only=True)
    tipo_productor_display = serializers.CharField(source='get_tipo_productor_display', read_only=True)
    bolsa_nombre           = serializers.CharField(source='bolsa.nombre', read_only=True, default=None)
    bolsa_codigo           = serializers.CharField(source='bolsa.codigo', read_only=True, default=None)
    contrato_codigo        = serializers.CharField(source='bolsa.contrato.codigo', read_only=True, default=None)
    formalizado_por_nombre = serializers.CharField(source='formalizado_por.username', read_only=True, default=None)
    es_elegible            = serializers.BooleanField(read_only=True)

    class Meta:
        model = InscripcionICR
        fields = [
            'id', 'id_agros', 'productor_id', 'tipo_productor', 'tipo_productor_display',
            'valor_credito', 'fecha_credito', 'actividad', 'intermediario',
            'departamento', 'municipio',
            'estado', 'estado_display',
            'bolsa', 'bolsa_codigo', 'bolsa_nombre', 'contrato_codigo',
            'porcentaje_icr', 'valor_icr', 'motivo_no_elegible', 'es_elegible',
            'consecutivo', 'formalizado_por', 'formalizado_por_nombre', 'formalizado_en',
            'anulado_en', 'motivo_anulacion',
            'importado_en', 'preinscrito_en',
        ]
        read_only_fields = [
            'estado', 'porcentaje_icr', 'valor_icr', 'consecutivo',
            'formalizado_por', 'formalizado_en', 'anulado_en', 'preinscrito_en',
        ]
