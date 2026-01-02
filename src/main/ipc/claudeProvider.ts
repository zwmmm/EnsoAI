import type { ClaudeProvider } from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  applyProvider,
  extractProviderFromSettings,
  readClaudeSettings,
} from '../services/claude/ClaudeProviderManager';

export function registerClaudeProviderHandlers(): void {
  // 读取当前 Claude settings
  ipcMain.handle(IPC_CHANNELS.CLAUDE_PROVIDER_READ_SETTINGS, () => {
    const settings = readClaudeSettings();
    const extracted = extractProviderFromSettings();
    return { settings, extracted };
  });

  // 应用 Provider 配置
  ipcMain.handle(IPC_CHANNELS.CLAUDE_PROVIDER_APPLY, (_, provider: ClaudeProvider) => {
    return applyProvider(provider);
  });
}
