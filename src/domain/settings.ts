export type AppSettings = {
  editorCommand: string;
  openBackendUrlOnWorkMode: boolean;
  openFrontendUrlOnWorkMode: boolean;
  confirmRiskyCommands: boolean;
  ai: AiSettings;
};

export type AiSettings = {
  enabled: boolean;
  provider: 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  apiKeyMasked?: string;
  apiKeyInput?: string;
  includeSourceSnippets: boolean;
  storageWarning?: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  editorCommand: 'code',
  openBackendUrlOnWorkMode: true,
  openFrontendUrlOnWorkMode: true,
  confirmRiskyCommands: true,
  ai: {
    enabled: false,
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKeyConfigured: false,
    includeSourceSnippets: false,
  },
};
