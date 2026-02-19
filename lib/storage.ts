import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, AppSettings } from './types';

const PROJECTS_KEY = '@zerobuild_projects';
const SETTINGS_KEY = '@zerobuild_settings';

export async function getProjects(): Promise<Project[]> {
  const data = await AsyncStorage.getItem(PROJECTS_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export async function saveProject(project: Project): Promise<void> {
  const projects = await getProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export async function deleteProject(id: string): Promise<void> {
  const projects = await getProjects();
  const filtered = projects.filter(p => p.id !== id);
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
}

export async function getSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!data) {
    return {
      githubToken: '',
      githubUsername: '',
      llmProvider: 'gemini',
      llmApiKey: '',
      geminiApiKey: '',
      groqApiKey: '',
      huggingfaceApiKey: '',
    };
  }
  return JSON.parse(data);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
