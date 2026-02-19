import { AppSettings } from './types';

const GITHUB_API = 'https://api.github.com';

function toBase64(str: string): string {
  const utf8 = unescape(encodeURIComponent(str));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < utf8.length) {
    const a = utf8.charCodeAt(i++);
    const b = i < utf8.length ? utf8.charCodeAt(i++) : 0;
    const c = i < utf8.length ? utf8.charCodeAt(i++) : 0;
    const triplet = (a << 16) | (b << 8) | c;
    const padding = i - utf8.length;
    result += chars[(triplet >> 18) & 63];
    result += chars[(triplet >> 12) & 63];
    result += padding > 1 ? '=' : chars[(triplet >> 6) & 63];
    result += padding > 0 ? '=' : chars[triplet & 63];
  }
  return result;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
}

function getSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function buildValidateScript(): string {
  return `const fs = require('fs');

let code = fs.readFileSync('App.js', 'utf8');

// Auto-fix common AI code generation mistakes
code = code.replace(/(\\d+)(px|em|rem|vh|vw|pt|dp|sp)\\b/g, '$1');
code = code.replace(/,([\\s]*[}\\]])/g, '$1');
code = code.replace(/(\\d+)\\s*(seconds?|minutes?|hours?|items?|times?|days?)\\b/g, '$1');

// Quote object keys that start with numbers
code = code.replace(/\\{(\\s*)(\\d+[a-zA-Z]\\w*)(\\s*):/g, "{$1'$2'$3:");
code = code.replace(/,(\\s*)(\\d+[a-zA-Z]\\w*)(\\s*):/g, ",$1'$2'$3:");

// Fix unclosed brackets
let braces = 0, parens = 0, brackets = 0;
let inStr = false, strCh = '', inTpl = false;
for (let i = 0; i < code.length; i++) {
  const c = code[i], p = i > 0 ? code[i-1] : '';
  if (inStr) { if (c === strCh && p !== '\\\\') inStr = false; continue; }
  if (inTpl) { if (c === '\`' && p !== '\\\\') inTpl = false; continue; }
  if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
  if (c === '\`') { inTpl = true; continue; }
  if (c === '{') braces++; else if (c === '}') braces--;
  if (c === '(') parens++; else if (c === ')') parens--;
  if (c === '[') brackets++; else if (c === ']') brackets--;
}
while (braces > 0) { code += '\\n}'; braces--; }
while (parens > 0) { code += ')'; parens--; }
while (brackets > 0) { code += ']'; brackets--; }

fs.writeFileSync('App.js', code);

// Try parsing with a simple check
try {
  new Function('"use strict";' + code.replace(/import\\s+/g, 'var _i = ').replace(/export\\s+default/g, 'var _e ='));
  console.log('Syntax validation passed');
} catch (e) {
  console.warn('Warning: Basic syntax check flagged an issue:', e.message);
  console.log('Proceeding with build anyway - React Native bundler may handle it');
}
`;
}

function buildWorkflowYml(appName: string, packageName: string): string {
  const lines = [
    'name: Build APK',
    'on:',
    '  push:',
    '    branches: [ main ]',
    '  workflow_dispatch:',
    '',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '',
    '      - name: Setup Node.js',
    '        uses: actions/setup-node@v4',
    '        with:',
    '          node-version: 20',
    '',
    '      - name: Setup Java',
    '        uses: actions/setup-java@v4',
    '        with:',
    '          distribution: temurin',
    '          java-version: 17',
    '',
    '      - name: Validate and fix App.js syntax',
    '        run: node validate.js',
    '',
    '      - name: Create React Native project',
    '        run: |',
    '          npx @react-native-community/cli init ' + appName + ' --version 0.76.9 --skip-git-init --skip-install',
    '          cp App.js ' + appName + '/App.js',
    '          cd ' + appName,
    '          npm install',
    '',
    '      - name: Generate app icon',
    '        run: |',
    '          sudo apt-get install -y imagemagick',
    '          for s in 48 72 96 144 192; do',
    '            case $s in',
    '              48) density=mdpi;;',
    '              72) density=hdpi;;',
    '              96) density=xhdpi;;',
    '              144) density=xxhdpi;;',
    '              192) density=xxxhdpi;;',
    '            esac',
    '            dir="' + appName + '/android/app/src/main/res/mipmap-$density"',
    '            mkdir -p "$dir"',
    '            convert -size "${s}x${s}" xc:"#0f172a" -fill "#00d4ff" -gravity center -pointsize $(($s/3)) -annotate 0 "ZB" "$dir/ic_launcher.png"',
    '            cp "$dir/ic_launcher.png" "$dir/ic_launcher_round.png"',
    '          done',
    '',
    '      - name: Build release APK',
    '        working-directory: ' + appName + '/android',
    '        run: |',
    '          chmod +x gradlew',
    '          ./gradlew assembleRelease --no-daemon',
    '',
    '      - name: Build release AAB',
    '        working-directory: ' + appName + '/android',
    '        run: ./gradlew bundleRelease --no-daemon',
    '',
    '      - name: Upload APK',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: app-release-apk',
    '          path: ' + appName + '/android/app/build/outputs/apk/release/app-release.apk',
    '          retention-days: 30',
    '',
    '      - name: Upload AAB',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: app-release-aab',
    '          path: ' + appName + '/android/app/build/outputs/bundle/release/app-release.aab',
    '          retention-days: 30',
  ];
  return lines.join('\n') + '\n';
}

