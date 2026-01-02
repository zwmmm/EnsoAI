# Claude Provider 快速切换器实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Claude Provider 快速切换功能，允许用户管理多组 Claude API 配置并在设置页面和 Command Panel 中快速切换。

**Architecture:** Provider 配置存储在 EnsoAI 设置中，切换时修改 `~/.claude/settings.json` 的 `env` 和 `model` 字段。激活状态通过匹配 baseUrl + authToken 实时计算。

**Tech Stack:** TypeScript, React, Zustand, Electron IPC

---

## Task 1: 类型定义

**Files:**
- Create: `src/shared/types/claude.ts`
- Modify: `src/shared/types/index.ts`

**Step 1: 创建 ClaudeProvider 类型文件**

```typescript
// src/shared/types/claude.ts

/**
 * Claude Provider 配置
 * 用于管理多组 Claude API 配置
 */
export interface ClaudeProvider {
  id: string;
  name: string;
  baseUrl: string;
  authToken: string;
  model?: string;
  smallFastModel?: string;
  defaultSonnetModel?: string;
  defaultOpusModel?: string;
  defaultHaikuModel?: string;
}

/**
 * Claude settings.json 中的 env 字段结构
 */
export interface ClaudeSettingsEnv {
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_AUTH_TOKEN?: string;
  ANTHROPIC_SMALL_FAST_MODEL?: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
  [key: string]: string | undefined;
}

/**
 * Claude settings.json 结构（部分）
 */
export interface ClaudeSettings {
  env?: ClaudeSettingsEnv;
  model?: string;
  hooks?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  [key: string]: unknown;
}
```

**Step 2: 导出类型**

在 `src/shared/types/index.ts` 末尾添加：

```typescript
export * from './claude';
```

**Step 3: Commit**

```bash
git add src/shared/types/claude.ts src/shared/types/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add ClaudeProvider type definitions

Add type definitions for Claude Provider configuration management
EOF
)"
```

---

## Task 2: IPC 通道定义

**Files:**
- Modify: `src/shared/types/ipc.ts:119-124`

**Step 1: 添加 IPC 通道**

在 `src/shared/types/ipc.ts` 的 `// MCP (Claude IDE Bridge)` 部分后添加：

```typescript
  // Claude Provider
  CLAUDE_PROVIDER_READ_SETTINGS: 'claude:provider:readSettings',
  CLAUDE_PROVIDER_APPLY: 'claude:provider:apply',
```

**Step 2: Commit**

```bash
git add src/shared/types/ipc.ts
git commit -m "$(cat <<'EOF'
feat(ipc): add Claude Provider IPC channels
EOF
)"
```

---

## Task 3: 主进程服务 - ClaudeProviderManager

**Files:**
- Create: `src/main/services/claude/ClaudeProviderManager.ts`

**Step 1: 创建 ClaudeProviderManager**

