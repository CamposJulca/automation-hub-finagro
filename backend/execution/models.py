from django.db import models
from automation.models import Automation


class Execution(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('running', 'En ejecución'),
        ('success', 'Exitoso'),
        ('failed', 'Fallido'),
    ]

    automation = models.ForeignKey(Automation, on_delete=models.CASCADE, related_name='executions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    triggered_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='executions'
    )

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f'{self.automation.name} — {self.status}'
