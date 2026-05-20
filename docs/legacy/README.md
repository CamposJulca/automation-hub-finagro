# Documentación de módulos deprecados

Los módulos `sarlaft` y `nlp-camara` fueron desconectados del runtime productivo durante la migración del stack desde Neusi 101 al servidor ilab de Finagro.

Razones del descarte:
- `nlp-camara`: legacy del pipeline de extracción anterior, reemplazado por FactIA + APScheduler
- `sarlaft`: módulo piloto sin uso productivo real

El código de ambos módulos permanece en el repositorio (`backend/modules/sarlaft/`, `frontend/src/pages/SarlaftPage.js`) como referencia para eventual reactivación. Esta carpeta conserva la documentación operacional original.

Ver `MIGRACION_A_SERVIDOR_EMPRESARIAL.md` en la raíz para contexto completo de la migración.
