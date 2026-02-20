import { AppSettings } from './types';

const GITHUB_API = 'https://api.github.com';
const EXPO_API = 'https://api.expo.dev/graphql';

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

async function expoGraphql(token: string, query: string, variables: Record<string, any> = {}): Promise<any> {
  const res = await fetch(EXPO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Expo API error: ${res.status}`);
  }
  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message || 'Expo API error');
  }
  return json.data;
}

async function getExpoAccountId(token: string, owner: string): Promise<string> {
  const data = await expoGraphql(token, `
    query CurrentUser {
      meActor {
        __typename
        id
        accounts {
          id
          name
        }
      }
    }
  `);
  const accounts = data?.meActor?.accounts;
  if (!accounts || accounts.length === 0) {
    throw new Error('No Expo account found. Please check your Expo token.');
  }
  const match = accounts.find((a: any) => a.name === owner);
  if (match) {
    return match.id;
  }
  if (accounts.length === 1) {
    return accounts[0].id;
  }
  throw new Error(`Could not find Expo account matching "${owner}". Available accounts: ${accounts.map((a: any) => a.name).join(', ')}`);
}

async function findExpoProject(token: string, owner: string, slug: string): Promise<string | null> {
  try {
    const data = await expoGraphql(token, `
      query AppByFullName($fullName: String!) {
        app {
          byFullName(fullName: $fullName) {
            id
          }
        }
      }
    `, { fullName: `@${owner}/${slug}` });
    return data?.app?.byFullName?.id || null;
  } catch {
    return null;
  }
}

async function createExpoProject(token: string, accountId: string, slug: string): Promise<string> {
  const data = await expoGraphql(token, `
    mutation CreateApp($appInput: AppInput!) {
      app {
        createApp(appInput: $appInput) {
          id
        }
      }
    }
  `, { appInput: { accountId, projectName: slug } });
  const id = data?.app?.createApp?.id;
  if (!id) {
    throw new Error('Failed to create Expo project');
  }
  return id;
}

export async function getOrCreateExpoProjectId(settings: AppSettings, slug: string): Promise<string> {
  const token = settings.expoToken;
  const owner = settings.expoUsername;

  if (!token) {
    throw new Error('Expo token is required. Please add it in Settings.');
  }
  if (!owner) {
    throw new Error('Expo username is required. Please add it in Settings.');
  }

  const existingId = await findExpoProject(token, owner, slug);
  if (existingId) {
    return existingId;
  }

  const accountId = await getExpoAccountId(token, owner);
  return createExpoProject(token, accountId, slug);
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const OPTIONAL_DEPS: Record<string, string> = {
  "expo-location": "~19.0.8",
  "expo-haptics": "~15.0.8",
  "expo-linear-gradient": "~15.0.8",
  "react-native-maps": "1.20.1",
  "@react-native-async-storage/async-storage": "2.2.0",
};

function extractModuleSpecifiers(code: string): Set<string> {
  const modules = new Set<string>();
  const importFrom = /(?:import\s+(?:[\w*{},\s]+)\s+from|import)\s+['"]([^'"]+)['"]/g;
  const requireCall = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = importFrom.exec(code)) !== null) modules.add(m[1]);
  while ((m = requireCall.exec(code)) !== null) modules.add(m[1]);
  return modules;
}

function buildPackageJson(appName: string, code: string): string {
  const deps: Record<string, string> = {
    "expo": "~54.0.33",
    "expo-status-bar": "~3.0.9",
    "react": "19.1.0",
    "react-native": "0.81.5",
  };

  const usedModules = extractModuleSpecifiers(code);
  for (const [pkg, version] of Object.entries(OPTIONAL_DEPS)) {
    if (usedModules.has(pkg)) {
      deps[pkg] = version;
    }
  }

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
    dependencies: deps,
    devDependencies: {
      "@babel/core": "^7.25.2"
    },
    private: true
  }, null, 2);
}

function buildAppJson(appName: string, slug: string, expoUsername: string, projectId?: string): string {
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
        package: `com.zerobuild.${slug.replace(/-/g, '')}`,
        config: {
          googleMaps: {
            apiKey: ""
          }
        }
      },
      web: {
        bundler: "metro"
      }
    }
  };

  if (expoUsername) {
    config.expo.owner = expoUsername;
  }

  if (projectId) {
    config.expo.extra = {
      eas: {
        projectId: projectId
      }
    };
  }

  return JSON.stringify(config, null, 2);
}

function buildEasJson(): string {
  return JSON.stringify({
    cli: {
      version: ">= 15.0.0",
      appVersionSource: "local"
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

function buildMetroConfig(): string {
  return `const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
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

  let projectId: string | undefined;
  if (settings.expoToken && expoUsername) {
    projectId = await getOrCreateExpoProjectId(settings, slug);
  }

  const files: { path: string; content: string }[] = [
    { path: 'App.js', content: code },
    { path: 'package.json', content: buildPackageJson(appName, code) },
    { path: 'app.json', content: buildAppJson(repoName, slug, expoUsername, projectId) },
    { path: 'eas.json', content: buildEasJson() },
    { path: 'babel.config.js', content: buildBabelConfig() },
    { path: 'metro.config.js', content: buildMetroConfig() },
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