```typescript
// src/main/services/claude/ClaudeProviderManager.ts

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ClaudeProvider, ClaudeSettings } from '@shared/types';

function getClaudeConfigDir(): string {
  if (process.env.CLAUDE_CONFIG_DIR) {
    return process.env.CLAUDE_CONFIG_DIR;
  }
  return path.join(os.homedir(), '.claude');
}

function getClaudeSettingsPath(): string {
  return path.join(getClaudeConfigDir(), 'settings.json');
}

/**
 * 读取 ~/.claude/settings.json
 */
export function readClaudeSettings(): ClaudeSettings | null {
  try {
    const settingsPath = getClaudeSettingsPath();
    if (!fs.existsSync(settingsPath)) {
      return null;
    }
    const content = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeSettings;
  } catch (error) {
    console.error('[ClaudeProviderManager] Failed to read settings:', error);
    return null;
  }
}

/**
 * 从当前 settings.json 提取 Provider 相关字段
 * 用于"保存为新配置"功能
 */
export function extractProviderFromSettings(): Partial<ClaudeProvider> | null {
  const settings = readClaudeSettings();
  if (!settings?.env?.ANTHROPIC_BASE_URL) {
    return null;
  }

  return {
    baseUrl: settings.env.ANTHROPIC_BASE_URL,
    authToken: settings.env.ANTHROPIC_AUTH_TOKEN,
    model: settings.model,
    smallFastModel: settings.env.ANTHROPIC_SMALL_FAST_MODEL,
    defaultSonnetModel: settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    defaultOpusModel: settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
    defaultHaikuModel: settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  };
}

/**
 * 应用 Provider 配置到 ~/.claude/settings.json
 * 只更新 Provider 相关字段，保留其他配置
 */
export function applyProvider(provider: ClaudeProvider): boolean {
  try {
    const settingsPath = getClaudeSettingsPath();
    let settings: ClaudeSettings = {};

    // 读取现有配置
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    }

    // 保留现有 env 中非 Provider 字段
    const existingEnv = settings.env ?? {};

    // 构建 Provider env 字段
    const providerEnv: Record<string, string> = {
      ANTHROPIC_BASE_URL: provider.baseUrl,
      ANTHROPIC_AUTH_TOKEN: provider.authToken,
    };

    // 可选字段
    if (provider.smallFastModel) {
      providerEnv.ANTHROPIC_SMALL_FAST_MODEL = provider.smallFastModel;
    }
    if (provider.defaultSonnetModel) {
      providerEnv.ANTHROPIC_DEFAULT_SONNET_MODEL = provider.defaultSonnetModel;
    }
    if (provider.defaultOpusModel) {
      providerEnv.ANTHROPIC_DEFAULT_OPUS_MODEL = provider.defaultOpusModel;
    }
    if (provider.defaultHaikuModel) {
      providerEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL = provider.defaultHaikuModel;
    }

    // 合并 env（Provider 字段覆盖现有值）
    settings.env = { ...existingEnv, ...providerEnv };

    // 设置 model 字段
    if (provider.model) {
      settings.model = provider.model;
    }

    // 确保目录存在
    const configDir = getClaudeConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }

    // 写入配置
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    });

    console.log(`[ClaudeProviderManager] Applied provider: ${provider.name}`);
    return true;
  } catch (error) {
    console.error('[ClaudeProviderManager] Failed to apply provider:', error);
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add src/main/services/claude/ClaudeProviderManager.ts
git commit -m "$(cat <<'EOF'
feat(main): add ClaudeProviderManager service

Implements read/write operations for Claude Provider configurations
EOF
)"
```

---

## Task 4: IPC Handler 注册

**Files:**
- Create: `src/main/ipc/claudeProvider.ts`
- Modify: `src/main/ipc/index.ts`

**Step 1: 创建 claudeProvider IPC handler**

```typescript
// src/main/ipc/claudeProvider.ts

import type { ClaudeProvider } from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  applyProvider,
  extractProviderFromSettings,
  readClaudeSettings,
} from '../services/claude/ClaudeProviderManager';

export function registerClaudeProviderHandlers(): void {
  // 读取当前 Claude settings
  ipcMain.handle(IPC_CHANNELS.CLAUDE_PROVIDER_READ_SETTINGS, () => {
    const settings = readClaudeSettings();
    const extracted = extractProviderFromSettings();
    return { settings, extracted };
  });

  // 应用 Provider 配置
  ipcMain.handle(IPC_CHANNELS.CLAUDE_PROVIDER_APPLY, (_, provider: ClaudeProvider) => {
    return applyProvider(provider);
  });
}
```

**Step 2: 在 index.ts 中注册**

在 `src/main/ipc/index.ts` 中：

1. 添加 import：
```typescript
import { registerClaudeProviderHandlers } from './claudeProvider';
```

2. 在 `registerIpcHandlers()` 函数中添加：
```typescript
registerClaudeProviderHandlers();
```

