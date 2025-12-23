export enum AppCategory {
  Terminal = 'terminal',
  Editor = 'editor',
  Finder = 'finder',
}

export interface DetectedApp {
  name: string;
  bundleId: string;
  category: AppCategory;
  path: string;
  icon?: string; // base64 encoded icon
}
