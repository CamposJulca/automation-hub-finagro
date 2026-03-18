from decimal import Decimal
from django.db import models
from execution.models import Execution

# ── Choices ───────────────────────────────────────────────────────────────────

TIPO_PRODUCTOR_CHOICES = [
    ('pequeño',  'Pequeño Productor'),
    ('mediano',  'Mediano Productor'),
    ('grande',   'Grande Productor'),
]

TIPO_CONTRATO_CHOICES = [
    ('nacional',       'Nacional'),
    ('complementario', 'Complementario'),
]

TIPO_REGLA_CHOICES = [
    ('tipo_productor', 'Tipo de Productor'),
    ('valor_minimo',   'Valor Mínimo de Crédito'),
    ('valor_maximo',   'Valor Máximo de Crédito (SMMLV)'),
    ('fecha_vigencia', 'Fecha de Vigencia'),
    ('actividad',      'Actividad Elegible'),
    ('municipio',      'Municipio/Departamento Habilitado'),
]

ESTADO_INSCRIPCION_CHOICES = [
    ('sin_evaluar', 'Sin Evaluar'),
    ('preinscrita', 'Preinscrita'),
    ('no_elegible', 'No Elegible'),
    ('inscrita',    'Inscrita'),
    ('anulada',     'Anulada'),
]


# ── ContratoICR ───────────────────────────────────────────────────────────────

class ContratoICR(models.Model):
    """
    Contrato presupuestal que financia los incentivos ICR.
    Contiene una o varias bolsas que subdividen el presupuesto.
    """
    codigo         = models.CharField(max_length=50, unique=True)
    nombre         = models.CharField(max_length=255)
    tipo           = models.CharField(max_length=20, choices=TIPO_CONTRATO_CHOICES)
    valor_total    = models.DecimalField(max_digits=20, decimal_places=2)
    periodo_inicio = models.DateField()
    periodo_fin    = models.DateField()
    activo         = models.BooleanField(default=True)
    creado_en      = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-periodo_inicio']
        verbose_name = 'Contrato ICR'
        verbose_name_plural = 'Contratos ICR'

    def __str__(self):
        return f'{self.codigo} — {self.nombre}'

    @property
    def valor_comprometido(self):
        total = Decimal('0')
        for bolsa in self.bolsas.all():
            total += bolsa.valor_comprometido
        return total

    @property
    def valor_disponible(self):
        return self.valor_total - self.valor_comprometido


# ── BolsaICR ──────────────────────────────────────────────────────────────────

class BolsaICR(models.Model):
    """
    Bolsa presupuestal que subdivide el presupuesto de un contrato.
    Cada bolsa tiene sus propias reglas de elegibilidad y porcentajes ICR.
    """
    contrato               = models.ForeignKey(ContratoICR, on_delete=models.CASCADE, related_name='bolsas')
    nombre                 = models.CharField(max_length=255)
    codigo                 = models.CharField(max_length=50)
    valor_asignado         = models.DecimalField(max_digits=20, decimal_places=2)
    inscripcion_automatica = models.BooleanField(
        default=False,
        help_text='Si activo, las preinscripciones pasan directamente a inscrita sin revisión manual.',
    )
    activa         = models.BooleanField(default=True)
    creado_en      = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['contrato', 'nombre']
        unique_together = [('contrato', 'codigo')]
        verbose_name = 'Bolsa ICR'
        verbose_name_plural = 'Bolsas ICR'

    def __str__(self):
        return f'{self.contrato.codigo} / {self.codigo} — {self.nombre}'

    @property
    def valor_comprometido(self):
        from django.db.models import Sum
        result = self.inscripciones.filter(estado='inscrita').aggregate(total=Sum('valor_icr'))
        return result['total'] or Decimal('0')

    @property
    def valor_disponible(self):
        return self.valor_asignado - self.valor_comprometido


# ── ReglaICR ──────────────────────────────────────────────────────────────────

class ReglaICR(models.Model):
    """
    Regla de elegibilidad configurable asociada a una bolsa.

    El campo 'parametro' codifica el valor según el tipo:
      - tipo_productor : valores separados por coma. Ej: "pequeño,mediano"
      - valor_minimo   : decimal. Ej: "5000000"
      - valor_maximo   : decimal. Ej: "2135250000"
      - fecha_vigencia : rango ISO separado por coma. Ej: "2020-01-01,2030-12-31"
      - actividad      : palabras clave separadas por coma. Ej: "agricultura,ganaderia"
      - municipio      : municipios y/o departamentos separados por coma.
    """
    bolsa       = models.ForeignKey(BolsaICR, on_delete=models.CASCADE, related_name='reglas')
    tipo        = models.CharField(max_length=30, choices=TIPO_REGLA_CHOICES)
    parametro   = models.TextField(help_text='Valor(es) del parámetro según tipo, separados por coma.')
    descripcion = models.CharField(max_length=500, blank=True)
    activa      = models.BooleanField(default=True)
    orden       = models.PositiveSmallIntegerField(default=0)
    creado_en   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['bolsa', 'orden', 'tipo']
        verbose_name = 'Regla ICR'
        verbose_name_plural = 'Reglas ICR'

    def __str__(self):
        return f'{self.bolsa.codigo} | {self.get_tipo_display()}: {self.parametro[:60]}'


# ── PorcentajeICR ─────────────────────────────────────────────────────────────

