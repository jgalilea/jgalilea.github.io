// Projects prepared by scripts/sync-projects.ts.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// In GitHub Actions the owner comes from the repo, so renaming the account doesn't break the site.
export const GITHUB_USER = process.env.GITHUB_REPOSITORY_OWNER ?? 'jgalilea';

// Repos with this topic go in the featured section.
export const FEATURED_TOPIC = 'featured';

// Topics that control the portfolio itself and aren't shown as tags.
export const HIDDEN_TOPICS = ['portfolio', 'no-portfolio', FEATURED_TOPIC];

export interface Project {
  name: string;
  url: string;
  homepage: string | null;
  summary: string | null;
  topics: string[];
  language: string | null;
  stars: number;
  updatedAt: string;
  private: boolean;
  featured: boolean;
  /** Path of the preview image inside the site, if there is one. */
  image: string | null;
}

let cache: Promise<Project[]> | undefined;

export function getProjects(): Promise<Project[]> {
  // Resolved from the project root: Astro bundles this module, so import.meta.url would point elsewhere.
  cache ??= readFile(resolve('src/data/projects.json'), 'utf8')
    .then((json) => JSON.parse(json) as Project[])
    .catch(() => {
      throw new Error('src/data/projects.json not found. Run `npm run sync` first.');
    });
  return cache;
}
