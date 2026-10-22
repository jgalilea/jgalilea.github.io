# jgalilea.github.io

Portfolio con todos mis proyectos de GitHub, hecho con [Astro](https://astro.build) y [Tailwind CSS](https://tailwindcss.com).

Antes de compilar, `scripts/sync-projects.ts` lee los repos de la API de GitHub y deja los datos en `src/data/projects.json` y las imágenes en `public/previews/`:

- **Etiquetas**: los *topics* del repositorio.
- **Descripción**: la descripción del repositorio (sección *About*).
- **Botón «Pruébalo»**: el campo *Website* del repo (si está vacío, no aparece).
- **Imagen**: un `preview.png`/`.jpg`/`.webp` en la raíz del repo o en `.github/`; si no hay, una captura de la web hecha con Playwright; si no tiene web, un fondo generado.

Los repos con el topic `featured` aparecen además en la sección **Destacados**, como una tarjeta visual con la imagen de fondo.

Se excluyen los forks, los repos archivados y los que tengan el topic `no-portfolio`.

## Datos personales

El nombre, el texto de «Sobre mí» y los enlaces con logo (GitHub, LinkedIn, CV y email) están en `src/config.ts`. Un enlace vacío no se muestra. El bloque de contacto del pie usa el email, o LinkedIn si no hay email.

Al sincronizar también se genera `public/og.png`, la imagen que se ve al compartir el enlace (Open Graph), con tu nombre y capturas de los proyectos.

## Repos privados

Solo aparecen los repos privados con el topic `portfolio`, sin botón de código. Para que el workflow pueda verlos hace falta un token personal guardado como secreto `PORTFOLIO_TOKEN`:

1. Crea un *fine-grained token* en <https://github.com/settings/personal-access-tokens/new> con acceso a todos tus repos y permisos de solo lectura de **Metadata** y **Contents** (este último para leer el `preview.png`).
2. Guárdalo en el repo: `gh secret set PORTFOLIO_TOKEN`.

## Idiomas y tema

Está en español (`/`) e inglés (`/en/`). Los textos de la interfaz están en `src/i18n/ui.ts`. La primera visita desde un navegador que no está en español redirige a `/en/`, y el idioma elegido con el selector se recuerda.

Tiene tema claro, oscuro y automático (sigue al sistema); la elección se guarda en el navegador.

## Publicación

GitHub Actions publica la web en GitHub Pages en cada push a `main` y una vez al día, para recoger los cambios de los repos.

## Desarrollo

```sh
npm install
npx playwright install chromium
GITHUB_TOKEN=$(gh auth token) npm run sync   # descarga proyectos e imágenes
npm run dev
```