**Step 3: Commit**

```bash
git add src/main/ipc/claudeProvider.ts src/main/ipc/index.ts
git commit -m "$(cat <<'EOF'
feat(ipc): register Claude Provider IPC handlers
EOF
)"
```

---

## Task 5: Preload 暴露 API

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: 添加 claudeProvider API**

在 `src/preload/index.ts` 中，在 `mcp` 对象之后添加：

```typescript
  // Claude Provider
  claudeProvider: {
    readSettings: (): Promise<{
      settings: import('@shared/types').ClaudeSettings | null;
      extracted: Partial<import('@shared/types').ClaudeProvider> | null;
    }> => ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_PROVIDER_READ_SETTINGS),
    apply: (provider: import('@shared/types').ClaudeProvider): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_PROVIDER_APPLY, provider),
  },
```

**Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "$(cat <<'EOF'
feat(preload): expose Claude Provider API to renderer
EOF
)"
```

---

## Task 6: Settings Store 扩展

**Files:**
- Modify: `src/renderer/stores/settings.ts`

**Step 1: 扩展 ClaudeCodeIntegrationSettings 接口**

在 `src/renderer/stores/settings.ts` 中，修改 `ClaudeCodeIntegrationSettings` 接口：

```typescript
// Claude Code integration settings
export interface ClaudeCodeIntegrationSettings {
  enabled: boolean;
  selectionChangedDebounce: number;
  atMentionedKeybinding: TerminalKeybinding;
  stopHookEnabled: boolean;
  providers: import('@shared/types').ClaudeProvider[];
}
```

**Step 2: 更新默认值**

修改 `defaultClaudeCodeIntegrationSettings`：

```typescript
export const defaultClaudeCodeIntegrationSettings: ClaudeCodeIntegrationSettings = {
  enabled: true,
  selectionChangedDebounce: 300,
  atMentionedKeybinding: { key: 'm', meta: true, shift: true },
  stopHookEnabled: true,
  providers: [],
};
```

**Step 3: 添加 Provider 操作方法**

在 `SettingsState` 接口中添加：

```typescript
addClaudeProvider: (provider: import('@shared/types').ClaudeProvider) => void;
updateClaudeProvider: (id: string, updates: Partial<import('@shared/types').ClaudeProvider>) => void;
removeClaudeProvider: (id: string) => void;
```

**Step 4: 实现操作方法**

在 store 实现中添加：

```typescript
addClaudeProvider: (provider) =>
  set((state) => ({
    claudeCodeIntegration: {
      ...state.claudeCodeIntegration,
      providers: [...state.claudeCodeIntegration.providers, provider],
    },
  })),
updateClaudeProvider: (id, updates) =>
  set((state) => ({
    claudeCodeIntegration: {
      ...state.claudeCodeIntegration,
      providers: state.claudeCodeIntegration.providers.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    },
  })),
removeClaudeProvider: (id) =>
  set((state) => ({
    claudeCodeIntegration: {
      ...state.claudeCodeIntegration,
      providers: state.claudeCodeIntegration.providers.filter((p) => p.id !== id),
    },
  })),
```

**Step 5: Commit**

```bash
git add src/renderer/stores/settings.ts
git commit -m "$(cat <<'EOF'
feat(store): add Claude Provider management to settings store
EOF
)"
```

---

## Task 7: UI 组件 - ProviderList

**Files:**
- Create: `src/renderer/components/settings/claude-provider/ProviderList.tsx`

**Step 1: 创建 ProviderList 组件**

```typescript
// src/renderer/components/settings/claude-provider/ProviderList.tsx

import type { ClaudeProvider, ClaudeSettings } from '@shared/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Circle, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { ProviderDialog } from './ProviderDialog';

interface ProviderListProps {
  className?: string;
}