class PorcentajeICR(models.Model):
    """
    Porcentaje de incentivo y tope UVB por tipo de productor para una bolsa.
    Una fila por (bolsa × tipo_productor).
    """
    bolsa          = models.ForeignKey(BolsaICR, on_delete=models.CASCADE, related_name='porcentajes')
    tipo_productor = models.CharField(max_length=20, choices=TIPO_PRODUCTOR_CHOICES)
    porcentaje     = models.DecimalField(
        max_digits=5, decimal_places=4,
        help_text='Fracción decimal. Ej: 0.40 = 40%',
    )
    tope_uvb       = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('8700'),
        help_text='Número máximo de UVBs aplicables al crédito.',
    )
    valor_uvb      = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('1423500'),
        help_text='Valor COP de 1 UVB (actualizable anualmente).',
    )

    class Meta:
        unique_together = [('bolsa', 'tipo_productor')]
        ordering = ['bolsa', 'tipo_productor']
        verbose_name = 'Porcentaje ICR'
        verbose_name_plural = 'Porcentajes ICR'

    def __str__(self):
        return f'{self.bolsa.codigo} | {self.tipo_productor}: {int(self.porcentaje * 100)}%'

    @property
    def tope_valor_credito(self):
        return (self.tope_uvb * self.valor_uvb).quantize(Decimal('0.01'))


# ── InscripcionICR ────────────────────────────────────────────────────────────

class InscripcionICR(models.Model):
    """
    Operación de crédito proveniente de AGROS que atraviesa el ciclo de vida ICR:
    sin_evaluar → preinscrita / no_elegible → inscrita / anulada
    """
    # ── Origen ───────────────────────────────────────────────────────────────
    execution      = models.ForeignKey(
        Execution, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='inscripciones_icr',
    )
    bolsa          = models.ForeignKey(
        BolsaICR, on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='inscripciones',
    )

    # ── Datos del crédito (AGROS) ─────────────────────────────────────────────
    id_agros       = models.CharField(max_length=100, unique=True, verbose_name='ID AGROS')
    productor_id   = models.CharField(max_length=100, verbose_name='ID Productor')
    tipo_productor = models.CharField(max_length=20, choices=TIPO_PRODUCTOR_CHOICES)
    valor_credito  = models.DecimalField(max_digits=18, decimal_places=2)
    fecha_credito  = models.DateField()
    actividad      = models.CharField(max_length=255)
    intermediario  = models.CharField(max_length=255, blank=True, verbose_name='Intermediario Financiero')
    departamento   = models.CharField(max_length=100, blank=True)
    municipio      = models.CharField(max_length=100, blank=True)

    # ── Estado ───────────────────────────────────────────────────────────────
    estado         = models.CharField(
        max_length=20,
        choices=ESTADO_INSCRIPCION_CHOICES,
        default='sin_evaluar',
        db_index=True,
    )

    # ── Resultado de evaluación ───────────────────────────────────────────────
    porcentaje_icr     = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0'))
    valor_icr          = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    motivo_no_elegible = models.TextField(blank=True)

    # ── Formalización ─────────────────────────────────────────────────────────
    consecutivo    = models.CharField(
        max_length=20, blank=True, null=True, unique=True,
        help_text='Formato AA-NNNNNN, asignado al inscribir.',
    )
    formalizado_por = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='inscripciones_icr_formalizadas',
    )
    formalizado_en  = models.DateTimeField(null=True, blank=True)

    # ── Anulación ─────────────────────────────────────────────────────────────
    anulado_en       = models.DateTimeField(null=True, blank=True)
    motivo_anulacion = models.TextField(blank=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    importado_en   = models.DateTimeField(auto_now_add=True)
    preinscrito_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-importado_en']
        verbose_name = 'Inscripción ICR'
        verbose_name_plural = 'Inscripciones ICR'
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['tipo_productor']),
            models.Index(fields=['bolsa', 'estado']),
        ]

    def __str__(self):
        label = self.consecutivo or self.id_agros
        return f'{label} — {self.get_estado_display()}'

    @property
    def es_elegible(self):
        return self.estado in ('preinscrita', 'inscrita')


# ── EvaluacionRegla ───────────────────────────────────────────────────────────

class EvaluacionRegla(models.Model):
    """
    Registro de auditoría inmutable: resultado de cada regla evaluada
    contra una InscripcionICR. Almacena snapshot del estado de la regla
    en el momento de evaluación para garantizar trazabilidad permanente.
    """
    inscripcion    = models.ForeignKey(
        InscripcionICR, on_delete=models.CASCADE, related_name='evaluaciones',
        null=True, blank=True,
    )
    regla          = models.ForeignKey(
        ReglaICR, on_delete=models.SET_NULL, null=True, blank=True,
        help_text='FK a ReglaICR (null si la regla fue eliminada posterior a la evaluación).',
    )
    # Snapshot para audit trail estable
    codigo_regla   = models.CharField(max_length=100, default='')
    descripcion    = models.TextField(default='')
    valor_evaluado = models.CharField(max_length=500, default='')
    resultado      = models.BooleanField()
    evaluado_en    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['evaluado_en']
        verbose_name = 'Evaluación de Regla'
        verbose_name_plural = 'Evaluaciones de Reglas'

    def __str__(self):
        estado = 'PASS' if self.resultado else 'FAIL'
        return f'{self.inscripcion.id_agros} | {self.codigo_regla} → {estado}'
