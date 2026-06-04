"""Primitivas reusables para automatizar Mercurio (Playwright).

Extraído de SincronizarMercurioView para permitir reuso desde scripts
de diagnóstico/herramientas sin depender del flujo SSE de Django.
"""
import re
from typing import Callable, Optional


MERCURIO_URL = 'https://mercurio.finagro.com.co/mercurio/index.jsp'


# ── Excepciones tipadas ───────────────────────────────────────────────────────
class MercurioError(Exception):
    """Base para todos los errores específicos de Mercurio."""


class MercurioLoginError(MercurioError):
    """Login rechazado por Mercurio (credenciales, sesión activa, bloqueo, etc.)."""


class MercurioNavigationError(MercurioError):
    """No se pudo navegar a BANDEJAS → WorkFlow."""


class MercurioPasoError(MercurioError):
    """Falló la aplicación del filtro Paso=N."""


class MercurioDownloadError(MercurioError):
    """Falló la descarga vía TraerImagen."""


# ── Helpers puros ─────────────────────────────────────────────────────────────
def extraer_docs_de_html(html):
    doc_blocks = re.findall(r'function selectDoc(\d+)\(\)\s*\{(.*?)\}', html, re.DOTALL)
    docs = []
    for idx, block in doc_blocks:
        id_doc = re.search(r"idDocumento\s*=\s*'([^']+)'", block)
        if id_doc:
            docs.append({'idx': idx, 'id': id_doc.group(1)})
    return docs


def cerrar_popups_huerfanos(context, page):
    """Cierra cualquier página extra (popups) que no sea la principal."""
    for p in context.pages:
        if p != page:
            try:
                p.close()
            except Exception:
                pass


def get_wf_frame(page):
    return next((f for f in page.frames if 'BandejaRutas' in f.url), None)


def descargar_imagen(context, page, wf_frame, doc, dest, log_fn=None):
    """
    Descarga el documento (imagen/PDF) directamente via TraerImagen servlet,
    usando el API de Playwright (context.request) para preservar cookies y
    sesión completa del navegador.
    Si TraerImagen devuelve directamente un PDF, lo guarda.
    Si devuelve HTML, busca links a EML/PDF dentro del HTML.
    """
    n      = doc['idx']
    id_doc = doc['id']

    # Seleccionar el documento en el frame
    cerrar_popups_huerfanos(context, page)
    wf_frame.evaluate(f'selectDoc{n}();')
    page.wait_for_timeout(500)

    # Leer variables JS del documento seleccionado
    try:
        id_documento = wf_frame.evaluate('idDocumento')
        tip_documento = wf_frame.evaluate('tipDocumento')
    except Exception:
        id_documento = id_doc
        tip_documento = ''

    base_url = 'https://mercurio.finagro.com.co'
    traer_url = f'{base_url}/mercurio/servlet/TraerImagen?documento={id_documento}&tipoDocumento={tip_documento}&imagenConsulta=S'

    # Usar Playwright API request (comparte cookies/sesión con el navegador)
    api_resp = context.request.get(traer_url, timeout=30000)

    if api_resp.status != 200:
        raise Exception(f'TraerImagen HTTP {api_resp.status}')

    ct = api_resp.headers.get('content-type', '')
    body = api_resp.body()

    # Si devuelve PDF directo, guardarlo
    if 'application/pdf' in ct:
        with open(dest, 'wb') as f:
            f.write(body)
        return 'pdf_directo'

    # Si devuelve HTML, buscar links a EML o PDF
    encoding = 'latin-1' if 'ISO-8859-1' in ct else 'utf-8'
    html_content = body.decode(encoding, errors='replace')

    # Buscar link a PDF, EML o MSG en href= o src= (con o sin comillas)
    url_match = re.search(r'(?:href|src)=["\']?([^\s"\'<>]+\.pdf)["\']?', html_content, re.IGNORECASE)
    if not url_match:
        url_match = re.search(r'(?:href|src)=["\']?([^\s"\'<>]+\.eml)["\']?', html_content, re.IGNORECASE)
    if not url_match:
        url_match = re.search(r'(?:href|src)=["\']?([^\s"\'<>]+\.msg)["\']?', html_content, re.IGNORECASE)

    if url_match:
        file_url = url_match.group(1)
        if not file_url.startswith('http'):
            file_url = base_url + ('' if file_url.startswith('/') else '/') + file_url
        resp_file = context.request.get(file_url, timeout=60000)
        if resp_file.status != 200:
            raise Exception(f'Download HTTP {resp_file.status} para {file_url}')
        with open(dest, 'wb') as f:
            f.write(resp_file.body())
        lower_url = file_url.lower()
        if lower_url.endswith('.pdf'):
            ext = 'pdf'
        elif lower_url.endswith('.msg'):
            ext = 'msg'
        else:
            ext = 'eml'
        return f'{ext}_link'

    # Log HTML para diagnóstico (primeros 500 chars)
    snippet = html_content[:500].replace('\n', ' ')
    raise Exception(f'Sin EML/PDF en TraerImagen (Content-Type: {ct}) HTML: {snippet}')


