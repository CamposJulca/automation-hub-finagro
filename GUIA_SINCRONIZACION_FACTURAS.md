# Guía de sincronización de facturas electrónicas

Descarga los PDFs de facturas electrónicas desde el portal Automation Hub a tu computador Windows, organizados por semana.

---

## Requisitos

- Windows 10 / 11
- PowerShell 5.1 o superior (incluido en Windows por defecto)
- Acceso a internet (para conectarse al portal vía ngrok)
- Credenciales del portal (usuario y contraseña)

---

## Primer uso

### 1. Obtener el script

Descarga el archivo `SincronizarFacturas.ps1` desde el servidor o cópialo a tu máquina.
Ruta sugerida: `C:\Users\cdcampos\Documents\SincronizarFacturas.ps1`

### 2. Habilitar ejecución de scripts (solo la primera vez)

Abre PowerShell y ejecuta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Responde `S` (Sí) cuando te pregunte.

### 3. Verificar la configuración

Abre el script con el Bloc de notas o VS Code y revisa las primeras líneas:

```powershell
$BASE_URL  = "https://facturacion-electronica.ngrok.io"
$USUARIO   = "admin"
$PASSWORD  = "Finagro2026!"
$DESTINO   = "C:\Users\cdcampos\Documents\FacturasElectronicas"
```

Ajusta `$DESTINO` si quieres guardar los archivos en otra carpeta.

---

## Ejecutar manualmente

Abre PowerShell, navega a la carpeta donde está el script y ejecútalo:

```powershell
cd C:\Users\cdcampos\Documents
.\SincronizarFacturas.ps1
```

Verás una salida como esta:

```
==========================================
  Sincronizacion Facturas Electronicas
==========================================
Destino : C:\Users\cdcampos\Documents\FacturasElectronicas
Servidor: https://facturacion-electronica.ngrok.io

Consultando semanas disponibles... OK (13 semanas)
  [↓] 2026/01_january/semana_01  (10 facturas)... OK (8 PDFs)
  [↓] 2026/01_january/semana_02  (35 facturas)... OK (33 PDFs)
  [=] 2026/02_february/semana_06  (48 PDFs ya descargados)
  ...

==========================================
  Sincronizacion completada
  Semanas nuevas descargadas : 10
  Semanas ya existentes      : 3
==========================================
```

El script **no repite descargas**: si una semana ya tiene PDFs, la omite. Solo descarga las semanas nuevas.

---

## Estructura de carpetas resultante

```
C:\Users\cdcampos\Documents\FacturasElectronicas\
  2026\
    01_january\
      semana_01\
        2026-01-01_800136835_92183.pdf
        2026-01-02_830001113_12881.pdf
        ...
      semana_02\
        ...
    02_february\
      semana_06\
        ...
    03_march\
      semana_11\
        ...
```

Cada PDF se nombra como: `FECHA-EMISION_NIT_NUMERO-FACTURA.pdf`

> Solo se descargan **facturas electrónicas**. Las notas de crédito y otros documentos quedan excluidos automáticamente.

---

## Programar ejecución automática (opcional)

Para que el script corra automáticamente cada día sin intervención:

1. Abre el **Programador de tareas** (`taskschd.msc`)
2. Clic en **Crear tarea básica**
3. Completa el asistente:
   - **Nombre:** Sincronizar Facturas Electrónicas
   - **Desencadenador:** Diariamente, a las `06:30 AM`
   - En **Configuración avanzada del desencadenador**: marcar *Repetir solo en días de semana* (lunes a viernes)
   - **Acción:** Iniciar un programa
     - Programa: `powershell.exe`
     - Argumentos: `-WindowStyle Hidden -File "C:\Users\cdcampos\Documents\SincronizarFacturas.ps1"`
4. Marcar **Ejecutar tanto si el usuario inició sesión como si no**
5. Clic en **Finalizar**

---

## Trasladar a la unidad de red (cuando tengas permisos)

Cuando tengas acceso a `K:\Dirección de Servicios Generales\...\FACTURACION\1 RADICADAS\`, cambia la variable en el script:

```powershell
$DESTINO = "K:\Dirección de Servicios Generales\...\FACTURACION\1 RADICADAS\FacturasElectronicas"
```

El script funciona igual con rutas de red. Asegúrate de que la unidad esté mapeada antes de ejecutarlo.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `No se puede cargar el archivo porque la ejecución de scripts está deshabilitada` | Política de ejecución no configurada | Ejecutar `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| `ERROR: 401` | Contraseña incorrecta | Revisar `$USUARIO` y `$PASSWORD` en el script |
| `ERROR: No se puede conectar al servidor` | URL ngrok cambió o no está activa | Verificar que el portal esté en línea y actualizar `$BASE_URL` |
| PDFs descargados pero la semana se vuelve a descargar | La carpeta existe pero vacía | Eliminar la carpeta vacía y volver a ejecutar |
| Semana muestra 0 PDFs | Facturas aún no procesadas en el servidor | Ejecutar primero el paso 2 (Procesar) desde la página web |
