import { is } from '@electron-toolkit/utils';
import type { BrowserWindow } from 'electron';
import electronUpdater, { type UpdateInfo } from 'electron-updater';

const { autoUpdater } = electronUpdater;

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: UpdateInfo;
  progress?: {
    percent: number;
    bytesPerSecond: number;
    total: number;
    transferred: number;
  };
  error?: string;
}

class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private updateDownloaded = false;

  init(window: BrowserWindow): void {
    this.mainWindow = window;

    // Configure auto-updater
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // Enable logging in dev mode
    if (is.dev) {
      autoUpdater.logger = console;
    }

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.sendStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.sendStatus({ status: 'available', info });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.sendStatus({ status: 'not-available', info });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.sendStatus({
        status: 'downloading',
        progress: {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          total: progress.total,
          transferred: progress.transferred,
        },
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.updateDownloaded = true;
      this.sendStatus({ status: 'downloaded', info });
    });

    autoUpdater.on('error', (error) => {
      this.sendStatus({ status: 'error', error: error.message });
    });

    // Check for updates after a short delay
    setTimeout(() => {
      this.checkForUpdates();
    }, 3000);
  }

  private sendStatus(status: UpdateStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', status);
    }
  }

  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  quitAndInstall(): void {
    if (this.updateDownloaded) {
      autoUpdater.quitAndInstall();
    }
  }

  isUpdateDownloaded(): boolean {
    return this.updateDownloaded;
  }

  setAllowPrerelease(allow: boolean): void {
    autoUpdater.allowPrerelease = allow;
  }
}

export const autoUpdaterService = new AutoUpdaterService();
