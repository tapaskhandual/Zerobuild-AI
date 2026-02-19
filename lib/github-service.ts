import { AppSettings } from './types';

const GITHUB_API = 'https://api.github.com';

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
}

export async function createRepo(name: string, description: string, settings: AppSettings): Promise<GitHubRepo> {
  const response = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${settings.githubToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description,
      auto_init: true,
      private: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create repository');
  }

  return response.json();
}

export async function pushCode(
  repoName: string,
  code: string,
  settings: AppSettings,
): Promise<void> {
  const slug = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const appJsContent = Buffer.from
    ? btoa(unescape(encodeURIComponent(code)))
    : btoa(code);

  await createOrUpdateFile(
    slug,
    'App.js',
    appJsContent,
    'Add generated app code via ZeroBuild AI',
    settings,
  );

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

  const pkgContent = btoa(unescape(encodeURIComponent(JSON.stringify(packageJson, null, 2))));
  await createOrUpdateFile(
    slug,
    'package.json',
    pkgContent,
    'Add package.json via ZeroBuild AI',
    settings,
  );

  const appJson = {
    expo: {
      name: repoName,
      slug: slug,
      version: '1.0.0',
      orientation: 'portrait',
      android: {
        package: `com.zerobuild.${slug.replace(/-/g, '')}`,
      },
    },
  };

  const appJsonContent = btoa(unescape(encodeURIComponent(JSON.stringify(appJson, null, 2))));
  await createOrUpdateFile(
    slug,
    'app.json',
    appJsonContent,
    'Add app.json via ZeroBuild AI',
    settings,
  );

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

      - name: Install dependencies
        run: npm install

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          token: \${{ secrets.EXPO_TOKEN }}

      - name: Build APK
        run: npx expo export --platform android

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-build
          path: dist/
          retention-days: 30
`;

  const workflowContent = btoa(unescape(encodeURIComponent(workflowYml)));
  await createOrUpdateFile(
    slug,
    '.github/workflows/build.yml',
    workflowContent,
    'Add GitHub Actions build workflow via ZeroBuild AI',
    settings,
  );
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
      {
        headers: {
          'Authorization': `token ${settings.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      },
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
      headers: {
        'Authorization': `token ${settings.githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to push ${path}: ${error.message}`);
  }
}

export function getApkDownloadUrl(username: string, repoName: string): string {
  const slug = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `https://github.com/${username}/${slug}/actions`;
}

export function getRepoUrl(username: string, repoName: string): string {
  const slug = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `https://github.com/${username}/${slug}`;
}
