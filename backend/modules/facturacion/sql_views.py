"""
Endpoints de consulta SQL acotada para el módulo Facturación.

- SqlSchemaView: introspecta los modelos Django de las tablas relevantes y
  devuelve columnas + foreign keys, para que el frontend dibuje un ER.
- SqlRunView:    ejecuta SELECTs con whitelist de tablas, conexión READ ONLY
  y statement_timeout. Auto-aplica LIMIT 500 si la query no lo trae.
"""
import re
import time
from datetime import date, datetime
from decimal import Decimal

from django.apps import apps
from django.db import connection, transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


# ── Tablas autorizadas ────────────────────────────────────────────────────
ALLOWED_PREFIXES = ('facturacion_', 'execution_', 'automation_', 'logs_')
ALLOWED_EXTRA    = set()  # añadir tablas por nombre exacto si se necesita
DENIED_TABLES    = {
    'auth_user', 'auth_user_groups', 'auth_user_user_permissions',
    'auth_group', 'auth_group_permissions', 'auth_permission',
    'django_admin_log', 'django_session', 'django_migrations',
    'django_content_type',
}

WRITE_RX = re.compile(
    r'\b(insert|update|delete|drop|truncate|alter|grant|revoke|create|comment|copy|'
    r'vacuum|analyze|reindex|cluster|do|notify|listen|prepare|execute|deallocate|'
    r'lock|set\s+role|reset)\b',
    re.IGNORECASE,
)
SELECT_RX = re.compile(r'^\s*(with\b.*?\bselect\b|select\b)', re.IGNORECASE | re.DOTALL)
LIMIT_TAIL_RX = re.compile(r'\blimit\s+\d+(\s+offset\s+\d+)?\s*$', re.IGNORECASE)
TABLE_RX = re.compile(r'\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)', re.IGNORECASE)


def _validar_query(query):
    q = query.strip().rstrip(';').strip()
    if not q:
        return None, 'La consulta está vacía.'
    if not SELECT_RX.match(q):
        return None, 'Solo se permiten consultas SELECT (o WITH ... SELECT).'
    if WRITE_RX.search(q):
        return None, 'La consulta contiene operaciones no permitidas (INSERT, UPDATE, DELETE, DROP, etc.).'

    tablas = TABLE_RX.findall(q)
    for t in tablas:
        tl = t.lower()
        if tl in DENIED_TABLES:
            return None, f'La tabla "{t}" está bloqueada por seguridad.'
        if not (any(tl.startswith(p) for p in ALLOWED_PREFIXES) or tl in ALLOWED_EXTRA):
            return None, (
                f'La tabla "{t}" no está permitida. '
                f'Solo se admiten tablas con prefijo: {", ".join(ALLOWED_PREFIXES)}'
            )

    if not LIMIT_TAIL_RX.search(q):
        q = f'{q} LIMIT 500'

    return q, None


def _serializar(v):
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return f'<{len(bytes(v))} bytes>'
    return v


class SqlRunView(APIView):
    """
    POST /api/facturacion/sql/run/
    Body: { "query": "SELECT ..." }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = (request.data.get('query') or '').strip()
        q_safe, err = _validar_query(query)
        if err:
            return Response({'error': err}, status=400)

        t0 = time.monotonic()
        try:
            with transaction.atomic(), connection.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '10s'")
                cursor.execute('SET TRANSACTION READ ONLY')
                cursor.execute(q_safe)
                cols = [c[0] for c in cursor.description] if cursor.description else []
                rows = cursor.fetchall() if cursor.description else []
        except Exception as exc:
            return Response({'error': f'Error en la consulta: {exc}'}, status=400)

        took_ms = round((time.monotonic() - t0) * 1000)
        json_rows = [[_serializar(v) for v in r] for r in rows]
        return Response({
            'columns':  cols,
            'rows':     json_rows,
            'took_ms':  took_ms,
            'count':    len(rows),
            'limited':  len(rows) >= 500,
            'query':    q_safe,
        })


class SqlSchemaView(APIView):
    """
    GET /api/facturacion/sql/schema/
    Devuelve las tablas relevantes y sus relaciones para dibujar un ER.
    """
    permission_classes = [IsAuthenticated]

    MODELOS = [
        ('facturacion', 'FacturaElectronica'),
        ('execution',   'Execution'),
        ('automation',  'Automation'),
        ('logs',        'ExecutionLog'),
    ]

    def get(self, request):
        tables = []
        for app_label, model_name in self.MODELOS:
            try:
                M = apps.get_model(app_label, model_name)
            except LookupError:
                continue

            cols, fks = [], []
            for f in M._meta.get_fields():
                if not getattr(f, 'concrete', False):
                    continue
                col = {
                    'name': getattr(f, 'column', f.name),
                    'type': f.get_internal_type(),
                    'null': bool(getattr(f, 'null', False)),
                    'pk':   bool(getattr(f, 'primary_key', False)),
                }
                cols.append(col)
                if f.is_relation and f.many_to_one and f.related_model:
                    fks.append({
                        'column':     f.column,
                        'ref_table':  f.related_model._meta.db_table,
                        'ref_column': f.related_model._meta.pk.column,
                    })

            tables.append({
                'name':         M._meta.db_table,
                'verbose_name': str(M._meta.verbose_name),
                'columns':      cols,
                'fks':          fks,
                'protected':    False,
            })

        # auth_user expuesto solo como nodo del ER (no permitido en queries libres)
        tables.append({
            'name':         'auth_user',
            'verbose_name': 'Usuario',
            'protected':    True,
            'columns': [
                {'name': 'id',       'type': 'AutoField',  'pk': True,  'null': False},
                {'name': 'username', 'type': 'CharField',  'pk': False, 'null': False},
            ],
            'fks': [],
        })

        return Response({
            'tables':       tables,
            'allowed_prefixes': list(ALLOWED_PREFIXES),
            'denied_tables':    sorted(DENIED_TABLES),
        })
