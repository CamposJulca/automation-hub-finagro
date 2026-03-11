"""
Cliente HTTP para el servicio FactIA.
Encapsula toda comunicacion con el servicio externo.
"""
import requests
from django.conf import settings

FACTIA_URL = getattr(settings, 'FACTIA_URL', 'http://localhost:8002')


class FactIAClient:
    def descargar(self, fecha_desde=None, fecha_hasta=None):
        """Descarga ZIPs de facturas desde el buzón de correo. Puede ser lento."""
        body = {}
        if fecha_desde:
            body['fecha_desde'] = fecha_desde
        if fecha_hasta:
            body['fecha_hasta'] = fecha_hasta
        response = requests.post(f'{FACTIA_URL}/api/descargar/', json=body or None, timeout=600)
        response.raise_for_status()
        return response.json()

    def procesar(self):
        """Clasifica ZIPs y extrae metadata de facturas XML."""
        response = requests.post(f'{FACTIA_URL}/api/procesar/', timeout=300)
        response.raise_for_status()
        return response.json()

    def listar_facturas(self):
        """Retorna facturas ya procesadas."""
        response = requests.get(f'{FACTIA_URL}/api/facturas/', timeout=30)
        response.raise_for_status()
        return response.json()
