import { stat } from 'node:fs/promises';

/**
 * Validate a local path for use as a repository.
 */
export async function validateLocalPath(inputPath: string): Promise<{
  exists: boolean;
  isDirectory: boolean;
}> {
  try {
    const stats = await stat(inputPath);
    return { exists: true, isDirectory: stats.isDirectory() };
  } catch {
    return { exists: false, isDirectory: false };
  }
}
