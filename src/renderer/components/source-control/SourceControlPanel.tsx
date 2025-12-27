import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  GitBranch,
  GripVertical,
  History,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useCommitDiff, useCommitFiles, useGitHistoryInfinite } from '@/hooks/useGitHistory';
import { useFileChanges } from '@/hooks/useSourceControl';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSourceControlStore } from '@/stores/sourceControl';
import { ChangesList } from './ChangesList';
import { CommitBox } from './CommitBox';
import { CommitDiffViewer } from './CommitDiffViewer';
import { CommitFileList } from './CommitFileList';
import { CommitHistoryList } from './CommitHistoryList';
import { panelTransition } from './constants';
import { DiffViewer } from './DiffViewer';
import { usePanelResize, useSecondaryPanelResize } from './usePanelResize';
import { useSourceControlActions } from './useSourceControlActions';

interface SourceControlPanelProps {
  rootPath: string | undefined;
  isActive?: boolean;
  onExpandWorktree?: () => void;
  worktreeCollapsed?: boolean;
}

export function SourceControlPanel({
  rootPath,
  isActive = false,
  onExpandWorktree,
  worktreeCollapsed,
}: SourceControlPanelProps) {
  const { t, tNode } = useI18n();

  // Accordion state - collapsible sections
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [commitFilesExpanded, setCommitFilesExpanded] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // History view state
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [selectedCommitFile, setSelectedCommitFile] = useState<string | null>(null);

  const {
    data: changes,
    isLoading,
    isFetching,
    refetch,
  } = useFileChanges(rootPath ?? null, isActive);

  const {
    data: commitsData,
    isLoading: commitsLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch: refetchCommits,
  } = useGitHistoryInfinite(rootPath ?? null, 20);

  // Refetch immediately when tab becomes active
  useEffect(() => {
    if (isActive && rootPath) {
      refetch();
      refetchCommits();
    }
  }, [isActive, rootPath, refetch, refetchCommits]);

  // Flatten infinite query data
  const commits = commitsData?.pages.flat() ?? [];
  const { data: commitFiles = [], isLoading: commitFilesLoading } = useCommitFiles(
    rootPath ?? null,
    selectedCommitHash
  );

  // Find the status of the selected file to pass to useCommitDiff
  const selectedFileStatus = commitFiles.find((f) => f.path === selectedCommitFile)?.status;

  const { data: commitDiff, isLoading: commitDiffLoading } = useCommitDiff(
    rootPath ?? null,
    selectedCommitHash,
    selectedCommitFile,
    selectedFileStatus
  );

  const { selectedFile, setSelectedFile, setNavigationDirection } = useSourceControlStore();

  const staged = useMemo(() => changes?.filter((c) => c.staged) ?? [], [changes]);
  const unstaged = useMemo(() => changes?.filter((c) => !c.staged) ?? [], [changes]);

  // All files in order: staged first, then unstaged
  const allFiles = useMemo(() => [...staged, ...unstaged], [staged, unstaged]);

  // Panel resize hooks
  const { width: panelWidth, isResizing, containerRef, handleMouseDown } = usePanelResize();

  const {
    width: commitFilesPanelWidth,
    isResizing: isResizingCommitFiles,
    panelRef: commitFilesPanelRef,
    handleMouseDown: handleCommitFilesMouseDown,
  } = useSecondaryPanelResize();

  // Source control actions
  const {
    handleStage,
    handleUnstage,
    handleDiscard,
    handleDeleteUntracked,
    handleCommit,
    confirmAction,
    setConfirmAction,
    handleConfirmAction,
    isCommitting,
  } = useSourceControlActions({ rootPath, stagedCount: staged.length });

  // Handle file click in current changes view - clear commit selection
  const handleFileClick = useCallback(
    (file: { path: string; staged: boolean }) => {
      setSelectedCommitHash(null);
      setSelectedCommitFile(null);
      setSelectedFile(file);
    },
    [setSelectedFile]
  );

  // Handle file click in commit history view - always navigate to first diff
  const handleCommitFileClick = useCallback(
    (filePath: string) => {
      setSelectedCommitFile(filePath);
      setNavigationDirection('next'); // Navigate to first diff
    },
    [setNavigationDirection]
  );

  // File navigation
  const currentFileIndex = selectedFile
    ? allFiles.findIndex((f) => f.path === selectedFile.path && f.staged === selectedFile.staged)
    : -1;

  const handlePrevFile = useCallback(() => {
    if (currentFileIndex > 0) {
      const prevFile = allFiles[currentFileIndex - 1];
      setNavigationDirection('prev');
      setSelectedFile({ path: prevFile.path, staged: prevFile.staged });
    }
  }, [currentFileIndex, allFiles, setSelectedFile, setNavigationDirection]);

  const handleNextFile = useCallback(() => {
    if (currentFileIndex < allFiles.length - 1) {
      const nextFile = allFiles[currentFileIndex + 1];
      setNavigationDirection('next');
      setSelectedFile({ path: nextFile.path, staged: nextFile.staged });
    }
  }, [currentFileIndex, allFiles, setSelectedFile, setNavigationDirection]);

  // Commit file navigation
  const currentCommitFileIndex = selectedCommitFile
    ? commitFiles.findIndex((f) => f.path === selectedCommitFile)
    : -1;

  const handlePrevCommitFile = useCallback(() => {
    if (currentCommitFileIndex > 0) {
      const prevFile = commitFiles[currentCommitFileIndex - 1];
      setNavigationDirection('prev');
      setSelectedCommitFile(prevFile.path);
    }
  }, [currentCommitFileIndex, commitFiles, setNavigationDirection]);

  const handleNextCommitFile = useCallback(() => {
    if (currentCommitFileIndex < commitFiles.length - 1) {
      const nextFile = commitFiles[currentCommitFileIndex + 1];
      setNavigationDirection('next');
      setSelectedCommitFile(nextFile.path);
    }
  }, [currentCommitFileIndex, commitFiles, setNavigationDirection]);

  if (!rootPath) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <GitBranch className="h-4.5 w-4.5" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>{t('Source Control')}</EmptyTitle>
          <EmptyDescription>{t('Select a Worktree to view changes')}</EmptyDescription>
        </EmptyHeader>
        {onExpandWorktree && worktreeCollapsed && (
          <Button onClick={onExpandWorktree} variant="outline" className="mt-2">
            <GitBranch className="mr-2 h-4 w-4" />
            {t('Choose Worktree')}
          </Button>
        )}
      </Empty>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">{t('Loading...')}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Expand Button (when collapsed) */}
        <AnimatePresence initial={false}>
          {sidebarCollapsed && (
            <motion.button
              key="sidebar-expand"
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="flex h-full w-6 shrink-0 items-center justify-center border-r text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground transition-colors"
              title={t('Show sidebar')}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 24, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={panelTransition}
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Left: Changes List */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.div
              key="sidebar"
              className="flex shrink-0 flex-col border-r overflow-hidden"
              style={{ width: panelWidth }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: panelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={panelTransition}
            >
              {/* Changes Section (Collapsible) */}
              <div
                className={cn(
                  'flex flex-col border-b',
                  changesExpanded ? 'flex-1 min-h-0' : 'shrink-0'
                )}
              >
                <div className="group flex items-center shrink-0 rounded-sm hover:bg-accent/50 transition-colors">
                  <button
                    type="button"
                    onClick={() => setChangesExpanded(!changesExpanded)}
                    className="flex flex-1 items-center gap-2 px-4 py-2 text-left focus:outline-none"
                  >
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-all duration-200',
                        !changesExpanded && '-rotate-90'
                      )}
                    />
                    <GitBranch className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('Changes')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className="mr-2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 group-hover:text-foreground transition-colors"
                    title={t('Hide sidebar')}
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
                </div>

                {changesExpanded && (
                  <>
                    <div className="flex-1 overflow-hidden min-h-0">
                      <ChangesList
                        staged={staged}
                        unstaged={unstaged}
                        selectedFile={selectedFile}
                        onFileClick={handleFileClick}
                        onStage={handleStage}
                        onUnstage={handleUnstage}
                        onDiscard={handleDiscard}
                        onDeleteUntracked={handleDeleteUntracked}
                        onRefresh={() => {
                          refetch();
                          refetchCommits();
                        }}
                        isRefreshing={isFetching}
                        repoPath={rootPath}
                      />
                    </div>
                    {/* Commit Box */}
                    <CommitBox
                      stagedCount={staged.length}
                      onCommit={handleCommit}
                      isCommitting={isCommitting}
                      rootPath={rootPath}
                    />
                  </>
                )}
              </div>

              {/* History Section (Collapsible) */}
              <div className={cn('flex flex-col', historyExpanded ? 'flex-1 min-h-0' : 'shrink-0')}>
                <button
                  type="button"
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="group flex w-full items-center gap-2 px-4 py-2 text-left rounded-sm hover:bg-accent/50 transition-colors shrink-0 focus:outline-none"
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-all duration-200',
                      !historyExpanded && '-rotate-90'
                    )}
                  />
                  <History className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('History')}</span>
                </button>

                {historyExpanded && (
                  <div className="h-full flex-1 overflow-hidden min-h-0">
                    <CommitHistoryList
                      commits={commits}
                      selectedHash={selectedCommitHash}
                      onCommitClick={(hash) => {
                        setSelectedCommitHash(hash);
                        setSelectedCommitFile(null);
                        setCommitFilesExpanded(true);
                      }}
                      isLoading={commitsLoading}
                      isFetchingNextPage={isFetchingNextPage}
                      hasNextPage={hasNextPage}
                      onLoadMore={() => {
                        if (hasNextPage && !isFetchingNextPage) {
                          fetchNextPage();
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resize Handle */}
        {!sidebarCollapsed && (
          <div
            className={cn(
              'group flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent',
              isResizing && 'bg-accent'
            )}
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </div>
        )}

        {/* Right: Diff Viewer or Commit Details */}
        <div className="flex flex-1 overflow-hidden">
          {selectedCommitHash ? (
            <>
              {/* Commit File List (Collapsible) */}
              <AnimatePresence initial={false}>
                {commitFilesExpanded && (
                  <motion.div
                    key="commit-files"
                    ref={commitFilesPanelRef}
                    className="flex h-full shrink-0 overflow-hidden"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: commitFilesPanelWidth + 4, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={panelTransition}
                  >
                    <div
                      className="h-full shrink-0 border-r"
                      style={{ width: commitFilesPanelWidth }}
                    >
                      <CommitFileList
                        files={commitFiles}
                        selectedFile={selectedCommitFile}
                        onFileClick={handleCommitFileClick}
                        isLoading={commitFilesLoading}
                        commitHash={selectedCommitHash}
                        onCollapse={() => setCommitFilesExpanded(false)}
                      />
                    </div>
                    {/* Resize Handle for Commit Files Panel */}
                    <div
                      className={cn(
                        'group flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent',
                        isResizingCommitFiles && 'bg-accent'
                      )}
                      onMouseDown={handleCommitFilesMouseDown}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Commit Diff Viewer */}
              <div className="flex-1 overflow-hidden">
                <CommitDiffViewer
                  rootPath={rootPath}
                  fileDiff={commitDiff}
                  filePath={selectedCommitFile}
                  isLoading={commitDiffLoading}
                  filesCollapsed={!commitFilesExpanded}
                  onExpandFiles={() => setCommitFilesExpanded(true)}
                  onPrevFile={handlePrevCommitFile}
                  onNextFile={handleNextCommitFile}
                  hasPrevFile={currentCommitFileIndex > 0}
                  hasNextFile={currentCommitFileIndex < commitFiles.length - 1}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-hidden">
              <DiffViewer
                rootPath={rootPath}
                file={selectedFile}
                onPrevFile={handlePrevFile}
                onNextFile={handleNextFile}
                hasPrevFile={currentFileIndex > 0}
                hasNextFile={currentFileIndex < allFiles.length - 1}
              />
            </div>
          )}
        </div>
      </div>

      {/* Discard/Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'discard' ? t('Discard changes') : t('Delete file')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'discard'
                ? tNode(
                    'Are you sure you want to discard changes to {{path}}? This cannot be undone.',
                    {
                      path: (
                        <span className="font-medium text-foreground">{confirmAction.path}</span>
                      ),
                    }
                  )
                : tNode(
                    'Are you sure you want to delete the untracked file {{path}}? This cannot be undone.',
                    {
                      path: (
                        <span className="font-medium text-foreground">{confirmAction?.path}</span>
                      ),
                    }
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">{t('Cancel')}</Button>} />
            <Button variant="destructive" onClick={handleConfirmAction}>
              {confirmAction?.type === 'discard' ? t('Discard changes') : t('Delete file')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
