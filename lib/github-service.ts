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

function buildPackageJson(appName: string): string {
  return JSON.stringify({
    name: appName,
    version: "1.0.0",
    main: "node_modules/expo/AppEntry.js",
    scripts: {
      start: "expo start",
      android: "expo start --android",
      ios: "expo start --ios",
      web: "expo start --web"
    },
    dependencies: {
      "expo": "~52.0.0",
      "expo-status-bar": "~2.0.1",
      "react": "18.3.1",
      "react-native": "0.76.9"
    },
    devDependencies: {
      "@babel/core": "^7.25.2"
    },
    private: true
  }, null, 2);
}

function buildAppJson(appName: string, slug: string, expoUsername: string): string {
  const config: any = {
    expo: {
      name: appName,
      slug: slug,
      version: "1.0.0",
      orientation: "portrait",
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      splash: {
        backgroundColor: "#0f172a"
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: `com.zerobuild.${slug.replace(/-/g, '')}`
      },
      android: {
        adaptiveIcon: {
          backgroundColor: "#0f172a"
        },
        package: `com.zerobuild.${slug.replace(/-/g, '')}`
      },
      web: {
        bundler: "metro"
      }
    }
  };

  if (expoUsername) {
    config.expo.owner = expoUsername;
  }

  return JSON.stringify(config, null, 2);
}

function buildEasJson(): string {
  return JSON.stringify({
    cli: {
      version: ">= 15.0.0"
    },
    build: {
      development: {
        developmentClient: true,
        distribution: "internal"
      },
      preview: {
        distribution: "internal",
        android: {
          buildType: "apk"
        }
      },
      production: {
        autoIncrement: true
      }
    },
    submit: {
      production: {}
    }
  }, null, 2);
}

function buildBabelConfig(): string {
  return `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
`;
}

function buildGitignore(): string {
  return `node_modules/
.expo/
dist/
npm-debug.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
`;
}

function buildEasBuildWorkflow(): string {
  const lines = [
    'name: EAS Build',
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
    '      - name: Setup Expo and EAS',
    '        uses: expo/expo-github-action@v8',
    '        with:',
    '          eas-version: latest',
    '          token: ${{ secrets.EXPO_TOKEN }}',
    '',
    '      - name: Install dependencies',
    '        run: npm install',
    '',
    '      - name: Build APK (preview)',
    '        run: eas build --platform android --profile preview --non-interactive --no-wait',
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

  const expoUsername = settings.expoUsername || '';

  const files: { path: string; content: string }[] = [
    { path: 'App.js', content: code },
    { path: 'package.json', content: buildPackageJson(appName) },
    { path: 'app.json', content: buildAppJson(repoName, slug, expoUsername) },
    { path: 'eas.json', content: buildEasJson() },
    { path: 'babel.config.js', content: buildBabelConfig() },
    { path: '.gitignore', content: buildGitignore() },
    { path: '.github/workflows/eas-build.yml', content: buildEasBuildWorkflow() },
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
      message: 'Push Expo app code via ZeroBuild AI',
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

export function getEasBuildUrl(username: string, repoName: string): string {
  const slug = getSlug(repoName);
  return `https://expo.dev/accounts/${username}/projects/${slug}/builds`;
}

export function getRepoUrl(username: string, repoName: string): string {
  const slug = getSlug(repoName);
  return `https://github.com/${username}/${slug}`;
}
