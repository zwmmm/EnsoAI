import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

/**
 * Validate a local path for use as a repository.
 * Security: Only allows paths under user's home directory to prevent arbitrary path probing.
 */
export function validateLocalPath(inputPath: string): {
  exists: boolean;
  isDirectory: boolean;
} {
  // Normalize path to prevent traversal attacks (../)
  const normalizedPath = resolve(inputPath);
  const home = homedir();
  const sep = process.platform === 'win32' ? '\\' : '/';

  // Security: Only allow paths under user's home directory
  if (!normalizedPath.startsWith(home + sep) && normalizedPath !== home) {
    return { exists: false, isDirectory: false };
  }

  if (!existsSync(normalizedPath)) {
    return { exists: false, isDirectory: false };
  }

  try {
    const stats = statSync(normalizedPath);
    return { exists: true, isDirectory: stats.isDirectory() };
  } catch {
    return { exists: false, isDirectory: false };
  }
}