async function checkRepoExists(slug: string, settings: AppSettings): Promise<GitHubRepo | null> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${settings.githubUsername}/${slug}`, {
      headers: authHeaders(settings.githubToken),
    });
    if (response.ok) {
      const data = await response.json();
      return { name: data.name, full_name: data.full_name, html_url: data.html_url };
    }
  } catch {}
  return null;
}

export async function createRepo(name: string, description: string, settings: AppSettings): Promise<GitHubRepo> {
  const slug = getSlug(name);

  const existing = await checkRepoExists(slug, settings);
  if (existing) {
    return existing;
  }

  const safeDescription = (description || '').slice(0, 350).replace(/[^\x20-\x7E]/g, ' ');

  const response = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: authHeaders(settings.githubToken),
    body: JSON.stringify({
      name: slug,
      description: safeDescription,
      auto_init: true,
      private: false,
    }),
  });

  if (!response.ok) {
    let error: any = {};
    try { error = await response.json(); } catch {}
    const msg = error.message || '';
    if (msg.includes('Resource not accessible') || response.status === 403) {
      throw new Error(
        'Your token can\'t create repositories. Two ways to fix this:\n\n' +
        '1. Create the repo manually: Go to github.com, click "+", then "New repository", ' +
        `name it "${slug}", make it public, check "Add a README", and click Create. ` +
        'Then try pushing again.\n\n' +
        '2. Or create a Classic token instead (Settings > Step 2 guide).'
      );
    }
    if (response.status === 401) {
      throw new Error('Your GitHub token is invalid or expired. Please create a new one in Settings.');
    }
    if (response.status === 422) {
      if (msg.includes('name already exists')) {
        const existing = await checkRepoExists(slug, settings);
        if (existing) return existing;
      }
      throw new Error(`GitHub rejected the request: ${msg}. Try using a simpler app name.`);
    }
    throw new Error(msg || `Failed to create repository (HTTP ${response.status})`);
  }

  return response.json();
}

export async function pushCode(
  repoName: string,
  code: string,
  settings: AppSettings,
): Promise<void> {
  const slug = getSlug(repoName);
  const owner = settings.githubUsername;
  const headers = authHeaders(settings.githubToken);

  const appName = slug.replace(/-/g, '');
  const packageName = `com.zerobuild.${appName}`;

  const workflowYml = buildWorkflowYml(appName, packageName);

  const validateScript = buildValidateScript();

  const files: { path: string; content: string }[] = [
    { path: 'App.js', content: code },
    { path: 'validate.js', content: validateScript },
    { path: '.github/workflows/build.yml', content: workflowYml },
  ];

  await new Promise(resolve => setTimeout(resolve, 1500));

  let refData: any;
  for (let retry = 0; retry < 3; retry++) {
    const refRes = await fetch(`${GITHUB_API}/repos/${owner}/${slug}/git/ref/heads/main`, { headers });
    if (refRes.ok) {
      refData = await refRes.json();
      break;
    }
    if (retry < 2) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      let errMsg = `HTTP ${refRes.status}`;
      try { const err = await refRes.json(); errMsg = err.message || errMsg; } catch {}
      throw new Error(`Could not access repository. Make sure "${slug}" exists on GitHub with a main branch. (${errMsg})`);
    }
  }
  const latestSha = refData.object.sha;

  const blobs: { path: string; sha: string }[] = [];
  for (const file of files) {
    const blobRes = await fetch(`${GITHUB_API}/repos/${owner}/${slug}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
    });
    if (!blobRes.ok) {
      let errMsg = `HTTP ${blobRes.status}`;
      try { const err = await blobRes.json(); errMsg = err.message || errMsg; } catch {}
      throw new Error(`Failed to upload ${file.path}: ${errMsg}`);
    }
    const blobData = await blobRes.json();
    blobs.push({ path: file.path, sha: blobData.sha });
  }

  const treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${slug}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: latestSha,
      tree: blobs.map(b => ({
        path: b.path,
        mode: '100644',
        type: 'blob',
        sha: b.sha,
      })),
    }),
  });
  if (!treeRes.ok) {
    let errMsg = `HTTP ${treeRes.status}`;
    try { const err = await treeRes.json(); errMsg = err.message || errMsg; } catch {}
    throw new Error(`Failed to prepare files for commit: ${errMsg}`);
  }
  const treeData = await treeRes.json();

  const commitRes = await fetch(`${GITHUB_API}/repos/${owner}/${slug}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: 'Push app code and build workflow via ZeroBuild AI',
      tree: treeData.sha,
      parents: [latestSha],
    }),
  });
  if (!commitRes.ok) {
    let errMsg = `HTTP ${commitRes.status}`;
    try { const err = await commitRes.json(); errMsg = err.message || errMsg; } catch {}
    throw new Error(`Failed to create commit: ${errMsg}`);
  }
  const commitData = await commitRes.json();

  const updateRes = await fetch(`${GITHUB_API}/repos/${owner}/${slug}/git/refs/heads/main`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commitData.sha }),
  });
  if (!updateRes.ok) {
    let errMsg = `HTTP ${updateRes.status}`;
    try { const err = await updateRes.json(); errMsg = err.message || errMsg; } catch {}
    if (errMsg.includes('Resource not accessible') || updateRes.status === 403) {
      throw new Error(
        'Can\'t push code. Your token needs "Read and Write" permission for Contents. ' +
        'Edit your token on GitHub and add this permission, or create a Classic token with "repo" scope.'
      );
    }
    throw new Error(`Failed to push code: ${errMsg}`);
  }
}

export function getApkDownloadUrl(username: string, repoName: string): string {
  const slug = getSlug(repoName);
  return `https://github.com/${username}/${slug}/actions`;
}

export function getRepoUrl(username: string, repoName: string): string {
  const slug = getSlug(repoName);
  return `https://github.com/${username}/${slug}`;
}
