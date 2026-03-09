"""
Cliente HTTP para el servicio nlp-camara.
Encapsula toda comunicacion con el servicio externo.
"""
import requests
from django.conf import settings


NLP_CAMARA_URL = getattr(settings, 'NLP_CAMARA_URL', 'http://localhost:8001')


class NlpCamaraClient:
    def extraer_certificados(self, archivos):
        """
        archivos: lista de objetos InMemoryUploadedFile de Django.
        Retorna dict con 'resultados' y 'errores'.
        """
        files = [
            ('archivos', (f.name, f.read(), f.content_type or 'application/pdf'))
            for f in archivos
        ]
        response = requests.post(
            f'{NLP_CAMARA_URL}/api/extraer/',
            files=files,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()
