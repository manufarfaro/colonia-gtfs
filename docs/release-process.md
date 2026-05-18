# Proceso de release

Cortar un release del feed GTFS sigue un ciclo simple: una rama humana de preparación, un merge a `main`, y un tag que dispara la publicación automática del `gtfs.zip` como GitHub Release.

## Versionado (SemVer)

`vMAJOR.MINOR.PATCH`, siguiendo [Semantic Versioning 2.0](https://semver.org/):

- **PATCH** — hot-fix de datos: corregir un `stop_id` mal escrito, ajustar una coordenada, actualizar un headsign. Sin cambios de schema, sin cambios de comportamiento para consumidores externos.
- **MINOR** — nueva capability del feed: sumar una línea o un nuevo operador, soportar fares confirmados saliendo del placeholder, agregar `route_color`/`route_text_color`.
- **MAJOR** — breaking change consumer-facing: renombrar columnas no estándar, cambiar el formato de `trip_id`, quitar atributos previamente garantizados.

`v0.0.1` es el primer release del feed; se corta cuando se cumplen los criterios de aceptación del [PRD §8](./prd/mvp-v0.md#8-criterios-de-aceptaci%C3%B3n).

## Paso a paso

1. **Abrir branch de preparación** desde `main`:

   ```bash
   git switch main
   git pull origin main
   git switch -c release/X.Y.Z
   ```

   La rama es una convención humana para señalar "estoy preparando un release"; no dispara una CI propia distinta a las que correrían igual.

2. **Sanity check local** (desde la raíz del repo):

   ```bash
   uv sync --directory tooling
   uv run --directory tooling python scripts/build_gtfs_zip.py
   uv run --directory tooling python scripts/validate_gtfs.py
   uv run --directory tooling pytest         # incluye el determinism check
   ```

3. **Si todo OK**, abrir PR `release/X.Y.Z` → `main` y mergear. **Eso es todo** — el merge dispara `.github/workflows/release.yml` automáticamente.

4. El workflow corre y:
   - Extrae la versión del nombre de la rama (`release/X.Y.Z` → `vX.Y.Z`).
   - Construye `gtfs.zip` con `tooling/scripts/build_gtfs_zip.py`.
   - Valida con el MobilityData Canonical Validator.
   - Crea el tag `vX.Y.Z` apuntando al commit de merge **y** el GitHub Release nombrado igual, con `gtfs.zip` adjunto y notas autogeneradas (vía `softprops/action-gh-release@v2`).

   No hace falta `git tag` ni `git push origin vX.Y.Z` manual — el workflow se encarga.

5. **Verificar el release**:

   - Página del release: `https://github.com/manufarfaro/colonia-gtfs/releases/tag/vX.Y.Z`
   - URL estable de "latest" (la que polea MobilityDatabase): `https://github.com/manufarfaro/colonia-gtfs/releases/latest/download/gtfs.zip`

   GitHub responde con un 302 redirect al asset del último release.

## Consumidores downstream

Una vez que `v0.0.1` esté publicado, registrar el feed en MobilityDatabase abriendo un PR contra [`MobilityData/mobility-database-catalogs`](https://github.com/MobilityData/mobility-database-catalogs) con un JSON apuntando a la URL estable de "latest". MDB polea diaria a 00:00 UTC y archiva versiones nuevas automáticamente cuando el `gtfs.zip` cambia.

## Re-publicar manualmente

Para re-publicar una versión sin abrir un nuevo PR `release/X.Y.Z` (por ejemplo, después de un fallo transitorio del Canonical Validator), correr el workflow vía `workflow_dispatch`:

```bash
gh workflow run release.yml --field version=X.Y.Z
```

El workflow se asegura de que el tag exista (lo crea si no) y publica el GitHub Release.

## Rollback

Si un release sale mal:

1. Borrar el GitHub Release (no el tag): `gh release delete vX.Y.Z`.
2. Si el tag también está mal, borrarlo: `git push --delete origin vX.Y.Z`.
3. Aplicar el fix correspondiente y abrir un nuevo `release/X.Y.(Z+1)` (PATCH) o `release/X.(Y+1).0` (MINOR).

No sobrescribir tags publicados con `--force`: consumidores que ya descargaron una versión vieja merecen un número de versión distinto para la corrección.
