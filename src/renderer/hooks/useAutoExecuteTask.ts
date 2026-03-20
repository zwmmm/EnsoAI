import { type AgentStopNotificationData, TASK_COMPLETION_MARKER } from '@shared/types/agent';
import { useCallback, useEffect, useRef } from 'react';
import type { ResolvedAgent } from '@/components/todo/useEnabledAgents';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { INITIAL_AUTO_EXECUTE, useTodoStore } from '@/stores/todo';

/**
 * Find the UI session ID matching a Claude CLI session ID.
 * Claude CLI session ID (from hooks) differs from our UI session ID (crypto.randomUUID).
 */
function findUISessionId(cliSessionId: string): string | undefined {
  const session = useAgentSessionsStore
    .getState()
    .sessions.find((s) => s.sessionId === cliSessionId || s.id === cliSessionId);
  return session?.id;
}

// Re-export for convenience
export { TASK_COMPLETION_MARKER };

/**
 * Build prompt with auto-execute rules
 */
export function buildAutoExecutePrompt(title: string, description?: string): string {
  return `
${title}

${description || ''}

---
[AUTO-EXECUTE RULES - MUST FOLLOW]
1. When task is complete, output the following marker on a separate line at the end of your response: ${TASK_COMPLETION_MARKER}
2. Do NOT call AskUserQuestion tool. Do NOT ask user to choose options. Directly select and execute the best approach.
3. Solve problems autonomously. Do NOT interrupt the workflow to wait for user input.
`.trim();
}

/**
 * Hook to manage auto-execute task completion detection
 *
 * Listens for agent stop events and:
 * 1. Marks current task as done
 * 2. Advances to next task in queue
 */
