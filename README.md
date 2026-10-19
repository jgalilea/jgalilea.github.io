# jgalilea.github.io

Portfolio con todos mis proyectos de GitHub, hecho con [Astro](https://astro.build) y [Tailwind CSS](https://tailwindcss.com).

Los proyectos se leen automáticamente de la API de GitHub al compilar:

- **Etiquetas**: los *topics* del repositorio.
- **Descripción**: la descripción del repositorio (sección *About*).
- **Botón «Pruébalo»**: el campo *Website* del repo (si está vacío, no aparece).

Se excluyen los forks, los repos archivados y los que tengan el topic `no-portfolio`.

Está en español (`/`) e inglés (`/en/`). Los textos de la interfaz están en `src/i18n/ui.ts`. La primera visita desde un navegador que no está en español redirige a `/en/`, y el idioma elegido con el selector se recuerda.

Tiene tema claro, oscuro y automático (sigue al sistema); la elección se guarda en el navegador.

La web se publica en GitHub Pages con GitHub Actions en cada push a `main` y una vez al día, para recoger los cambios de los repos.

## Desarrollo

```sh
npm install
GITHUB_TOKEN=$(gh auth token) npm run dev   # el token es opcional, evita el límite de peticiones
```
