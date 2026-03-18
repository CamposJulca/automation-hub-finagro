"""
Motor de Reglas ICR — Basado en Base de Datos

Reemplaza el motor con reglas hardcodeadas por un motor dinámico que lee
las ReglaICR y PorcentajeICR configuradas por bolsa desde la base de datos.
"""
from decimal import Decimal
from datetime import date


class BolsaRuleEngine:
    """
    Motor de evaluación de reglas para una BolsaICR específica.

    Uso:
        engine = BolsaRuleEngine(bolsa)
        resultados = engine.evaluar(inscripcion)
        porcentaje, valor_icr = engine.calcular_icr(inscripcion, todas_ok)
    """

    def __init__(self, bolsa):
        # Importación tardía para evitar circular imports al nivel de módulo
        from modules.icr.models import ReglaICR, PorcentajeICR

        self.bolsa = bolsa
        self.reglas = list(ReglaICR.objects.filter(bolsa=bolsa, activa=True).order_by('orden', 'tipo'))
        self.porcentajes = {
            p.tipo_productor: p
            for p in PorcentajeICR.objects.filter(bolsa=bolsa)
        }

    # ── Evaluación de reglas ──────────────────────────────────────────────────

    def evaluar(self, inscripcion):
        """
        Evalúa todas las reglas activas de la bolsa contra una InscripcionICR.
        Retorna lista de dicts con el resultado de cada regla.
        """
        resultados = []
        for regla in self.reglas:
            resultado, valor_evaluado = self._evaluar_regla(regla, inscripcion)
            resultados.append({
                'regla_id':      regla.id,
                'regla_obj':     regla,
                'codigo_regla':  f'{regla.get_tipo_display().upper().replace(" ", "_")}_{regla.id}',
                'descripcion':   regla.descripcion or self._descripcion_default(regla),
                'valor_evaluado': valor_evaluado,
                'resultado':     resultado,
            })
        return resultados

    def _evaluar_regla(self, regla, ins):
        """
        Despacha la evaluación según el tipo de regla.
        Retorna (resultado: bool, valor_evaluado: str).
        """
        param = regla.parametro.strip()
        valores = [v.strip() for v in param.split(',') if v.strip()]

        if regla.tipo == 'tipo_productor':
            ok = ins.tipo_productor in valores
            return ok, ins.tipo_productor

        elif regla.tipo == 'valor_minimo':
            try:
                minimo = Decimal(param.replace(',', '.'))
            except Exception:
                return False, f'parametro inválido: {param!r}'
            ok = ins.valor_credito >= minimo
            return ok, f'${ins.valor_credito:,.2f}'

        elif regla.tipo == 'valor_maximo':
            try:
                maximo = Decimal(param.replace(',', '.'))
            except Exception:
                return False, f'parametro inválido: {param!r}'
            ok = ins.valor_credito <= maximo
            return ok, f'${ins.valor_credito:,.2f} / máx ${maximo:,.0f}'

        elif regla.tipo == 'fecha_vigencia':
            if len(valores) < 2:
                return False, f'parametro inválido: {param!r}'
            try:
                desde = date.fromisoformat(valores[0])
                hasta = date.fromisoformat(valores[1])
            except ValueError:
                return False, f'fechas inválidas: {param!r}'
            ok = desde <= ins.fecha_credito <= hasta
            return ok, str(ins.fecha_credito)

        elif regla.tipo == 'actividad':
            actividad_norm = ins.actividad.strip().lower()
            ok = any(v.lower() in actividad_norm for v in valores)
            return ok, ins.actividad

        elif regla.tipo == 'municipio':
            mun_norm = ins.municipio.strip().lower()
            dep_norm = ins.departamento.strip().lower()
            ok = any(v.lower() in (mun_norm, dep_norm) for v in valores)
            return ok, f'{ins.departamento}/{ins.municipio}'

        # Tipo desconocido: pasa (no bloquea)
        return True, f'tipo desconocido: {regla.tipo}'

    def _descripcion_default(self, regla):
        """Genera descripción legible si el campo está vacío."""
        labels = {
            'tipo_productor': f'Tipo de productor debe ser: {regla.parametro}',
            'valor_minimo':   f'Valor del crédito ≥ ${regla.parametro} COP',
            'valor_maximo':   f'Valor del crédito ≤ ${regla.parametro} COP',
            'fecha_vigencia': f'Fecha del crédito en rango: {regla.parametro}',
            'actividad':      f'Actividad debe incluir: {regla.parametro}',
            'municipio':      f'Municipio/Departamento debe ser: {regla.parametro}',
        }
        return labels.get(regla.tipo, regla.tipo)

    # ── Cálculo de incentivo ──────────────────────────────────────────────────

    def calcular_icr(self, inscripcion, elegible):
        """
        Calcula el porcentaje e incentivo ICR para una inscripción elegible.
        Aplica el tope en UVB configurado en PorcentajeICR.

        Retorna (porcentaje: Decimal, valor_icr: Decimal).
        """
        if not elegible:
            return Decimal('0'), Decimal('0')

        pct = self.porcentajes.get(inscripcion.tipo_productor)
        if pct is None:
            return Decimal('0'), Decimal('0')

        # Aplicar tope de crédito elegible según UVB
        valor_base = min(inscripcion.valor_credito, pct.tope_valor_credito)

        # Calcular incentivo
        valor_icr = (pct.porcentaje * valor_base).quantize(Decimal('0.01'))
        return pct.porcentaje, valor_icr

    # ── Búsqueda automática de bolsa ──────────────────────────────────────────

    @classmethod
    def encontrar_bolsa(cls, inscripcion, bolsas):
        """
        Encuentra la primera bolsa activa con presupuesto disponible
        cuyos reglas pasan para la inscripción.

        bolsas: queryset o lista de BolsaICR activas
        Retorna (bolsa, engine, resultados) o (None, None, []) si ninguna aplica.
        """
        for bolsa in bolsas:
            if bolsa.valor_disponible <= 0:
                continue
            engine = cls(bolsa)
            resultados = engine.evaluar(inscripcion)
            if all(r['resultado'] for r in resultados):
                return bolsa, engine, resultados
        return None, None, []
