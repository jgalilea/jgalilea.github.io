// GitHub's colors for the languages used in the portfolio.
const colors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  HTML: '#e34c26',
  CSS: '#663399',
  Astro: '#ff5a03',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  Kotlin: '#a97bff',
  Shell: '#89e051',
};

export const languageColor = (language: string | null) => (language && colors[language]) || '#94a3b8';
