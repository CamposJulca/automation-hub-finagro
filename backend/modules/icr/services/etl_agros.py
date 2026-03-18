"""
ETL AGROS — Importación de operaciones ICR

Soporta archivos Excel (.xlsx) y CSV.
Columnas esperadas (no sensibles a mayúsculas ni espacios):

    ID AGROS | PRODUCTOR ID | TIPO PRODUCTOR | VALOR CREDITO |
    FECHA CREDITO | ACTIVIDAD | DEPARTAMENTO | MUNICIPIO
"""
import csv
import io
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

import openpyxl


# ── Mapeo de nombres de columna → clave canónica ──────────────────────────────

COLUMN_MAP = {
    'id agros':       'id_agros',
    'id_agros':       'id_agros',
    'idagros':        'id_agros',
    'id operacion':   'id_agros',
    'id_operacion':   'id_agros',
    'productor id':   'productor_id',
    'productor_id':   'productor_id',
    'id productor':   'productor_id',
    'tipo productor': 'tipo_productor',
    'tipo_productor': 'tipo_productor',
    'tipo':           'tipo_productor',
    'valor credito':  'valor_credito',
    'valor_credito':  'valor_credito',
    'valor':          'valor_credito',
    'monto':          'valor_credito',
    'fecha credito':  'fecha_credito',
    'fecha_credito':  'fecha_credito',
    'fecha':          'fecha_credito',
    'actividad':      'actividad',
    'actividad productiva': 'actividad',
    'departamento':   'departamento',
    'municipio':      'municipio',
}

DATE_FORMATS = ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d', '%m/%d/%Y']

TIPO_NORMALIZADO = {
    'pequeño':  'pequeño',
    'pequeno':  'pequeño',
    'pequeno':  'pequeño',
    'mediano':  'mediano',
    'grande':   'grande',
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _norm_header(h):
    return str(h).strip().lower()


def _parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f'Fecha inválida: {value!r}. Use YYYY-MM-DD o DD/MM/YYYY.')


def _parse_decimal(value):
    s = str(value).replace(',', '.').replace(' ', '').replace('$', '').replace('\xa0', '').strip()
    try:
        return Decimal(s)
    except InvalidOperation:
        raise ValueError(f'Valor numérico inválido: {value!r}')


def _map_row(headers, row):
    """Mapea cabecera + fila a dict con keys canónicas."""
    mapped = {}
    for i, h in enumerate(headers):
        canon = COLUMN_MAP.get(_norm_header(h))
        if canon and i < len(row):
            mapped[canon] = row[i]
    return mapped


def _validate_row(row_dict, linea):
    """Valida y normaliza un dict de fila. Retorna (datos_dict, error_str|None)."""
    errors = []

    id_agros = str(row_dict.get('id_agros', '')).strip()
    if not id_agros:
        errors.append('ID AGROS vacío')

    productor_id = str(row_dict.get('productor_id', '')).strip()

    tipo_raw = str(row_dict.get('tipo_productor', '')).strip().lower()
    tipo = TIPO_NORMALIZADO.get(tipo_raw)
    if not tipo:
        errors.append(f'Tipo productor inválido: "{tipo_raw}". Use: pequeño / mediano / grande')

    try:
        valor_credito = _parse_decimal(row_dict.get('valor_credito', 0))
    except ValueError as e:
        valor_credito = None
        errors.append(str(e))

    try:
        fecha_credito = _parse_date(row_dict.get('fecha_credito', ''))
    except ValueError as e:
        fecha_credito = None
        errors.append(str(e))

    actividad = str(row_dict.get('actividad', '')).strip()
    if not actividad:
        errors.append('Actividad vacía')

    if errors:
        return None, f'Fila {linea}: {"; ".join(errors)}'

    return {
        'id_agros':       id_agros,
        'productor_id':   productor_id,
        'tipo_productor': tipo,
        'valor_credito':  valor_credito,
        'fecha_credito':  fecha_credito,
        'actividad':      actividad,
        'departamento':   str(row_dict.get('departamento', '')).strip(),
        'municipio':      str(row_dict.get('municipio', '')).strip(),
    }, None


# ── Importadores ──────────────────────────────────────────────────────────────

def importar_desde_excel(archivo_django):
    """
    Importa operaciones desde un archivo Excel (.xlsx).
    Retorna (lista_datos_validos, lista_errores).
    """
    wb = openpyxl.load_workbook(archivo_django, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    if not rows:
        return [], ['El archivo Excel está vacío.']

    headers = rows[0]
    validos, errores = [], []

    for i, row in enumerate(rows[1:], start=2):
        # Ignorar filas completamente vacías
        if all(v is None or str(v).strip() == '' for v in row):
            continue
        row_dict = _map_row(headers, row)
        datos, error = _validate_row(row_dict, i)
        if error:
            errores.append(error)
        else:
            validos.append(datos)

    return validos, errores


def importar_desde_csv(archivo_django):
    """
    Importa operaciones desde un archivo CSV.
    Retorna (lista_datos_validos, lista_errores).
    """
    contenido = archivo_django.read().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(contenido))
    validos, errores = [], []

    for i, row in enumerate(reader, start=2):
        row_norm = {COLUMN_MAP.get(_norm_header(k), _norm_header(k)): v for k, v in row.items()}
        datos, error = _validate_row(row_norm, i)
        if error:
            errores.append(error)
        else:
            validos.append(datos)

    return validos, errores
