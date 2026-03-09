from django.db import models
from execution.models import Execution


class ExecutionLog(models.Model):
    LEVEL_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]

    execution = models.ForeignKey(Execution, on_delete=models.CASCADE, related_name='logs')
    message = models.TextField()
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='info')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f'[{self.level.upper()}] {self.timestamp:%Y-%m-%d %H:%M:%S} — {self.message[:80]}'
