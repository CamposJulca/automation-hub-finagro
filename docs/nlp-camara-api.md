# Cambios requeridos en nlp-camara

Para que funcione como servicio independiente consumido por el Automation Hub,
se deben agregar los siguientes archivos al repositorio nlp-camara.

## 1. requirements.txt — agregar djangorestframework y requests

```
pdfplumber
spacy
djangorestframework
django-cors-headers
```

## 2. Archivo nuevo: camara_app/api_views.py

```python
import tempfile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework import status

from pdf_reader import leer_pdf
from extractor import extraer_datos


class ExtraerCertificadoView(APIView):
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]

    def post(self, request):
        archivos = request.FILES.getlist('archivos')

        if not archivos:
            return Response(
                {'error': 'No se enviaron archivos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        resultados = []
        errores = []

        for archivo in archivos:
            tmp = None
            try:
                suffix = '.pdf' if archivo.name.endswith('.pdf') else ''
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    for chunk in archivo.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name

                texto = leer_pdf(tmp_path)
                datos = extraer_datos(texto)
                datos['archivo'] = archivo.name
                resultados.append(datos)
            except Exception as e:
                errores.append({'archivo': archivo.name, 'error': str(e)})
            finally:
                import os
                if tmp and os.path.exists(tmp.name):
                    os.unlink(tmp.name)

        return Response({'resultados': resultados, 'errores': errores})
```

## 3. camara_web/urls.py — agregar ruta /api/

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('camara_app.urls')),
    path('api/', include('camara_app.api_urls')),
]
```

## 4. Archivo nuevo: camara_app/api_urls.py

```python
from django.urls import path
from .api_views import ExtraerCertificadoView

urlpatterns = [
    path('extraer/', ExtraerCertificadoView.as_view(), name='extraer-certificado'),
]
```

## 5. camara_web/settings.py — agregar apps y CORS

En INSTALLED_APPS agregar:
```python
'rest_framework',
'corsheaders',
```

En MIDDLEWARE agregar (antes de CommonMiddleware):
```python
'corsheaders.middleware.CorsMiddleware',
```

Agregar al final:
```python
CORS_ALLOW_ALL_ORIGINS = True  # solo para desarrollo interno
```

## Endpoint resultante

POST http://localhost:8001/api/extraer/
Content-Type: multipart/form-data
Body: archivos[] = <pdf1>, <pdf2>, ...

Respuesta:
```json
{
  "resultados": [
    {
      "archivo": "certificado1.pdf",
      "razon_social": "EMPRESA XYZ S.A.S.",
      "nit": "900123456-7",
      "representante": "Juan Pérez García",
      "tipo_doc": "C.C.",
      "cedula": "12345678"
    }
  ],
  "errores": []
}
```
