# Build congelada para el Checkpoint 2

Snapshot de la SPA que se presenta en **CP2 (sábado 14/11, 18:00)**. Sirve como "primer progreso" aunque después se siga tocando código: la demo de CP2 queda **inmutable** porque la SPA se sirve desde esta carpeta.

## Qué contiene

- `web/` → bundle de producción completo (`index.html` + `assets/…`), copiado de `apps/web/dist`.
- `build-info.json` → commit/tag, versión de stack, hashes SHA-256 de cada fichero y qué estado funcional incluye.
- `e2e/` → evidencia de tests end-to-end (reporte API, reporte navegador y capturas).

## Cómo se presenta (la forma segura)

```powershell
cd D:\hackaton\Programa\Joniha
powershell -ExecutionPolicy Bypass -File scripts\serve-cp2.ps1
# → imprime la URL (8000, o el siguiente libre) y sirve la SPA congelada + API
```

El script copia `releases/cp2/web` a `apps/web/dist` (sin rebuild) y arranca FastAPI. La API usa el contrato congelado (`docs/contracts/openapi-v1.json`, deep-equal) y el seed de los 3 pacientes.

## Cómo se recupera el código exacto

```powershell
git checkout cp2-build          # el código de esta build (tag local, sin push)
git checkout -                  # volver a main
```

## Criterio de congelación

- Se congela **la SPA**. La API se sirve desde el repo actual porque su contrato está congelado; si en la siguiente parte cambia algo interno, el contrato no debe romperse (gate: OpenAPI deep-equal).
- Cualquier cambio de UI posterior **no** debe presentarse en CP2: para eso está este snapshot.
