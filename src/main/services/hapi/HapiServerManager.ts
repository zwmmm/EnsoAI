import type { ChildProcess } from 'node:child_process';
import { exec, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface HapiConfig {
  webappPort: number;
  cliApiToken: string;
  telegramBotToken: string;
  webappUrl: string;
  allowedChatIds: string;
}

export interface HapiGlobalStatus {
  installed: boolean;
  version?: string;
}

export interface HapiStatus {
  running: boolean;
  ready?: boolean;
  pid?: number;
  port?: number;
  error?: string;
}

const isWindows = process.platform === 'win32';

/**
 * Find user's default shell
 */
function findUserShell(): string {
  const userShell = process.env.SHELL;
  if (userShell && existsSync(userShell)) {
    return userShell;
  }
  const shells = ['/bin/zsh', '/bin/bash', '/bin/sh'];
  for (const shell of shells) {
    if (existsSync(shell)) {
      return shell;
    }
  }
  return '/bin/sh';
}

class HapiServerManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private status: HapiStatus = { running: false };
  private ready: boolean = false;

  // Global installation cache
  private globalStatus: HapiGlobalStatus | null = null;
  private globalCacheTimestamp: number = 0;
  private readonly CACHE_TTL = 300000; // 5 minutes cache

  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Execute command in login shell to load user's environment
   */
  private async execInLoginShell(command: string, timeout = 5000): Promise<string> {
    if (isWindows) {
      const { stdout } = await execAsync(command, { timeout });
      return stdout;
    }

    const shell = findUserShell();
    const escapedCommand = command.replace(/"/g, '\\"');

    try {
      const { stdout } = await execAsync(`${shell} -ilc "${escapedCommand}"`, { timeout });
      return stdout;
    } catch {
      const { stdout } = await execAsync(`${shell} -lc "${escapedCommand}"`, { timeout });
      return stdout;
    }
  }

  /**
   * Check if hapi is globally installed (cached)
   */
  async checkGlobalInstall(forceRefresh = false): Promise<HapiGlobalStatus> {
    // Return cached result if still valid
    if (
      !forceRefresh &&
      this.globalStatus &&
      Date.now() - this.globalCacheTimestamp < this.CACHE_TTL
    ) {
      return this.globalStatus;
    }

    try {
      const stdout = await this.execInLoginShell('hapi --version', 3000);
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      this.globalStatus = {
        installed: true,
        version: match ? match[1] : undefined,
      };
    } catch {
      this.globalStatus = { installed: false };
    }

    this.globalCacheTimestamp = Date.now();
    return this.globalStatus;
  }

  /**
   * Get the hapi command to use (global 'hapi' or 'npx -y @twsxtd/hapi')
   */
  async getHapiCommand(): Promise<string> {
    const status = await this.checkGlobalInstall();
    return status.installed ? 'hapi' : 'npx -y @twsxtd/hapi';
  }

  async start(config: HapiConfig): Promise<HapiStatus> {
    if (this.process) {
      return this.status;
    }

    const env: Record<string, string> = {
      ...process.env,
      WEBAPP_PORT: String(config.webappPort),
    } as Record<string, string>;

    if (config.cliApiToken) {
      env.CLI_API_TOKEN = config.cliApiToken;
    }
    if (config.telegramBotToken) {
      env.TELEGRAM_BOT_TOKEN = config.telegramBotToken;
    }
    if (config.webappUrl) {
      env.WEBAPP_URL = config.webappUrl;
    }
    if (config.allowedChatIds) {
      env.ALLOWED_CHAT_IDS = config.allowedChatIds;
    }

    try {
      // Check if hapi is globally installed
      const hapiCommand = await this.getHapiCommand();
      const isGlobal = hapiCommand === 'hapi';
      const spawnCommand = isGlobal ? 'hapi' : 'npx';
      const spawnArgs = isGlobal ? ['server'] : ['-y', '@twsxtd/hapi', 'server'];

      this.process = spawn(spawnCommand, spawnArgs, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        detached: process.platform !== 'win32',
      });

      this.ready = false;
      this.status = {
        running: true,
        pid: this.process.pid,
        port: config.webappPort,
      };

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('[hapi]', output);
        // Detect when server is ready (listening message)
        if (!this.ready && /listening|started|ready/i.test(output)) {
          console.log('[hapi] Server ready detected!');
          this.ready = true;
          this.status = { ...this.status, ready: true };
          this.emit('statusChanged', this.status);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.error('[hapi]', output);
        // Also detect ready message from stderr
        if (!this.ready && /listening|started|ready/i.test(output)) {
          console.log('[hapi] Server ready detected (stderr)!');
          this.ready = true;
          this.status = { ...this.status, ready: true };
          this.emit('statusChanged', this.status);
        }
      });

      this.process.on('error', (error) => {
        console.error('[hapi] Process error:', error);
        this.ready = false;
        this.status = { running: false, error: error.message };
        this.process = null;
        this.emit('statusChanged', this.status);
      });

      this.process.on('exit', (code, signal) => {
        console.log(`[hapi] Process exited with code ${code}, signal ${signal}`);
        this.ready = false;
        this.status = { running: false };
        this.process = null;
        this.emit('statusChanged', this.status);
      });

      this.emit('statusChanged', this.status);
      return this.status;
    } catch (error) {
      this.status = {
        running: false,
        error: error instanceof Error ? error.message : String(error),
      };
      this.emit('statusChanged', this.status);
      return this.status;
    }
  }

  async stop(): Promise<HapiStatus> {
    if (!this.process) {
      return this.status;
    }

    return new Promise((resolve) => {
      const proc = this.process!;
      const pid = proc.pid;

      const timeout = setTimeout(() => {
        this.killProcessTree(pid, 'SIGKILL');
      }, 5000);

      proc.once('exit', () => {
        clearTimeout(timeout);
        this.process = null;
        this.status = { running: false };
        this.emit('statusChanged', this.status);
        resolve(this.status);
      });

      this.killProcessTree(pid, 'SIGTERM');
    });
  }

  private killProcessTree(pid: number | undefined, signal: NodeJS.Signals): void {
    if (!pid) return;

    try {
      if (process.platform !== 'win32') {
        // Kill the entire process group on Unix
        process.kill(-pid, signal);
      } else {
        // On Windows, use taskkill to kill the process tree
        spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
      }
    } catch {
      // Process may have already exited
    }
  }

  async restart(config: HapiConfig): Promise<HapiStatus> {
    await this.stop();
    return this.start(config);
  }

  getStatus(): HapiStatus {
    return this.status;
  }

  cleanup(): void {
    if (this.process) {
      this.killProcessTree(this.process.pid, 'SIGKILL');
      this.process = null;
    }
  }
}

export const hapiServerManager = new HapiServerManager();
