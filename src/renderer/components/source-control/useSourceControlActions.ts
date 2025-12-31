import { useCallback, useState } from 'react';
import { toastManager } from '@/components/ui/toast';
import { useGitCommit, useGitDiscard, useGitStage, useGitUnstage } from '@/hooks/useSourceControl';
import { useI18n } from '@/i18n';
import { useSourceControlStore } from '@/stores/sourceControl';

export interface ConfirmAction {
  paths: string[];
  type: 'discard' | 'delete';
}

interface UseSourceControlActionsOptions {
  rootPath: string | undefined;
  stagedCount: number;
}

export function useSourceControlActions({ rootPath, stagedCount }: UseSourceControlActionsOptions) {
  const { t } = useI18n();
  const { selectedFile, setSelectedFile } = useSourceControlStore();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const stageMutation = useGitStage();
  const unstageMutation = useGitUnstage();
  const discardMutation = useGitDiscard();
  const commitMutation = useGitCommit();

  const handleStage = useCallback(
    (paths: string[]) => {
      if (rootPath) {
        stageMutation.mutate({ workdir: rootPath, paths });
      }
    },
    [rootPath, stageMutation]
  );

  const handleUnstage = useCallback(
    (paths: string[]) => {
      if (rootPath) {
        unstageMutation.mutate({ workdir: rootPath, paths });
      }
    },
    [rootPath, unstageMutation]
  );

  const handleDiscard = useCallback((paths: string[]) => {
    setConfirmAction({ paths, type: 'discard' });
  }, []);

  const handleDeleteUntracked = useCallback((paths: string[]) => {
    setConfirmAction({ paths, type: 'delete' });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!rootPath || !confirmAction) return;

    try {
      if (confirmAction.type === 'discard') {
        // 批量 discard，一次 git 调用避免锁冲突
        await discardMutation.mutateAsync({ workdir: rootPath, paths: confirmAction.paths });
      } else {
        // Delete untracked files
        for (const path of confirmAction.paths) {
          await window.electronAPI.file.delete(`${rootPath}/${path}`, {
            recursive: false,
          });
        }
        // Invalidate queries to refresh the file list
        stageMutation.mutate({ workdir: rootPath, paths: [] });
      }

      // Clear selection if affecting selected file
      if (selectedFile && confirmAction.paths.includes(selectedFile.path)) {
        setSelectedFile(null);
      }
    } catch (error) {
      toastManager.add({
        title: confirmAction.type === 'discard' ? t('Discard failed') : t('Delete failed'),
        description: error instanceof Error ? error.message : t('Unknown error'),
        type: 'error',
        timeout: 5000,
      });
    }

    setConfirmAction(null);
  }, [rootPath, confirmAction, discardMutation, selectedFile, setSelectedFile, stageMutation, t]);

  const handleCommit = useCallback(
    async (message: string) => {
      if (!rootPath || stagedCount === 0) return;

      try {
        await commitMutation.mutateAsync({ workdir: rootPath, message });
        toastManager.add({
          title: t('Commit successful'),
          description: t('Committed {{count}} files', { count: stagedCount }),
          type: 'success',
          timeout: 3000,
        });
        setSelectedFile(null);
      } catch (error) {
        toastManager.add({
          title: t('Commit failed'),
          description: error instanceof Error ? error.message : t('Unknown error'),
          type: 'error',
          timeout: 5000,
        });
      }
    },
    [rootPath, stagedCount, commitMutation, setSelectedFile, t]
  );

  return {
    // Actions
    handleStage,
    handleUnstage,
    handleDiscard,
    handleDeleteUntracked,
    handleCommit,
    // Confirmation dialog
    confirmAction,
    setConfirmAction,
    handleConfirmAction,
    // Mutation state
    isCommitting: commitMutation.isPending,
  };
}
