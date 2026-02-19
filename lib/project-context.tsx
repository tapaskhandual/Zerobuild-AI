import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Project, AppSettings } from './types';
import * as store from './storage';

interface ProjectContextValue {
  projects: Project[];
  settings: AppSettings;
  isLoading: boolean;
  refreshProjects: () => Promise<void>;
  addProject: (project: Project) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    githubToken: '',
    githubUsername: '',
    llmProvider: 'gemini',
    llmApiKey: '',
    geminiApiKey: '',
    groqApiKey: '',
    huggingfaceApiKey: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([store.getProjects(), store.getSettings()]);
      setProjects(p);
      setSettings(s);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshProjects = useCallback(async () => {
    const p = await store.getProjects();
    setProjects(p);
  }, []);

  const addProject = useCallback(async (project: Project) => {
    await store.saveProject(project);
    setProjects(prev => [project, ...prev]);
  }, []);

  const updateProject = useCallback(async (project: Project) => {
    await store.saveProject(project);
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));
  }, []);

  const removeProject = useCallback(async (id: string) => {
    await store.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateSettings = useCallback(async (newSettings: AppSettings) => {
    await store.saveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  const value = useMemo(() => ({
    projects,
    settings,
    isLoading,
    refreshProjects,
    addProject,
    updateProject,
    removeProject,
    updateSettings,
  }), [projects, settings, isLoading, refreshProjects, addProject, updateProject, removeProject, updateSettings]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProjects must be used within ProjectProvider');
  return context;
}