export function useAutoExecuteTask(
  repoPath: string,
  worktreePath: string | undefined,
  onSwitchToAgent?: () => void,
  enabledAgents?: ResolvedAgent[]
) {
  const autoExecute = useTodoStore((s) => s.autoExecute[repoPath] ?? INITIAL_AUTO_EXECUTE);
  const advanceQueue = useTodoStore((s) => s.advanceQueue);
  const stopAutoExecute = useTodoStore((s) => s.stopAutoExecute);
  const updateTask = useTodoStore((s) => s.updateTask);
  const setCurrentExecution = useTodoStore((s) => s.setCurrentExecution);

  // Use ref to break circular dependency between handleAgentStop and executeTask
  const executeTaskRef = useRef<(taskId: string) => void>(() => {});

  // Execute a single task
  const executeTask = useCallback(
    (taskId: string) => {
      if (!worktreePath || !enabledAgents || enabledAgents.length === 0) {
        stopAutoExecute(repoPath);
        return;
      }

      const tasks = useTodoStore.getState().tasks[repoPath] ?? [];
      const task = tasks.find((t) => t.id === taskId);
      if (!task) {
        stopAutoExecute(repoPath);
        return;
      }

      // Build prompt with auto-execute rules
      const taskContext = buildAutoExecutePrompt(task.title, task.description);

      // Use default agent or first available
      const agent = enabledAgents.find((a) => a.isDefault) ?? enabledAgents[0];

      const sessionId = crypto.randomUUID();

      // Create session with pending command
      useAgentSessionsStore.setState((state) => {
        const worktreeSessions = state.sessions.filter(
          (s) => s.repoPath === repoPath && s.cwd === worktreePath
        );
        const maxOrder = worktreeSessions.reduce(
          (max, s) => Math.max(max, s.displayOrder ?? 0),
          -1
        );

        return {
          sessions: [
            ...state.sessions,
            {
              id: sessionId,
              sessionId,
              name: `Task: ${task.title}`,
              userRenamed: true,
              agentId: agent.agentId,
              agentCommand: agent.command,
              customPath: agent.customPath,
              customArgs: agent.customArgs,
              initialized: false,
              repoPath,
              cwd: worktreePath,
              environment: agent.environment,
              displayOrder: maxOrder + 1,
              pendingCommand: taskContext,
            },
          ],
          activeIds: {
            ...state.activeIds,
            [worktreePath.replace(/\\/g, '/')]: sessionId,
          },
          enhancedInputStates: {
            ...state.enhancedInputStates,
            [sessionId]: { open: false, content: '', imagePaths: [] },
          },
        };
      });

      // Update task status and link session
      updateTask(repoPath, taskId, { status: 'in-progress', sessionId });
      setCurrentExecution(repoPath, taskId, sessionId);

      onSwitchToAgent?.();
    },
    [
      repoPath,
      worktreePath,
      enabledAgents,
      updateTask,
      setCurrentExecution,
      onSwitchToAgent,
      stopAutoExecute,
    ]
  );

  // Keep ref in sync to avoid circular dependency in handleAgentStop
  executeTaskRef.current = executeTask;

  // Handle task completion based on stop notification
  const handleAgentStop = useCallback(
    (data: AgentStopNotificationData) => {
      // Read latest state to avoid stale closure
      const currentAutoExecute =
        useTodoStore.getState().autoExecute[repoPath] ?? INITIAL_AUTO_EXECUTE;

      if (!worktreePath || !currentAutoExecute.running) return;

      // Match CLI session ID to our UI session ID
      const uiSessionId = findUISessionId(data.sessionId);
      if (uiSessionId !== currentAutoExecute.currentSessionId) return;

      const currentTaskId = currentAutoExecute.currentTaskId;
      if (!currentTaskId) return;

      // Agent stopped - treat as done unless explicitly failed.
      // 'unknown' means we couldn't detect the marker, but the agent did finish.
      if (data.taskCompletionStatus === 'failed') {
        updateTask(repoPath, currentTaskId, { status: 'todo', sessionId: undefined });
        stopAutoExecute(repoPath);
        return;
      }

      // completed or unknown - mark done and advance
      updateTask(repoPath, currentTaskId, { status: 'done', sessionId: undefined });

      const nextTaskId = advanceQueue(repoPath);
      if (nextTaskId && enabledAgents && enabledAgents.length > 0) {
        executeTaskRef.current(nextTaskId);
      } else {
        stopAutoExecute(repoPath);
      }
    },
    [repoPath, worktreePath, updateTask, advanceQueue, stopAutoExecute, enabledAgents]
  );

  // Use ref for handler to avoid re-subscription on every callback change
  const handleAgentStopRef = useRef(handleAgentStop);
  handleAgentStopRef.current = handleAgentStop;

  // Start auto-execute with a list of tasks
  const startAutoExecute = useCallback(
    (taskIds: string[]) => {
      if (taskIds.length === 0 || !enabledAgents || enabledAgents.length === 0) {
        return;
      }

      const [firstTaskId, ...rest] = taskIds;

      // Queue only remaining tasks (exclude the first one being executed now)
      useTodoStore.getState().startAutoExecute(repoPath, rest);

      // Execute first task
      executeTask(firstTaskId);
    },
    [repoPath, enabledAgents, executeTask]
  );

  // Stop auto-execute
  const stop = useCallback(() => {
    stopAutoExecute(repoPath);
  }, [repoPath, stopAutoExecute]);

  // Reorder queue
  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      useTodoStore.getState().reorderAutoExecuteQueue(repoPath, fromIndex, toIndex);
    },
    [repoPath]
  );

  // Remove from queue
  const removeFromQueue = useCallback(
    (taskId: string) => {
      useTodoStore.getState().removeFromAutoExecuteQueue(repoPath, taskId);
    },
    [repoPath]
  );

  // Listen for agent stop events - only subscribe when running
  useEffect(() => {
    if (!autoExecute?.running) return;

    const unsubscribe = window.electronAPI.notification.onAgentStop((data) =>
      handleAgentStopRef.current(data)
    );
    return unsubscribe;
  }, [autoExecute?.running]);

  return {
    autoExecute,
    startAutoExecute,
    stop,
    reorderQueue,
    removeFromQueue,
    executeTask,
  };
}
