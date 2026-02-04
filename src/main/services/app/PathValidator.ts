import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { relative, resolve } from 'node:path';

/**
 * Validate a local path for use as a repository.
 * Security:
 * - Only allows paths under user's home directory to prevent arbitrary path probing
 * - Resolves symlinks to prevent symlink attacks bypassing directory restrictions
 */
export async function validateLocalPath(inputPath: string): Promise<{
  exists: boolean;
  isDirectory: boolean;
}> {
  try {
    // Normalize path to prevent traversal attacks (../)
    const normalizedPath = resolve(inputPath);

    // Resolve symlinks to get the real paths (handles symlinked home directories)
    const [realPath, realHome] = await Promise.all([realpath(normalizedPath), realpath(homedir())]);

    // Security: Only allow paths under user's home directory
    // Using relative() to correctly handle paths - if relative path starts with '..' it's outside home
    const relativePath = relative(realHome, realPath);
    if (relativePath.startsWith('..')) {
      console.warn('[PathValidator] Path validation failed: outside home directory');
      return { exists: false, isDirectory: false };
    }

    const stats = await stat(realPath);
    return { exists: true, isDirectory: stats.isDirectory() };
  } catch (err) {
    // ENOENT: path does not exist, EACCES: permission denied
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.warn(`[PathValidator] Path validation error: ${code || 'unknown'}`);
    }
    return { exists: false, isDirectory: false };
  }
}
