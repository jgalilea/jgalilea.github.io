// Fetches the user's repositories from the GitHub API at build time.

// In GitHub Actions the owner comes from the repo, so renaming the account doesn't break the site.
export const GITHUB_USER = process.env.GITHUB_REPOSITORY_OWNER ?? 'jgalilea';

// Repos with this topic are hidden from the portfolio.
const HIDE_TOPIC = 'no-portfolio';

export interface Project {
  name: string;
  url: string;
  homepage: string | null;
  summary: string | null;
  topics: string[];
  language: string | null;
  stars: number;
  updatedAt: string;
}

interface Repo {
  name: string;
  html_url: string;
  homepage: string | null;
  description: string | null;
  topics?: string[];
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

const API = 'https://api.github.com';

function headers(): HeadersInit {
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': `${GITHUB_USER}-portfolio`,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchRepos(): Promise<Repo[]> {
  const repos: Repo[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${API}/users/${GITHUB_USER}/repos?per_page=100&page=${page}&sort=pushed`,
      { headers: headers() },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const batch: Repo[] = await res.json();
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

let cache: Promise<Project[]> | undefined;

/** Projects to show, fetched once per build and shared by every language. */
export function getProjects(): Promise<Project[]> {
  cache ??= loadProjects();
  return cache;
}

async function loadProjects(): Promise<Project[]> {
  const repos = (await fetchRepos()).filter(
    (r) =>
      !r.fork &&
      !r.archived &&
      r.name.toLowerCase() !== `${GITHUB_USER}.github.io` &&
      !r.topics?.includes(HIDE_TOPIC),
  );

  return repos.map((r) => ({
    name: r.name,
    url: r.html_url,
    homepage: r.homepage?.trim() || null,
    summary: r.description?.trim() || null,
    topics: r.topics ?? [],
    language: r.language,
    stars: r.stargazers_count,
    updatedAt: r.pushed_at,
  }));
}
