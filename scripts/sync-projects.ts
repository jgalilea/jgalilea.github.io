// Fetches the portfolio projects from GitHub and prepares their preview images.
// Writes src/data/projects.json and public/previews/*, which the Astro build reads.
//
// Usage: GITHUB_TOKEN=... node scripts/sync-projects.ts

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';
import { GITHUB_USER, HIDDEN_TOPICS, type Project } from '../src/lib/projects.ts';

// Repos with this topic are hidden from the portfolio.
const HIDE_TOPIC = 'no-portfolio';
// Private repos only show up when they have this topic.
const SHOW_PRIVATE_TOPIC = 'portfolio';
// A repo can provide its own preview image with one of these names.
const PREVIEW_FILE = /^preview\.(png|jpe?g|webp)$/i;

const API = 'https://api.github.com';
const PREVIEWS_DIR = new URL('../public/previews/', import.meta.url);
const DATA_FILE = new URL('../src/data/projects.json', import.meta.url);
const token = process.env.GITHUB_TOKEN;

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
  private: boolean;
  owner: { login: string };
}

function headers(accept = 'application/vnd.github+json'): HeadersInit {
  return {
    Accept: accept,
    'User-Agent': `${GITHUB_USER}-portfolio`,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchAll(path: string): Promise<Repo[]> {
  const repos: Repo[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}${path}&per_page=100&page=${page}`, { headers: headers() });
    if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
    const batch: Repo[] = await res.json();
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

/** Private repos need a personal token; the default Actions token can't list them. */
async function fetchPrivateRepos(): Promise<Repo[]> {
  if (!token) return [];
  try {
    const repos = await fetchAll('/user/repos?visibility=private&affiliation=owner');
    return repos.filter((r) => r.owner.login.toLowerCase() === GITHUB_USER.toLowerCase());
  } catch (error) {
    console.warn(`Skipping private repos: ${(error as Error).message.split('\n')[0]}`);
    return [];
  }
}

async function getRepos(): Promise<Repo[]> {
  const [publicRepos, privateRepos] = await Promise.all([
    fetchAll(`/users/${GITHUB_USER}/repos?type=owner`),
    fetchPrivateRepos(),
  ]);
  return [
    ...publicRepos.filter((r) => !r.private),
    ...privateRepos.filter((r) => r.private && r.topics?.includes(SHOW_PRIVATE_TOPIC)),
  ].filter(
    (r) =>
      !r.fork &&
      !r.archived &&
      r.name.toLowerCase() !== `${GITHUB_USER}.github.io`.toLowerCase() &&
      !r.topics?.includes(HIDE_TOPIC),
  );
}

/** Looks for a preview image committed to the repo, at its root or in .github/. */
async function downloadPreviewFile(repo: Repo): Promise<string | null> {
  for (const dir of ['', '.github']) {
    const res = await fetch(`${API}/repos/${repo.owner.login}/${repo.name}/contents/${dir}`, {
      headers: headers(),
    });
    if (!res.ok) continue;
    const entries: { name: string; path: string; type: string }[] = await res.json();
    const file = Array.isArray(entries) && entries.find((e) => e.type === 'file' && PREVIEW_FILE.test(e.name));
    if (!file) continue;

    const raw = await fetch(`${API}/repos/${repo.owner.login}/${repo.name}/contents/${file.path}`, {
      headers: headers('application/vnd.github.raw+json'),
    });
    if (!raw.ok) continue;
    const ext = file.name.split('.').pop()!.toLowerCase();
    const name = `${repo.name.toLowerCase()}.${ext}`;
    await writeFile(new URL(name, PREVIEWS_DIR), Buffer.from(await raw.arrayBuffer()));
    return name;
  }
  return null;
}

/** Takes a screenshot of the project's website. */
async function screenshot(browser: Browser, repo: Repo): Promise<string | null> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    const response = await page
      .goto(repo.homepage!, { waitUntil: 'networkidle', timeout: 30_000 })
      .catch(async () => {
        // Pages that keep connections open never go idle; settle for the load event.
        await page.waitForLoadState('load', { timeout: 15_000 });
        return null;
      });
    await page.waitForTimeout(1_500); // let animations and fonts settle

    // Bot checks and failed loads render an empty page: better no image than a blank one.
    const visible = await page.evaluate(
      () => document.body.innerText.trim().length > 0 || !!document.querySelector('img, canvas, svg, video'),
    );
    if (!visible) {
      console.warn(`  ${repo.homepage} looks empty (HTTP ${response?.status() ?? '?'}, title "${await page.title()}")`);
      return null;
    }
    const name = `${repo.name.toLowerCase()}.jpg`;
    await page.screenshot({ path: new URL(name, PREVIEWS_DIR).pathname, type: 'jpeg', quality: 75 });
    return name;
  } catch (error) {
    console.warn(`  could not screenshot ${repo.homepage}: ${(error as Error).message.split('\n')[0]}`);
    return null;
  } finally {
    await page.close();
  }
}

async function main() {
  const repos = await getRepos();
  console.log(`Found ${repos.length} projects (${repos.filter((r) => r.private).length} private)`);

  await rm(PREVIEWS_DIR, { recursive: true, force: true });
  await mkdir(PREVIEWS_DIR, { recursive: true });
  await mkdir(new URL('.', DATA_FILE), { recursive: true });

  let browser: Browser | undefined;
  const projects: Project[] = [];
  for (const repo of repos) {
    let image = await downloadPreviewFile(repo);
    if (!image && repo.homepage?.trim()) {
      browser ??= await chromium.launch();
      image = await screenshot(browser, repo);
    }
    console.log(`  ${repo.name}: ${image ?? 'no preview'}`);

    projects.push({
      name: repo.name,
      url: repo.html_url,
      homepage: repo.homepage?.trim() || null,
      summary: repo.description?.trim() || null,
      topics: (repo.topics ?? []).filter((t) => !HIDDEN_TOPICS.includes(t)),
      language: repo.language,
      stars: repo.stargazers_count,
      updatedAt: repo.pushed_at,
      private: repo.private,
      image: image && `/previews/${image}`,
    });
  }
  await browser?.close();

  await writeFile(DATA_FILE, JSON.stringify(projects, null, 2) + '\n');
}

await main();
