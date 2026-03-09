from django.db import models


class NecesidadInnovacion(models.Model):
    TIPO_CHOICES = [
        ('Operativo', 'Operativo'),
        ('Normativo', 'Normativo'),
        ('Estrategico', 'Estratégico'),
    ]
    RIESGO_CHOICES = [(1, 'Bajo'), (2, 'Medio'), (3, 'Alto')]

    area = models.CharField(max_length=255)
    proceso_asociado = models.CharField(max_length=255)
    responsable = models.CharField(max_length=255)
    situacion_actual = models.TextField(blank=True)
    preocupaciones = models.TextField(blank=True)
    necesidad = models.TextField()
    tipo_objetivo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    recurrencia_mensual = models.PositiveIntegerField()
    duracion_horas = models.DecimalField(max_digits=6, decimal_places=1)
    riesgo = models.IntegerField(choices=RIESGO_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.area}] {self.necesidad[:60]}'


class Automation(models.Model):
    MODULE_CHOICES = [
        ('facturacion', 'Facturación Electrónica'),
        ('mesa_ayuda', 'Optimización Mesa de Ayuda'),
        ('gestion_administrativa', 'Gestión Administrativa'),
        ('sarlaft', 'SARLAFT'),
    ]

    name = models.CharField(max_length=255)
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['module', 'name']

    def __str__(self):
        return f'[{self.module}] {self.name}'