# ── Wrapper privado para paginación ───────────────────────────────────────────
class _PageAsFrame:
    def __init__(self, pg):
        self._pg = pg
    def content(self):
        return self._pg.content()
    def evaluate(self, expr):
        return self._pg.evaluate(expr)
    def locator(self, sel):
        return self._pg.locator(sel)
    def wait_for_load_state(self, *a, **kw):
        return self._pg.wait_for_load_state(*a, **kw)
    @property
    def url(self):
        return self._pg.url


# ── Helpers con progress reporting + excepciones tipadas ──────────────────────
def login(page, mercurio_url, usuario, clave, log_fn=None):
    if log_fn: log_fn('🔐 Iniciando login en Mercurio...')
    page.goto(mercurio_url, timeout=30000, wait_until='domcontentloaded')
    page.wait_for_timeout(2000)
    page.locator("input[name='asri']").click()
    page.locator("input[name='asri']").type(usuario, delay=80)
    page.locator("input[name='ntrsn']").click()
    page.locator("input[name='ntrsn']").type(clave, delay=80)
    page.wait_for_timeout(500)
    with page.expect_response(lambda r: 'ConsultarUsuarioLogueado' in r.url, timeout=15000):
        page.locator("input[name='Submit']").click()

    # Esperar a que la URL cambie (login exitoso) o se quede
    # en index.jsp con código de error (login fallido).
    try:
        page.wait_for_url(lambda url: 'index.jsp' not in url, timeout=15000)
    except Exception:
        current_url = page.url
        if 'err=' in current_url:
            err_match = re.search(r'err=(\d+)', current_url)
            err_code = err_match.group(1) if err_match else 'desconocido'
            err_msgs = {
                '52': 'Credenciales inválidas o sesión ya activa en otro equipo.',
                '51': 'Usuario no encontrado en el sistema.',
                '53': 'Usuario bloqueado por múltiples intentos fallidos.',
                '54': 'Contraseña expirada. Debe renovarla en Mercurio.',
            }
            detalle = err_msgs.get(err_code, f'Error no catalogado (código {err_code}).')
            raise MercurioLoginError(
                f'Login en Mercurio rechazado (err={err_code}): {detalle} '
                f'Verifique las credenciales o contacte al administrador de Mercurio.'
            )
        else:
            html_post = page.content()
            if 'Login incorrecto' in html_post or 'Usuario Inactivo' in html_post:
                raise MercurioLoginError('Login fallido. Verifica credenciales.')
            else:
                raise MercurioLoginError('Login en Mercurio no respondió a tiempo. Intente de nuevo.')

    page.wait_for_load_state('domcontentloaded', timeout=15000)
    page.wait_for_timeout(2000)
    if log_fn: log_fn('✅ Login OK')


def abrir_workflow(page, log_fn=None):
    if log_fn: log_fn('📂 Navegando a BANDEJAS → WorkFlow...')
    main_frame = page.frames[0]
    main_frame.locator('text=BANDEJAS').first.hover()
    page.wait_for_timeout(800)
    main_frame.locator('text=WorkFlow').first.click()
    page.wait_for_timeout(3000)

    wf_frame = get_wf_frame(page)
    if not wf_frame:
        raise MercurioNavigationError('No se encontró el frame BandejaRutas.')
    return wf_frame


