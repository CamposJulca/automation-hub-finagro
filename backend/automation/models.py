from django.db import models


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
