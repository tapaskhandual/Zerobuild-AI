export type ProjectStatus = 'drafting' | 'generating' | 'generated' | 'pushing' | 'building' | 'ready' | 'error';

export interface RefinementMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

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
  refinements?: RefinementMessage[];
}

export interface AppSettings {
  githubToken: string;
  githubUsername: string;
  expoUsername: string;
  expoToken: string;
  llmProvider: 'gemini' | 'groq' | 'huggingface';
  llmApiKey: string;
  geminiApiKey: string;
  groqApiKey: string;
  huggingfaceApiKey: string;
}