def filtrar_paso(page, wf_frame, paso_valor='1', log_fn=None):
    """Aplica el filtro de Paso en la bandeja.

    Retorna el nuevo wf_frame con la bandeja filtrada, o None si Mercurio
    no muestra la opción del paso pedido (típicamente porque la bandeja
    está vacía en ese paso). Lanza MercurioPasoError si la opción existe
    pero el frame se pierde tras la recarga.
    """
    if log_fn: log_fn(f'🔍 Aplicando filtro Paso={paso_valor}...')
    paso_select = wf_frame.locator("select[name='listapaso']")
    opciones_html = paso_select.evaluate('el => el.outerHTML')
    opciones = re.findall(r'<option\s+value="([^"]*)"[^>]*>(.*?)</option>', opciones_html, re.IGNORECASE)
    if log_fn: log_fn(f'   Opciones disponibles: {opciones}')

    # Buscar la opción que corresponda al paso pedido
    valor_final = None
    for val, txt in opciones:
        if val == paso_valor or txt.strip() == paso_valor:
            valor_final = val
            break

    if not valor_final:
        return None

    if log_fn: log_fn(f'   Seleccionando valor: "{valor_final}"')
    try:
        with page.expect_response(lambda r: 'BandejaRutas' in r.url and r.status == 200, timeout=20000):
            paso_select.select_option(valor_final)
    except Exception as e_filtro:
        if log_fn: log_fn(f'⚠️ expect_response falló ({e_filtro}), esperando recarga del frame...')
        page.wait_for_timeout(5000)
    page.wait_for_timeout(2000)
    nuevo_wf = get_wf_frame(page)
    if not nuevo_wf:
        raise MercurioPasoError('Frame BandejaRutas no encontrado después del filtro.')
    nuevo_wf.wait_for_load_state('domcontentloaded')
    page.wait_for_timeout(1000)
    return nuevo_wf


def detectar_paginacion(wf_frame):
    """Devuelve (paginas_opts, pag_base_path).

    paginas_opts es la lista de valores de página (strings); está vacía si
    Mercurio no muestra el selector de páginas (bandeja con una sola página).
    pag_base_path es el path base de paginación extraído del onchange del
    select, o None si no se pudo extraer.
    """
    try:
        pag_select_html = wf_frame.locator("select[name='listapagina']").evaluate(
            'el => el.outerHTML', timeout=3000
        )
        paginas_opts = re.findall(
            r'<option value="(\d+)"', pag_select_html,
        )
        # Extraer URL base de paginación del onchange del select
        pag_base_match = re.search(
            r"top\.location\s*=\s*'([^']*?pagBanRutas=)'",
            pag_select_html,
        )
        pag_base_path = pag_base_match.group(1) if pag_base_match else None
    except Exception:
        paginas_opts = []
        pag_base_path = None
    return paginas_opts, pag_base_path


def navegar_a_pagina(page, pag_value, pag_base_path, log_fn=None):
    """Navega a la página `pag_value` y devuelve el nuevo wf_frame.

    Retorna un Frame de Playwright, o un _PageAsFrame si el contenido
    quedó en la página principal sin frame, o None si el frame se perdió
    y BandejaRutas no está accesible (el caller hace break).
    """
    if pag_base_path:
        nav_url = f'https://mercurio.finagro.com.co{pag_base_path}{pag_value}'
    else:
        nav_url = f'https://mercurio.finagro.com.co/mercurio/ControlDoc/BandejaRutas.jsp?pagBanRutas={pag_value}'

    # Navegar la página principal a la URL de paginación
    # (el select original usa top.location, así que navegamos
    # la página completa y re-buscamos el frame).
    page.goto(nav_url, timeout=30000, wait_until='domcontentloaded')
    page.wait_for_timeout(3000)

    # Después de navegar, el contenido puede quedar en la
    # página principal o dentro de un frame.
    wf_frame = get_wf_frame(page)
    if wf_frame:
        return wf_frame

    # El contenido quedó en la página principal (no hay frame)
    if 'BandejaRutas' in page.url:
        if log_fn: log_fn('   (contenido en página principal, sin frame)')
        return _PageAsFrame(page)

    return None
