export const languages = {
  es: 'Español',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'es';

export const ui = {
  es: {
    'meta.title': 'Portfolio',
    'meta.description': 'Proyectos de {name}: {role}. Apps web, herramientas y experimentos publicados en GitHub.',
    'about.title': 'Sobre mí',
    'featured.title': 'Destacados',
    'projects.title': 'Todos los proyectos',
    'projects.intro': 'Todo lo que tengo publicado en',
    'links.github': 'GitHub',
    'links.linkedin': 'LinkedIn',
    'links.email': 'Email',
    'filters.label': 'Buscar y filtrar',
    'search.label': 'Buscar proyectos',
    'search.placeholder': 'Buscar por nombre, descripción o etiqueta…',
    'sort.label': 'Ordenar',
    'sort.updated': 'Más recientes',
    'sort.name': 'Nombre',
    'sort.stars': 'Estrellas',
    'filters.tags': 'Etiquetas',
    'filters.languages': 'Lenguajes',
    'filters.clear': 'Limpiar filtros',
    'filters.more': '+{count} más',
    'filters.less': 'Ver menos',
    'count.all': '{total} proyectos',
    'count.filtered': '{visible} de {total} proyectos',
    'empty': 'Ningún proyecto coincide con la búsqueda.',
    'footer': 'Generado automáticamente desde GitHub · Actualizado el {date}',
    'project.noDescription': 'Sin descripción.',
    'project.stars': 'Estrellas',
    'project.code': 'Código',
    'project.private': 'Privado',
    'project.try': 'Pruébalo',
    'theme.label': 'Tema',
    'theme.light': 'Tema claro',
    'theme.dark': 'Tema oscuro',
    'theme.system': 'Tema automático',
    'language.label': 'Idioma',
  },
  en: {
    'meta.title': 'Portfolio',
    'meta.description': 'Projects by {name}, {role}: web apps, tools and experiments published on GitHub.',
    'about.title': 'About me',
    'featured.title': 'Featured',
    'projects.title': 'All projects',
    'projects.intro': 'Everything I have published on',
    'links.github': 'GitHub',
    'links.linkedin': 'LinkedIn',
    'links.email': 'Email',
    'filters.label': 'Search and filter',
    'search.label': 'Search projects',
    'search.placeholder': 'Search by name, description or tag…',
    'sort.label': 'Sort',
    'sort.updated': 'Most recent',
    'sort.name': 'Name',
    'sort.stars': 'Stars',
    'filters.tags': 'Tags',
    'filters.languages': 'Languages',
    'filters.clear': 'Clear filters',
    'filters.more': '+{count} more',
    'filters.less': 'Show less',
    'count.all': '{total} projects',
    'count.filtered': '{visible} of {total} projects',
    'empty': 'No projects match your search.',
    'footer': 'Automatically generated from GitHub · Updated {date}',
    'project.noDescription': 'No description.',
    'project.stars': 'Stars',
    'project.code': 'Code',
    'project.private': 'Private',
    'project.try': 'Try it',
    'theme.label': 'Theme',
    'theme.light': 'Light theme',
    'theme.dark': 'Dark theme',
    'theme.system': 'System theme',
    'language.label': 'Language',
  },
} as const;

export type UiKey = keyof (typeof ui)[typeof defaultLang];

export const locales: Record<Lang, string> = {
  es: 'es-ES',
  en: 'en-US',
};

export function useTranslations(lang: Lang) {
  return (key: UiKey, vars: Record<string, string | number> = {}) =>
    (ui[lang][key] as string).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

/** Path of the home page for a language, e.g. `/` or `/en/`. */
export function homePath(lang: Lang): string {
  return lang === defaultLang ? '/' : `/${lang}/`;
}
