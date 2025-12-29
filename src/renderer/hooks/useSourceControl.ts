import type { FileChangesResult } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toastManager } from '@/components/ui/toast';

const emptyResult: FileChangesResult = { changes: [] };

export function useFileChanges(workdir: string | null, isActive = true) {
  return useQuery({
    queryKey: ['git', 'file-changes', workdir],
    queryFn: async () => {
      if (!workdir) return emptyResult;
      return window.electronAPI.git.getFileChanges(workdir);
    },
    enabled: !!workdir,
    refetchInterval: isActive ? 5000 : false, // Only poll when tab is active
    refetchIntervalInBackground: false, // Only poll when window is focused
    staleTime: 2000, // Avoid redundant requests within 2s
  });
}

export function useFileDiff(
  workdir: string | null,
  path: string | null,
  staged: boolean,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['git', 'file-diff', workdir, path, staged],
    queryFn: async () => {
      if (!workdir || !path) return null;
      return window.electronAPI.git.getFileDiff(workdir, path, staged);
    },
    enabled: (options?.enabled ?? true) && !!workdir && !!path,
  });
}

export function useGitStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workdir, paths }: { workdir: string; paths: string[] }) => {
      await window.electronAPI.git.stage(workdir, paths);
    },
    onSuccess: async (_, { workdir }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['git', 'file-changes', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'file-diff', workdir] }),
      ]);
    },
    onError: (error) => {
      toastManager.add({
        title: 'Stage failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
        timeout: 5000,
      });
    },
  });
}

export function useGitUnstage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workdir, paths }: { workdir: string; paths: string[] }) => {
      await window.electronAPI.git.unstage(workdir, paths);
    },
    onSuccess: async (_, { workdir }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['git', 'file-changes', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'file-diff', workdir] }),
      ]);
    },
    onError: (error) => {
      toastManager.add({
        title: 'Unstage failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
        timeout: 5000,
      });
    },
  });
}

export function useGitDiscard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workdir, path }: { workdir: string; path: string }) => {
      await window.electronAPI.git.discard(workdir, path);
    },
    onSuccess: async (_, { workdir }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['git', 'file-changes', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'file-diff', workdir] }),
      ]);
    },
    onError: (error) => {
      toastManager.add({
        title: 'Discard failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
        timeout: 5000,
      });
    },
  });
}

export function useGitCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workdir, message }: { workdir: string; message: string }) => {
      return window.electronAPI.git.commit(workdir, message);
    },
    onSuccess: async (_, { workdir }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['git', 'file-changes', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'log', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'log-infinite', workdir] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'file-diff', workdir] }),
      ]);
    },
    onError: (error) => {
      toastManager.add({
        title: 'Commit failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
        timeout: 5000,
      });
    },
  });
}
