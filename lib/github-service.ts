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

  const response = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: authHeaders(settings.githubToken),
    body: JSON.stringify({
      name: slug,
      description,
      auto_init: true,
      private: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
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
    throw new Error(msg || 'Failed to create repository');
  }

  return response.json();
}

export async function pushCode(
  repoName: string,
  code: string,
  settings: AppSettings,
): Promise<void> {
  const slug = getSlug(repoName);

  const appJsContent = toBase64(code);

  await createOrUpdateFile(slug, 'App.js', appJsContent, 'Add generated app code via ZeroBuild AI', settings);

  const packageJson = {
    name: slug,
    version: '1.0.0',
    main: 'App.js',
    scripts: {
      start: 'expo start',
      android: 'expo start --android',
      ios: 'expo start --ios',
      web: 'expo start --web',
    },
    dependencies: {
      expo: '~52.0.0',
      'expo-status-bar': '~2.0.1',
      react: '18.3.1',
      'react-native': '0.76.9',
    },
    devDependencies: {
      '@babel/core': '^7.20.0',
    },
  };

  const pkgContent = toBase64(JSON.stringify(packageJson, null, 2));
  await createOrUpdateFile(slug, 'package.json', pkgContent, 'Add package.json via ZeroBuild AI', settings);

  const appJson = {
    expo: {
      name: repoName,
      slug: slug,
      version: '1.0.0',
      sdkVersion: '52.0.0',
      orientation: 'portrait',
      platforms: ['android'],
      android: {
        package: `com.zerobuild.${slug.replace(/-/g, '')}`,
        adaptiveIcon: {
          backgroundColor: '#000000',
        },
      },
    },
  };

  const appJsonContent = toBase64(JSON.stringify(appJson, null, 2));
  await createOrUpdateFile(slug, 'app.json', appJsonContent, 'Add app.json via ZeroBuild AI', settings);

  const babelConfig = `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
`;
  const babelContent = toBase64(babelConfig);
  await createOrUpdateFile(slug, 'babel.config.js', babelContent, 'Add babel.config.js via ZeroBuild AI', settings);

  const metroConfig = `const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
`;
  const metroContent = toBase64(metroConfig);
  await createOrUpdateFile(slug, 'metro.config.js', metroContent, 'Add metro.config.js via ZeroBuild AI', settings);

  const workflowYml = `name: Build APK
on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Install dependencies
        run: npm install

      - name: Generate native Android project
        run: npx expo prebuild --platform android --no-install

      - name: Make gradlew executable
        run: chmod +x android/gradlew

      - name: Build debug APK
        working-directory: android
        run: ./gradlew assembleDebug

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          retention-days: 30
`;

  const workflowContent = toBase64(workflowYml);
  await createOrUpdateFile(slug, '.github/workflows/build.yml', workflowContent, 'Add GitHub Actions build workflow via ZeroBuild AI', settings);
}

async function createOrUpdateFile(
  repo: string,
  path: string,
  content: string,
  message: string,
  settings: AppSettings,
): Promise<void> {
  let sha: string | undefined;

  try {
    const getResponse = await fetch(
      `${GITHUB_API}/repos/${settings.githubUsername}/${repo}/contents/${path}`,
      { headers: authHeaders(settings.githubToken) },
    );
    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
    }
  } catch {}

  const body: Record<string, string> = { message, content };
  if (sha) body.sha = sha;

  const response = await fetch(
    `${GITHUB_API}/repos/${settings.githubUsername}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: authHeaders(settings.githubToken),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    const msg = error.message || '';
    if (msg.includes('Resource not accessible') || response.status === 403) {
      throw new Error(
        `Can't push to "${path}". Your token needs "Read and Write" permission for Contents. ` +
        'Edit your token on GitHub and add this permission, or create a Classic token with "repo" scope.'
      );
    }
    throw new Error(`Failed to push ${path}: ${msg}`);
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
