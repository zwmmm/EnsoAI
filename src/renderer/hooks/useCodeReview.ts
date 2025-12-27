import { useCallback, useEffect, useRef, useState } from 'react';
import { type ReviewStatus, type StreamEvent, StreamJsonParser } from '@/lib/stream-json-parser';
import { useSettingsStore } from '@/stores/settings';

interface UseCodeReviewOptions {
  repoPath: string | undefined;
}

interface UseCodeReviewReturn {
  content: string;
  status: ReviewStatus;
  error: string | null;
  cost: number | null;
  model: string | null;
  sessionId: string | null;
  canContinue: boolean;
  startReview: () => Promise<void>;
  stopReview: () => void;
  reset: () => void;
}

export function useCodeReview({ repoPath }: UseCodeReviewOptions): UseCodeReviewReturn {
  const codeReviewSettings = useSettingsStore((s) => s.codeReview);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<ReviewStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const parserRef = useRef<StreamJsonParser>(new StreamJsonParser());
  const reviewIdRef = useRef<string | null>(null);
  const cleanupFnRef = useRef<(() => void) | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    if (cleanupFnRef.current) {
      cleanupFnRef.current();
      cleanupFnRef.current = null;
    }

    if (reviewIdRef.current) {
      window.electronAPI.git.stopCodeReview(reviewIdRef.current).catch(console.error);
      reviewIdRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // 处理单个事件
  const handleEvent = useCallback((event: StreamEvent) => {
    // 检查初始化事件
    if (StreamJsonParser.isInitEvent(event)) {
      setStatus('streaming');
      return;
    }

    // 提取文本增量
    const text = StreamJsonParser.extractTextDelta(event);
    if (text) {
      setContent((prev) => `${prev}${text}`);
    }

    // 消息结束时添加换行
    if (StreamJsonParser.isMessageEndEvent(event)) {
      setContent((prev) => `${prev}\n\n`);
    }

    // 检查完成事件并提取费用和模型
    if (StreamJsonParser.isResultEvent(event)) {
      const totalCost = StreamJsonParser.extractCost(event);
      if (totalCost !== null) {
        setCost(totalCost);
      }
      const modelName = StreamJsonParser.extractModel(event);
      if (modelName !== null) {
        setModel(modelName);
      }
      setStatus('complete');
    }

    // 检查错误事件
    if (StreamJsonParser.isErrorEvent(event)) {
      setStatus('error');
      setError(event.message?.toString() || 'Unknown error');
    }
  }, []);

  // 开始代码审查
  const startReview = useCallback(async () => {
    if (!repoPath) {
      setError('No repository path');
      setStatus('error');
      return;
    }

    // 重置状态
    setContent('');
    setError(null);
    setCost(null);
    setModel(null);
    setSessionId(null);
    setStatus('initializing');
    parserRef.current.reset();
    cleanup();

    try {
      // 生成唯一的 reviewId
      const reviewId = `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      reviewIdRef.current = reviewId;

      // 生成 claude session ID（仅当 continueConversation 开启时）
      const shouldContinue = codeReviewSettings.continueConversation ?? true;
      const claudeSessionId = shouldContinue ? crypto.randomUUID() : undefined;

      // 监听数据输出
      const onDataCleanup = window.electronAPI.git.onCodeReviewData((event) => {
        if (event.reviewId !== reviewId) return;

        if (event.type === 'data' && event.data) {
          const events = parserRef.current.parse(event.data);
          for (const e of events) {
            handleEvent(e);
          }
        } else if (event.type === 'error' && event.data) {
          // stderr 输出通常是日志，不一定是错误
          console.warn('[CodeReview stderr]', event.data);
        } else if (event.type === 'exit') {
          if (event.exitCode !== 0 && status !== 'complete') {
            setStatus('error');
            setError(`Process exited with code ${event.exitCode}`);
          } else if (status !== 'error') {
            setStatus('complete');
          }
          reviewIdRef.current = null;
        }
      });
      cleanupFnRef.current = onDataCleanup;

      // 启动代码审查
      const result = await window.electronAPI.git.startCodeReview(repoPath, {
        model: codeReviewSettings.model,
        language: codeReviewSettings.language ?? '中文',
        continueConversation: shouldContinue,
        sessionId: claudeSessionId,
        reviewId,
      });

      if (!result.success) {
        setStatus('error');
        setError(result.error || 'Failed to start review');
        cleanup();
      } else if (result.sessionId) {
        setSessionId(result.sessionId);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to start review');
      cleanup();
    }
  }, [
    repoPath,
    cleanup,
    handleEvent,
    status,
    codeReviewSettings.model,
    codeReviewSettings.language,
    codeReviewSettings.continueConversation,
  ]);

  // 停止审查
  const stopReview = useCallback(() => {
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  // 重置状态
  const reset = useCallback(() => {
    cleanup();
    setContent('');
    setError(null);
    setCost(null);
    setModel(null);
    setSessionId(null);
    setStatus('idle');
    parserRef.current.reset();
  }, [cleanup]);

  // 处理旧用户没有新字段的情况
  const continueConversation = codeReviewSettings.continueConversation ?? true;

  return {
    content,
    status,
    error,
    cost,
    model,
    sessionId,
    canContinue: continueConversation && sessionId !== null,
    startReview,
    stopReview,
    reset,
  };
}
