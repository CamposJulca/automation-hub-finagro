# Guía de sincronización de facturas electrónicas

Descarga los PDFs de facturas electrónicas desde el portal Automation Hub a tu computador Windows, organizados por semana.

---

## Requisitos

- Windows 10 / 11
- PowerShell 5.1 o superior (incluido en Windows por defecto)
- Acceso a internet (para conectarse al portal)
- Credenciales del portal Automation Hub Finagro

---

## Primer uso

### 1. Obtener el script

1. Inicia sesión en el portal de Automation Hub Finagro.
2. Ve a la sección **Facturación** → botón **Descargar script de sincronización**.
3. Guarda el archivo `SincronizarFacturas.ps1` en tu carpeta de trabajo (por ejemplo, `Documentos`).

El script descargado ya viene preconfigurado con el servidor y las credenciales del usuario técnico. **No necesitas editar credenciales manualmente.**

### 2. Habilitar ejecución de scripts (solo la primera vez)

Abre PowerShell y ejecuta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Responde `S` (Sí) cuando te pregunte.

### 3. Personalizar destino (opcional)

Si quieres cambiar dónde se guardan los PDFs, abre el script con Bloc de notas o VS Code y ajusta la variable `$DESTINO`:

```powershell
$DESTINO = "C:\Users\<TU_USUARIO>\Documents\FacturasElectronicas"
```

El valor por defecto guarda los PDFs en `%USERPROFILE%\Documents\FacturasElectronicas`.

---

## Ejecutar manualmente

Abre PowerShell, navega a la carpeta donde está el script y ejecútalo:

```powershell
cd $HOME\Documents
.\SincronizarFacturas.ps1
```

Verás una salida como esta:

```
==========================================
  Sincronizacion Facturas Electronicas
==========================================
Destino : C:\Users\<TU_USUARIO>\Documents\FacturasElectronicas
Servidor: <URL del portal>

Consultando semanas disponibles... OK (13 semanas)
  [>>] 2026/01_january/semana_01  (10 facturas)... OK (8 PDFs)
  [>>] 2026/01_january/semana_02  (35 facturas)... OK (33 PDFs)
  [OK] 2026/02_february/semana_06  (48 PDFs ya descargados)
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
<DESTINO>\
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
     - Argumentos: `-WindowStyle Hidden -File "%USERPROFILE%\Documents\SincronizarFacturas.ps1"`
4. Marcar **Ejecutar tanto si el usuario inició sesión como si no**
5. Clic en **Finalizar**

---

## Trasladar a la unidad de red (cuando tengas permisos)

Cuando tengas acceso a `K:\Dirección de Servicios Generales\...\FACTURACION\1 RADICADAS\`, cambia la variable `$DESTINO` en el script:

```powershell
$DESTINO = "K:\Dirección de Servicios Generales\...\FACTURACION\1 RADICADAS\FacturasElectronicas"
```

El script funciona igual con rutas de red. Asegúrate de que la unidad esté mapeada antes de ejecutarlo.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `No se puede cargar el archivo porque la ejecución de scripts está deshabilitada` | Política de ejecución no configurada | Ejecutar `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| `ERROR: 401` | Credenciales rotadas o script viejo | Volver a descargar el script desde el portal autenticado |
| `ERROR: No se puede conectar al servidor` | URL del portal cambió o portal no disponible | Volver a descargar el script desde el portal autenticado |
| PDFs descargados pero la semana se vuelve a descargar | La carpeta existe pero vacía | Eliminar la carpeta vacía y volver a ejecutar |
| Semana muestra 0 PDFs | Facturas aún no procesadas en el servidor | Ejecutar primero el paso 2 (Procesar) desde la página web |
