"""
Calculadora ICR

Aplica el porcentaje de incentivo sobre el valor del crédito elegible.
"""
from decimal import Decimal
from .rule_engine import PORCENTAJES_ICR


def calcular_icr(operacion, todas_reglas_ok: bool):
    """
    Calcula el Incentivo a la Capitalización Rural para una operación.

    Args:
        operacion: instancia de OperacionICR
        todas_reglas_ok: True si todas las reglas de elegibilidad pasaron

    Returns:
        (porcentaje, valor_icr) — Decimal × Decimal
    """
    if not todas_reglas_ok:
        return Decimal('0'), Decimal('0')

    porcentaje = PORCENTAJES_ICR.get(operacion.tipo_productor, Decimal('0'))
    valor_icr = (porcentaje * operacion.valor_credito).quantize(Decimal('0.01'))
    return porcentaje, valor_icr
