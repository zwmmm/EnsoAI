import type { AIProvider, ModelId, ReasoningEffort } from '@shared/types';
import { parseCLIOutput, spawnCLI } from './providers';

export interface BranchNameOptions {
  workdir: string;
  prompt: string;
  provider: AIProvider;
  model: ModelId;
  reasoningEffort?: ReasoningEffort;
  timeout?: number;
}

export interface BranchNameResult {
  success: boolean;
  branchName?: string;
  error?: string;
}

export async function generateBranchName(options: BranchNameOptions): Promise<BranchNameResult> {
  const { workdir, prompt, provider, model, reasoningEffort, timeout = 120 } = options;

  return new Promise((resolve) => {
    const timeoutMs = timeout * 1000;

    console.log(`[branch-name] Starting with provider=${provider}, model=${model}, cwd=${workdir}`);

    const { proc, kill } = spawnCLI({
      provider,
      model,
      prompt,
      cwd: workdir,
      reasoningEffort,
      outputFormat: 'json',
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      kill();
      resolve({ success: false, error: 'timeout' });
    }, timeoutMs);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        console.error(`[branch-name] Exit code: ${code}, stderr: ${stderr}`);
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
        return;
      }

      const result = parseCLIOutput(provider, stdout);
      console.log(`[branch-name] Parse result:`, result);

      if (result.success && result.text) {
        resolve({ success: true, branchName: result.text.trim() });
      } else {
        resolve({ success: false, error: result.error || 'Unknown error' });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      console.error(`[branch-name] Process error:`, err);
      resolve({ success: false, error: err.message });
    });
  });
}
