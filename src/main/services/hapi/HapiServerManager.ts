import type { ChildProcess } from 'node:child_process';
import { exec, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { promisify } from 'node:util';
import { getEnvForCommand, getShellForCommand } from '../../utils/shell';

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

export interface HappyGlobalStatus {
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

class HapiServerManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private status: HapiStatus = { running: false };
  private ready: boolean = false;

  // Global installation cache
  private globalStatus: HapiGlobalStatus | null = null;
  private globalCacheTimestamp: number = 0;
  private readonly CACHE_TTL = 300000; // 5 minutes cache

  // Happy global installation cache
  private happyGlobalStatus: HappyGlobalStatus | null = null;
  private happyGlobalCacheTimestamp: number = 0;

  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Execute command in login shell to load user's environment.
   * Uses user's configured shell from settings.
   */
  private async execInLoginShell(command: string, timeout = 5000): Promise<string> {
    const escapedCommand = command.replace(/"/g, '\\"');
    const { shell, args } = getShellForCommand();
    const fullCommand = `"${shell}" ${args.map((a) => `"${a}"`).join(' ')} "${escapedCommand}"`;
    const { stdout } = await execAsync(fullCommand, {
      timeout,
      env: getEnvForCommand(),
    });
    return stdout;
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
      // Increase timeout to 30000ms - PowerShell profile loading can be slow on first run
      const stdout = await this.execInLoginShell('hapi --version', 30000);
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      this.globalStatus = {
        installed: true,
        version: match ? match[1] : undefined,
      };
    } catch (error: unknown) {
      // PowerShell profile may have non-fatal errors (e.g., Set-PSReadLineOption in non-TTY)
      // Check if stdout contains version info despite the error
      const execError = error as { stdout?: string };
      if (execError.stdout) {
        const match = execError.stdout.match(/(\d+\.\d+\.\d+)/);
        if (match) {
          this.globalStatus = {
            installed: true,
            version: match[1],
          };
          this.globalCacheTimestamp = Date.now();
          return this.globalStatus;
        }
      }
      this.globalStatus = { installed: false };
      // Don't cache failed result - allow immediate retry
      return this.globalStatus;
    }

    this.globalCacheTimestamp = Date.now();
    return this.globalStatus;
  }

  /**
   * Check if happy is globally installed (cached)
   * Uses npm to check if happy-coder package is installed globally.
   * This is more reliable than running 'happy --version' which may start child processes.
   */
  async checkHappyGlobalInstall(forceRefresh = false): Promise<HappyGlobalStatus> {
    // Return cached result if still valid
    if (
      !forceRefresh &&
      this.happyGlobalStatus &&
      Date.now() - this.happyGlobalCacheTimestamp < this.CACHE_TTL
    ) {
      return this.happyGlobalStatus;
    }

    try {
      // Use npm list to check if happy-coder is installed globally
      // This is more reliable than running 'happy --version' which may hang
      // Run npm directly with enhanced PATH to ensure it's found
      const { stdout } = await execAsync('npm list -g happy-coder --depth=0 --json', {
        timeout: 15000,
        env: getEnvForCommand(),
      });

      // Parse npm output to get version
      // Format: {"dependencies":{"happy-coder":{"version":"0.13.0",...}}}
      const npmOutput = JSON.parse(stdout);
      const happyInfo = npmOutput?.dependencies?.['happy-coder'];

      if (happyInfo) {
        this.happyGlobalStatus = {
          installed: true,
          version: happyInfo.version,
        };
      } else {
        this.happyGlobalStatus = { installed: false };
      }
    } catch (error: unknown) {
      // npm list returns exit code 1 if package not found, check stdout anyway
      const execError = error as { stdout?: string };
      if (execError.stdout) {
        try {
          const npmOutput = JSON.parse(execError.stdout);
          const happyInfo = npmOutput?.dependencies?.['happy-coder'];
          if (happyInfo) {
            this.happyGlobalStatus = {
              installed: true,
              version: happyInfo.version,
            };
            this.happyGlobalCacheTimestamp = Date.now();
            return this.happyGlobalStatus;
          }
        } catch {
          // JSON parse failed
        }
      }
      this.happyGlobalStatus = { installed: false };
      // Don't cache failed result - allow immediate retry
      return this.happyGlobalStatus;
    }

    this.happyGlobalCacheTimestamp = Date.now();
    return this.happyGlobalStatus;
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
      WEBAPP_PORT: String(config.webappPort),
    };

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

      // Use user's configured shell to ensure proper environment (nvm, etc.)
      const { shell, args: shellArgs } = getShellForCommand();
      const command = isGlobal ? 'hapi server' : 'npx -y @twsxtd/hapi server';

      this.process = spawn(shell, [...shellArgs, command], {
        env: getEnvForCommand(env),
        stdio: ['ignore', 'pipe', 'pipe'],
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
        // On Windows, use taskkill synchronously to ensure process is killed
        spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
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
