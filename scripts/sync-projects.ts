// Fetches the portfolio projects from GitHub and prepares their preview images.
// Writes src/data/projects.json and public/previews/*, which the Astro build reads.
//
// Usage: GITHUB_TOKEN=... node scripts/sync-projects.ts

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';
import { FEATURED_TOPIC, GITHUB_USER, HIDDEN_TOPICS, type Project } from '../src/lib/projects.ts';
import { profile } from '../src/config.ts';

// Repos with this topic are hidden from the portfolio.
const HIDE_TOPIC = 'no-portfolio';
// Private repos only show up when they have this topic.
const SHOW_PRIVATE_TOPIC = 'portfolio';
// A repo can provide its own preview image with one of these names.
const PREVIEW_FILE = /^preview\.(png|jpe?g|webp)$/i;

const API = 'https://api.github.com';
const PREVIEWS_DIR = new URL('../public/previews/', import.meta.url);
const DATA_FILE = new URL('../src/data/projects.json', import.meta.url);
const OG_IMAGE = new URL('../public/og.png', import.meta.url);
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

/** Renders the image shown when the portfolio link is shared (1200×630). */
async function renderOgImage(browser: Browser, projects: Project[]) {
  // Featured projects first, then the rest, as long as they have a preview.
  const shown = [...projects.filter((p) => p.featured), ...projects.filter((p) => !p.featured)]
    .filter((p) => p.image)
    .slice(0, 4);
  const images = await Promise.all(
    shown.map(async (p) => {
      const file = await readFile(new URL(`..${p.image}`, PREVIEWS_DIR));
      const type = p.image!.endsWith('.png') ? 'png' : p.image!.endsWith('.webp') ? 'webp' : 'jpeg';
      return `data:image/${type};base64,${file.toString('base64')}`;
    }),
  );
  const languages = [...new Set(projects.map((p) => p.language).filter(Boolean))].slice(0, 4);
  const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<!doctype html>
<html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: system-ui, sans-serif;
    background: radial-gradient(circle at 15% 20%, #0c4a6e 0, transparent 55%), #020617; color: #f1f5f9; }
  .text { position: absolute; left: 72px; top: 0; bottom: 0; width: 520px;
    display: flex; flex-direction: column; justify-content: center; gap: 20px; }
  .avatar { width: 96px; height: 96px; border-radius: 50%; border: 4px solid #1e293b; }
  h1 { font-size: 64px; line-height: 1.05; letter-spacing: -0.02em; }
  .role { font-size: 30px; color: #94a3b8; }
  .meta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .pill { padding: 8px 18px; border-radius: 999px; background: #0f172a; border: 1px solid #334155;
    font-size: 22px; color: #cbd5e1; }
  .url { font-size: 24px; color: #38bdf8; font-weight: 600; }
  .shots { position: absolute; left: 640px; top: -40px; display: grid; grid-template-columns: 1fr 1fr;
    gap: 20px; width: 640px; transform: rotate(-8deg); }
  .shots img { width: 100%; aspect-ratio: 16/10; object-fit: cover; object-position: top;
    border-radius: 14px; border: 1px solid #334155; box-shadow: 0 20px 40px #0008; }
  .shots img:nth-child(even) { margin-top: 80px; }
</style></head><body>
  <div class="text">
    <img class="avatar" src="https://github.com/${GITHUB_USER}.png?size=192">
    <h1>${escape(profile.name)}</h1>
    <p class="role">${escape(profile.role.en)} · Portfolio</p>
    <div class="meta">${languages.map((l) => `<span class="pill">${escape(l!)}</span>`).join('')}</div>
    <p class="url">${GITHUB_USER.toLowerCase()}.github.io</p>
  </div>
  <div class="shots">${images.map((src) => `<img src="${src}">`).join('')}</div>
</body></html>`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: OG_IMAGE.pathname, type: 'png' });
  await page.close();
  console.log('  og.png rendered');
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
      featured: repo.topics?.includes(FEATURED_TOPIC) ?? false,
      image: image && `/previews/${image}`,
    });
  }
  browser ??= await chromium.launch();
  await renderOgImage(browser, projects);
  await browser.close();

  await writeFile(DATA_FILE, JSON.stringify(projects, null, 2) + '\n');
}

await main();
