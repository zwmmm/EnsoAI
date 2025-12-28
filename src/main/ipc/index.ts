import { disposeClaudeIdeBridge } from '../services/claude/ClaudeIdeBridge';
import { registerAgentHandlers, stopAllAgentSessions } from './agent';
import { registerAppHandlers } from './app';
import { registerCliHandlers } from './cli';
import { registerDialogHandlers } from './dialog';
import { registerFileHandlers, stopAllFileWatchers } from './files';
import { clearAllGitServices, registerGitHandlers } from './git';
import { registerNotificationHandlers } from './notification';
import { registerSettingsHandlers } from './settings';
import { registerShellHandlers } from './shell';
import { destroyAllTerminals, registerTerminalHandlers } from './terminal';
import { registerUpdaterHandlers } from './updater';
import { clearAllWorktreeServices, registerWorktreeHandlers } from './worktree';

export function registerIpcHandlers(): void {
  registerGitHandlers();
  registerWorktreeHandlers();
  registerFileHandlers();
  registerTerminalHandlers();
  registerAgentHandlers();
  registerDialogHandlers();
  registerAppHandlers();
  registerCliHandlers();
  registerShellHandlers();
  registerSettingsHandlers();
  registerNotificationHandlers();
  registerUpdaterHandlers();
}

export async function cleanupAllResources(): Promise<void> {
  // Stop all running processes first (sync, fast)
  destroyAllTerminals();
  stopAllAgentSessions();

  // Stop file watchers with timeout to prevent hanging
  const CLEANUP_TIMEOUT = 3000;
  try {
    await Promise.race([
      stopAllFileWatchers(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('File watcher cleanup timeout')), CLEANUP_TIMEOUT)
      ),
    ]);
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }

  // Clear service caches (sync, fast)
  clearAllGitServices();
  clearAllWorktreeServices();

  // Dispose Claude IDE Bridge
  disposeClaudeIdeBridge();
}
