export type AppSettings = {
  editorCommand: string;
  openBackendUrlOnWorkMode: boolean;
  openFrontendUrlOnWorkMode: boolean;
  confirmRiskyCommands: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  editorCommand: 'code',
  openBackendUrlOnWorkMode: true,
  openFrontendUrlOnWorkMode: true,
  confirmRiskyCommands: true,
};