export function ProviderList({ className }: ProviderListProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { providers, removeClaudeProvider } = useSettingsStore((s) => ({
    providers: s.claudeCodeIntegration.providers,
    removeClaudeProvider: s.removeClaudeProvider,
  }));

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingProvider, setEditingProvider] = React.useState<ClaudeProvider | null>(null);
  const [saveFromCurrent, setSaveFromCurrent] = React.useState(false);

  // 读取当前 Claude settings
  const { data: claudeData } = useQuery({
    queryKey: ['claude-settings'],
    queryFn: () => window.electronAPI.claudeProvider.readSettings(),
    refetchInterval: 5000, // 每 5 秒刷新一次
  });

  // 计算当前激活的 Provider
  const activeProvider = React.useMemo(() => {
    if (!claudeData?.settings?.env) return null;
    const { env } = claudeData.settings;
    return providers.find(
      (p) =>
        p.baseUrl === env.ANTHROPIC_BASE_URL && p.authToken === env.ANTHROPIC_AUTH_TOKEN
    ) ?? null;
  }, [providers, claudeData?.settings?.env]);

  // 检查当前配置是否未保存
  const hasUnsavedConfig = React.useMemo(() => {
    if (!claudeData?.extracted?.baseUrl) return false;
    return !activeProvider;
  }, [claudeData?.extracted, activeProvider]);

  // 切换 Provider
  const handleSwitch = async (provider: ClaudeProvider) => {
    const success = await window.electronAPI.claudeProvider.apply(provider);
    if (success) {
      queryClient.invalidateQueries({ queryKey: ['claude-settings'] });
    }
  };

  // 编辑 Provider
  const handleEdit = (provider: ClaudeProvider) => {
    setEditingProvider(provider);
    setSaveFromCurrent(false);
    setDialogOpen(true);
  };

  // 删除 Provider
  const handleDelete = (provider: ClaudeProvider) => {
    removeClaudeProvider(provider.id);
  };

  // 新建 Provider
  const handleAdd = () => {
    setEditingProvider(null);
    setSaveFromCurrent(false);
    setDialogOpen(true);
  };

  // 从当前配置保存
  const handleSaveFromCurrent = () => {
    setEditingProvider(null);
    setSaveFromCurrent(true);
    setDialogOpen(true);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* 当前配置状态 */}
      {hasUnsavedConfig && claudeData?.extracted && (
        <div className="flex items-center justify-between rounded-md border border-dashed border-yellow-500/50 bg-yellow-500/5 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {t('Current config not saved')}
          </span>
          <Button variant="outline" size="sm" onClick={handleSaveFromCurrent}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {t('Save')}
          </Button>
        </div>
      )}

      {/* Provider 列表 */}
      {providers.length > 0 ? (
        <div className="space-y-1">
          {providers.map((provider) => {
            const isActive = activeProvider?.id === provider.id;
            return (
              <div
                key={provider.id}
                className={cn(
                  'group flex items-center justify-between rounded-md px-3 py-2 transition-colors',
                  isActive ? 'bg-accent' : 'hover:bg-accent/50 cursor-pointer'
                )}
                onClick={() => !isActive && handleSwitch(provider)}
              >
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{provider.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(provider);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(provider);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-sm text-muted-foreground">
          {t('No providers configured')}
        </div>
      )}

      {/* 添加按钮 */}
      <Button variant="outline" size="sm" className="w-full" onClick={handleAdd}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t('Add Provider')}
      </Button>

      {/* 弹窗 */}
      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editingProvider}
        initialValues={saveFromCurrent ? claudeData?.extracted : undefined}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/renderer/components/settings/claude-provider/ProviderList.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add ProviderList component for Claude Provider management
EOF
)"
```

---

## Task 8: UI 组件 - ProviderDialog

**Files:**
- Create: `src/renderer/components/settings/claude-provider/ProviderDialog.tsx`

**Step 1: 创建 ProviderDialog 组件**

```typescript
// src/renderer/components/settings/claude-provider/ProviderDialog.tsx

import type { ClaudeProvider } from '@shared/types';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: ClaudeProvider | null;
  initialValues?: Partial<ClaudeProvider> | null;
}

export function ProviderDialog({
  open,
  onOpenChange,
  provider,
  initialValues,
}: ProviderDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { addClaudeProvider, updateClaudeProvider } = useSettingsStore();

  const isEditing = !!provider;

  // 表单状态
  const [name, setName] = React.useState('');
  const [baseUrl, setBaseUrl] = React.useState('');
  const [authToken, setAuthToken] = React.useState('');
  const [model, setModel] = React.useState('');
  const [smallFastModel, setSmallFastModel] = React.useState('');
  const [defaultSonnetModel, setDefaultSonnetModel] = React.useState('');
  const [defaultOpusModel, setDefaultOpusModel] = React.useState('');
  const [defaultHaikuModel, setDefaultHaikuModel] = React.useState('');

  // 初始化表单
  React.useEffect(() => {
    if (open) {
      if (provider) {
        setName(provider.name);
        setBaseUrl(provider.baseUrl);
        setAuthToken(provider.authToken);
        setModel(provider.model ?? '');
        setSmallFastModel(provider.smallFastModel ?? '');
        setDefaultSonnetModel(provider.defaultSonnetModel ?? '');
        setDefaultOpusModel(provider.defaultOpusModel ?? '');
        setDefaultHaikuModel(provider.defaultHaikuModel ?? '');
      } else if (initialValues) {
        setName('');
        setBaseUrl(initialValues.baseUrl ?? '');
        setAuthToken(initialValues.authToken ?? '');
        setModel(initialValues.model ?? '');
        setSmallFastModel(initialValues.smallFastModel ?? '');
        setDefaultSonnetModel(initialValues.defaultSonnetModel ?? '');
        setDefaultOpusModel(initialValues.defaultOpusModel ?? '');
        setDefaultHaikuModel(initialValues.defaultHaikuModel ?? '');
      } else {
        setName('');
        setBaseUrl('');
        setAuthToken('');
        setModel('');
        setSmallFastModel('');
        setDefaultSonnetModel('');
        setDefaultOpusModel('');
        setDefaultHaikuModel('');
      }
    }
  }, [open, provider, initialValues]);

  const handleSave = async () => {
    if (!name.trim() || !baseUrl.trim() || !authToken.trim()) {
      return;
    }

    const providerData: ClaudeProvider = {
      id: provider?.id ?? crypto.randomUUID(),
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      authToken: authToken.trim(),
      model: model.trim() || undefined,
      smallFastModel: smallFastModel.trim() || undefined,
      defaultSonnetModel: defaultSonnetModel.trim() || undefined,
      defaultOpusModel: defaultOpusModel.trim() || undefined,
      defaultHaikuModel: defaultHaikuModel.trim() || undefined,
    };

    if (isEditing) {
      updateClaudeProvider(provider.id, providerData);
    } else {
      addClaudeProvider(providerData);
      // 新建后自动应用
      await window.electronAPI.claudeProvider.apply(providerData);
      queryClient.invalidateQueries({ queryKey: ['claude-settings'] });
    }

    onOpenChange(false);
  };

  const isValid = name.trim() && baseUrl.trim() && authToken.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('Edit Provider') : t('Add Provider')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure Claude API provider settings')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 名称 */}
          <div className="grid gap-2">
            <Label htmlFor="name">{t('Name')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g., Official API')}
            />
          </div>

          {/* Base URL */}
          <div className="grid gap-2">
            <Label htmlFor="baseUrl">{t('Base URL')} *</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com"
            />
          </div>

          {/* Auth Token */}
          <div className="grid gap-2">
            <Label htmlFor="authToken">{t('Auth Token')} *</Label>
            <Input
              id="authToken"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>

          {/* 可选字段 - 折叠区域 */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              {t('Advanced Options')}
            </summary>
            <div className="mt-3 grid gap-3">
              {/* Model */}
              <div className="grid gap-2">
                <Label htmlFor="model">{t('Model')}</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="opus / sonnet / haiku"
                />
              </div>

              {/* Small Fast Model */}
              <div className="grid gap-2">
                <Label htmlFor="smallFastModel">{t('Small/Fast Model')}</Label>
                <Input
                  id="smallFastModel"
                  value={smallFastModel}
                  onChange={(e) => setSmallFastModel(e.target.value)}
                  placeholder="claude-3-haiku-..."
                />
              </div>

              {/* Default Sonnet Model */}
              <div className="grid gap-2">
                <Label htmlFor="defaultSonnetModel">{t('Sonnet Model')}</Label>
                <Input
                  id="defaultSonnetModel"
                  value={defaultSonnetModel}
                  onChange={(e) => setDefaultSonnetModel(e.target.value)}
                  placeholder="claude-sonnet-4-..."
                />
              </div>

              {/* Default Opus Model */}
              <div className="grid gap-2">
                <Label htmlFor="defaultOpusModel">{t('Opus Model')}</Label>
                <Input
                  id="defaultOpusModel"
                  value={defaultOpusModel}
                  onChange={(e) => setDefaultOpusModel(e.target.value)}
                  placeholder="claude-opus-4-..."
                />
              </div>

              {/* Default Haiku Model */}
              <div className="grid gap-2">
                <Label htmlFor="defaultHaikuModel">{t('Haiku Model')}</Label>
                <Input
                  id="defaultHaikuModel"
                  value={defaultHaikuModel}
                  onChange={(e) => setDefaultHaikuModel(e.target.value)}
                  placeholder="claude-3-haiku-..."
                />
              </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('Cancel')}</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!isValid}>
            {isEditing ? t('Save') : t('Add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: 创建 index 导出文件**

```typescript
// src/renderer/components/settings/claude-provider/index.ts

export { ProviderList } from './ProviderList';
export { ProviderDialog } from './ProviderDialog';
```

**Step 3: Commit**

```bash
git add src/renderer/components/settings/claude-provider/
git commit -m "$(cat <<'EOF'
feat(ui): add ProviderDialog component for creating/editing providers
EOF
)"
```

---

## Task 9: 集成到 IntegrationSettings

**Files:**
- Modify: `src/renderer/components/settings/IntegrationSettings.tsx`

**Step 1: 添加 ProviderList 到 IntegrationSettings**

在 `IntegrationSettings.tsx` 中：

1. 添加 import：
```typescript
import { ProviderList } from './claude-provider';
```

2. 在 `{claudeCodeIntegration.enabled && (` 条件块内，在 "Enhanced Notification" Switch 之后添加：

```typescript
          {/* Claude Provider */}
          <div className="mt-4 border-t pt-4">
            <div className="mb-3">
              <span className="text-sm font-medium">{t('Claude Provider')}</span>
              <p className="text-xs text-muted-foreground">
                {t('Manage Claude API provider configurations')}
              </p>
            </div>
            <ProviderList />
          </div>
```

**Step 2: Commit**

```bash
git add src/renderer/components/settings/IntegrationSettings.tsx
git commit -m "$(cat <<'EOF'
feat(ui): integrate ProviderList into IntegrationSettings page
EOF
)"
```

---

## Task 10: Command Panel 集成

**Files:**
- Modify: `src/renderer/components/layout/ActionPanel.tsx`

**Step 1: 添加 imports 和 hooks**

在 `ActionPanel.tsx` 中添加 imports：

```typescript
import type { ClaudeProvider } from '@shared/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Circle } from 'lucide-react';
```

**Step 2: 在 ActionPanel 组件内添加 Provider 相关逻辑**

在组件内部，添加以下代码（在 `useRecentCommands` 之后）：

```typescript
  // Claude Provider
  const queryClient = useQueryClient();
  const providers = useSettingsStore((s) => s.claudeCodeIntegration.providers);

  const { data: claudeData } = useQuery({
    queryKey: ['claude-settings'],
    queryFn: () => window.electronAPI.claudeProvider.readSettings(),
    enabled: open, // 只在面板打开时查询
  });

  const activeProvider = React.useMemo(() => {
    if (!claudeData?.settings?.env) return null;
    const { env } = claudeData.settings;
    return providers.find(
      (p) =>
        p.baseUrl === env.ANTHROPIC_BASE_URL && p.authToken === env.ANTHROPIC_AUTH_TOKEN
    ) ?? null;
  }, [providers, claudeData?.settings?.env]);

  const applyProvider = useMutation({
    mutationFn: (provider: ClaudeProvider) =>
      window.electronAPI.claudeProvider.apply(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-settings'] });
    },
  });
```

**Step 3: 添加 Provider 分组到 actionGroups**

在 `actionGroups` useMemo 中，在第一个 group 之前添加：

```typescript
    // Claude Provider group (only show if providers exist)
    if (providers.length > 0) {
      groups.unshift({
        label: 'Claude Provider',
        items: providers.map((provider) => ({
          id: `claude-provider-${provider.id}`,
          label: provider.name,
          icon: activeProvider?.id === provider.id ? CheckCircle : Circle,
          action: () => {
            if (activeProvider?.id !== provider.id) {
              applyProvider.mutate(provider);
            }
          },
        })),
      });
    }
```

**Step 4: Commit**

```bash
git add src/renderer/components/layout/ActionPanel.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Claude Provider quick switch to Command Panel
EOF
)"
```

---

## Task 11: 验证和测试

**Step 1: 运行开发服务器**

```bash
pnpm dev
```

**Step 2: 手动测试检查清单**

- [ ] 打开设置 → 集成 → Claude Code Integration
- [ ] 确认 "Claude Provider" 区块显示
- [ ] 点击 "添加配置" 按钮，确认弹窗打开
- [ ] 填写必填字段，点击添加，确认配置保存
- [ ] 确认新配置显示在列表中并标记为激活
- [ ] 编辑配置，确认修改保存
- [ ] 添加第二个配置
- [ ] 点击切换，确认 `~/.claude/settings.json` 更新
- [ ] 打开 Command Panel (Cmd+K)，确认 Claude Provider 分组显示
- [ ] 在 Command Panel 中切换 Provider

**Step 3: 最终 Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: complete Claude Provider quick switcher implementation

- Add type definitions for ClaudeProvider
- Add ClaudeProviderManager service for reading/writing Claude settings
- Add IPC handlers and preload API
- Extend settings store with provider management
- Add ProviderList and ProviderDialog UI components
- Integrate into IntegrationSettings page
- Add Command Panel quick switch support
EOF
)"
```

---

## 实施清单摘要

| Task | 描述 | 文件 |
|------|------|------|
| 1 | 类型定义 | `src/shared/types/claude.ts` |
| 2 | IPC 通道 | `src/shared/types/ipc.ts` |
| 3 | 主进程服务 | `src/main/services/claude/ClaudeProviderManager.ts` |
| 4 | IPC Handler | `src/main/ipc/claudeProvider.ts`, `index.ts` |
| 5 | Preload API | `src/preload/index.ts` |
| 6 | Settings Store | `src/renderer/stores/settings.ts` |
| 7 | ProviderList | `src/renderer/components/settings/claude-provider/ProviderList.tsx` |
| 8 | ProviderDialog | `src/renderer/components/settings/claude-provider/ProviderDialog.tsx` |
| 9 | IntegrationSettings | `src/renderer/components/settings/IntegrationSettings.tsx` |
| 10 | Command Panel | `src/renderer/components/layout/ActionPanel.tsx` |
| 11 | 验证测试 | 手动测试 |
