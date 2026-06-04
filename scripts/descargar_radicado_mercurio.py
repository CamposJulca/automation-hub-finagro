#!/usr/bin/env python3
"""Descarga el documento de un radicado específico desde Mercurio.

Recorre la bandeja WorkFlow paso por paso buscando un id de documento puntual
y descarga su contenido (PDF, EML o MSG) al directorio indicado.

Diseñado para ejecutarse DENTRO del contenedor backend (donde están
Playwright + el paquete modules.facturacion). Lee el password por stdin
para evitar exponerlo en argv.

Uso típico:
  docker exec -i automation-hub-finagro-backend-1 \\
    python /app/scripts/descargar_radicado_mercurio.py \\
      --radicado 2026006613 --user <USER> \\
      --output-dir /tmp/r6613 <<< '<PASSWORD>'

Exit codes:
  0 — éxito (radicado descargado, o paso vacío / no encontrado sin error)
  1 — error genérico
  2 — error de login en Mercurio
  3 — error de navegación / paginación / paso
  4 — radicado no encontrado en la bandeja del paso pedido
  5 — error al descargar el documento ya localizado
"""
import argparse
import logging
import os
import sys

BACKEND_DIR = os.environ.get('BACKEND_DIR', '/app')
sys.path.insert(0, BACKEND_DIR)

from playwright.sync_api import sync_playwright

from modules.facturacion.mercurio_session import (
    MERCURIO_URL,
    MercurioLoginError, MercurioNavigationError, MercurioPasoError,
    extraer_docs_de_html, descargar_imagen,
    login, abrir_workflow, filtrar_paso, detectar_paginacion, navegar_a_pagina,
)


EXIT_OK         = 0
EXIT_GENERIC    = 1
EXIT_LOGIN      = 2
EXIT_NAV        = 3
EXIT_NOT_FOUND  = 4
EXIT_DOWNLOAD   = 5


def main():
    ap = argparse.ArgumentParser(
        description='Descarga el documento de un radicado específico desde Mercurio.',
    )
    ap.add_argument('--radicado',   required=True, help='Número de radicado a buscar (ej. 2026006613).')
    ap.add_argument('--user',       required=True, help='Usuario Mercurio.')
    ap.add_argument('--paso',       default='1',   help='Paso de la bandeja (default: 1).')
    ap.add_argument('--output-dir', default='/tmp/mercurio_radicado', help='Directorio donde guardar el documento.')
    args = ap.parse_args()

    # Password por stdin (una línea, sin echo si stdin es pipe)
    password = sys.stdin.readline().rstrip('\n')
    if not password:
        print('ERROR: password no recibido por stdin', file=sys.stderr)
        sys.exit(EXIT_GENERIC)

    logging.basicConfig(level=logging.INFO, format='%(message)s')
    log = logging.info

    os.makedirs(args.output_dir, exist_ok=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(accept_downloads=True)
                page    = context.new_page()
                page.on('dialog', lambda d: d.accept())

                login(page, MERCURIO_URL, args.user, password, log_fn=log)
                wf_frame = abrir_workflow(page, log_fn=log)
                wf_frame = filtrar_paso(page, wf_frame, args.paso, log_fn=log)
                if wf_frame is None:
                    log(f'Paso={args.paso} vacío. Radicado {args.radicado} no está aquí.')
                    sys.exit(EXIT_NOT_FOUND)

                paginas_opts, pag_base_path = detectar_paginacion(wf_frame)
                total_paginas = len(paginas_opts) if paginas_opts else 1
                log(f'Páginas detectadas: {total_paginas}')

                pagina_actual = 0
                while True:
                    docs_pag = extraer_docs_de_html(wf_frame.content())
                    log(f'-- Página {pagina_actual + 1}: {len(docs_pag)} documentos')
                    target = next((d for d in docs_pag if d['id'] == args.radicado), None)

                    if target:
                        dest = os.path.join(args.output_dir, f'{args.radicado}.bin')
                        try:
                            resultado = descargar_imagen(context, page, wf_frame, target, dest, log_fn=log)
                        except Exception as e:
                            log(f'Descarga falló: {e}')
                            sys.exit(EXIT_DOWNLOAD)

                        if resultado in ('eml', 'eml_link'):
                            final = os.path.join(args.output_dir, f'{args.radicado}.eml')
                        elif resultado == 'msg_link':
                            final = os.path.join(args.output_dir, f'{args.radicado}.msg')
                        else:
                            final = os.path.join(args.output_dir, f'{args.radicado}.pdf')
                        os.rename(dest, final)
                        size = os.path.getsize(final)
                        log(f'OK: {final} ({size:,} bytes, resultado={resultado})')
                        sys.exit(EXIT_OK)

                    if not paginas_opts or pagina_actual + 1 >= len(paginas_opts):
                        log(f'Radicado {args.radicado} no encontrado en {pagina_actual + 1} página(s).')
                        sys.exit(EXIT_NOT_FOUND)

                    pagina_actual += 1
                    pag_value = paginas_opts[pagina_actual]
                    log(f'Navegando a página {pagina_actual + 1} (valor={pag_value})...')
                    wf_frame = navegar_a_pagina(page, pag_value, pag_base_path, log_fn=log)
                    if wf_frame is None:
                        log('Frame perdido tras paginar. Abortando.')
                        sys.exit(EXIT_NAV)
            finally:
                try:
                    browser.close()
                except Exception:
                    pass

    except MercurioLoginError as e:
        log(f'LOGIN_ERROR: {e}')
        sys.exit(EXIT_LOGIN)
    except MercurioNavigationError as e:
        log(f'NAV_ERROR: {e}')
        sys.exit(EXIT_NAV)
    except MercurioPasoError as e:
        log(f'PASO_ERROR: {e}')
        sys.exit(EXIT_NAV)
    except SystemExit:
        raise
    except Exception as e:
        log(f'ERROR: {e}')
        sys.exit(EXIT_GENERIC)


if __name__ == '__main__':
    main()
