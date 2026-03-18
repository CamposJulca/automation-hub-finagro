"""
Generador de consecutivos ICR — Formato AA-NNNNNN

El consecutivo se genera bajo select_for_update() para evitar duplicados
en accesos concurrentes. Debe ser llamado dentro de transaction.atomic().
"""
from django.utils import timezone


def generar_consecutivo(bolsa):
    """
    Genera el siguiente consecutivo para una BolsaICR en el año en curso.

    Formato: AA-NNNNNN  (ej. 26-000001, 26-000002 …)
    El contador reinicia con cada año calendario.

    Requiere llamarse dentro de transaction.atomic() + select_for_update().
    """
    from modules.icr.models import InscripcionICR

    aa = str(timezone.now().year)[2:]   # '26'
    prefix = f'{aa}-'

    ultimo = (
        InscripcionICR.objects
        .select_for_update()
        .filter(consecutivo__startswith=prefix)
        .order_by('-consecutivo')
        .first()
    )

    if ultimo and ultimo.consecutivo:
        try:
            ultimo_num = int(ultimo.consecutivo.split('-')[1])
        except (IndexError, ValueError):
            ultimo_num = 0
    else:
        ultimo_num = 0

    nuevo_num = ultimo_num + 1
    return f'{aa}-{nuevo_num:06d}'
