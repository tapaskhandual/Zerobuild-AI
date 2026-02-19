export type ProjectStatus = 'drafting' | 'generating' | 'generated' | 'pushing' | 'building' | 'ready' | 'error';

export interface Project {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: ProjectStatus;
  generatedCode: string;
  githubRepo: string;
  apkUrl: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface AppSettings {
  githubToken: string;
  githubUsername: string;
  llmProvider: 'huggingface' | 'groq';
  llmApiKey: string;
}
