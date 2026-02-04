import { lstat } from 'node:fs/promises';

/**
 * Validate a local path for use as a repository.
 *
 * Security note: This is a local Electron desktop app where the user already has
 * full filesystem access. Path restriction (e.g., home directory only) is unnecessary
 * since users can access any path via terminal anyway. This differs from web services
 * where path probing attacks are a real concern.
 */
export async function validateLocalPath(inputPath: string): Promise<{
  exists: boolean;
  isDirectory: boolean;
}> {
  try {
    const stats = await lstat(inputPath);
    return { exists: true, isDirectory: stats.isDirectory() };
  } catch {
    return { exists: false, isDirectory: false };
  }
}
