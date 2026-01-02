# Claude Provider 快速切换器设计

## 概述

实现 Claude Provider 快速切换功能，允许用户管理多组 Claude API 配置并快速切换。

## 功能入口

1. **集成设置页面** - 添加/编辑/删除/切换配置
2. **Command Panel** - 快速切换配置

## 数据模型

### Provider 结构

```typescript
// src/shared/types/claude.ts

export interface ClaudeProvider {
  id: string;                      // UUID
  name: string;                    // 显示名称
  baseUrl: string;                 // ANTHROPIC_BASE_URL
  authToken: string;               // ANTHROPIC_AUTH_TOKEN
  model?: string;                  // settings.json 的 model 字段
  smallFastModel?: string;         // ANTHROPIC_SMALL_FAST_MODEL
  defaultSonnetModel?: string;     // ANTHROPIC_DEFAULT_SONNET_MODEL
  defaultOpusModel?: string;       // ANTHROPIC_DEFAULT_OPUS_MODEL
  defaultHaikuModel?: string;      // ANTHROPIC_DEFAULT_HAIKU_MODEL
}
```

### 存储位置

- **Provider 列表**：存储在 EnsoAI 设置中（Zustand store）
- **激活状态**：不存储，实时从 `~/.claude/settings.json` 计算

```typescript
// 扩展 ClaudeCodeIntegrationSettings
export interface ClaudeCodeIntegrationSettings {
  enabled: boolean;
  providers: ClaudeProvider[];     // 只存配置列表
  // ...其他现有字段
}
```

## 配置同步策略

### 核心原则

EnsoAI 只管理 Provider 相关字段，不干扰其他配置。

```
~/.claude/settings.json 结构：
├── env                    ← EnsoAI 管理（部分字段）
│   ├── ANTHROPIC_BASE_URL      ← Provider 控制
│   ├── ANTHROPIC_AUTH_TOKEN    ← Provider 控制
│   ├── ANTHROPIC_*_MODEL       ← Provider 控制
│   └── 其他字段                 ← 保留用户原有值
├── model                  ← Provider 控制（可选）
├── hooks                  ← 保留不动
├── permissions            ← 保留不动
├── enabledPlugins         ← 保留不动
└── ...其他字段            ← 保留不动
```

### 激活状态计算

```typescript
function getActiveProvider(
  providers: ClaudeProvider[],
  claudeSettings: ClaudeSettings
): ClaudeProvider | null {
  const { env } = claudeSettings;
  return providers.find(p =>
    p.baseUrl === env?.ANTHROPIC_BASE_URL &&
    p.authToken === env?.ANTHROPIC_AUTH_TOKEN
  ) ?? null;
}
```

- 匹配到 → 显示 Provider 名称 + 激活标记
- 匹配不到 → 显示"未保存的配置" + 保存按钮

## 主进程服务层

### ClaudeProviderManager

```typescript
// src/main/services/claude/ClaudeProviderManager.ts

export class ClaudeProviderManager {
  // 读取 ~/.claude/settings.json
  readClaudeSettings(): ClaudeSettings | null;

  // 从当前 settings 提取 Provider 相关字段（用于"保存为新配置"）
  extractProviderFromSettings(): Partial<ClaudeProvider> | null;

  // 应用 Provider 到 settings.json
  applyProvider(provider: ClaudeProvider): boolean;
}
```

### 应用逻辑

```typescript
applyProvider(provider: ClaudeProvider): boolean {
  const settings = this.readClaudeSettings() ?? {};

  // 保留现有 env 中非 Provider 字段
  const existingEnv = settings.env ?? {};
  const providerEnv = {
    ANTHROPIC_BASE_URL: provider.baseUrl,
    ANTHROPIC_AUTH_TOKEN: provider.authToken,
    ...(provider.smallFastModel && { ANTHROPIC_SMALL_FAST_MODEL: provider.smallFastModel }),
    ...(provider.defaultSonnetModel && { ANTHROPIC_DEFAULT_SONNET_MODEL: provider.defaultSonnetModel }),
    ...(provider.defaultOpusModel && { ANTHROPIC_DEFAULT_OPUS_MODEL: provider.defaultOpusModel }),
    ...(provider.defaultHaikuModel && { ANTHROPIC_DEFAULT_HAIKU_MODEL: provider.defaultHaikuModel }),
  };

  settings.env = { ...existingEnv, ...providerEnv };

  if (provider.model) {
    settings.model = provider.model;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return true;
}
```

### IPC 通道

```typescript
// src/shared/types/ipc.ts
CLAUDE_PROVIDER_READ_SETTINGS    // 读取并提取当前配置
CLAUDE_PROVIDER_APPLY            // 应用某个 Provider
```

## UI 组件

### 文件结构

```
src/renderer/components/settings/
├── IntegrationSettings.tsx        # 现有文件，添加 Provider 区块
├── claude-provider/
│   ├── ProviderList.tsx           # Provider 列表（显示激活状态）
│   ├── ProviderDialog.tsx         # 新建/编辑弹窗
│   └── ProviderForm.tsx           # 表单字段
```

### ProviderList 交互

```
┌─────────────────────────────────────────────────┐
│ Claude Provider                                 │
├─────────────────────────────────────────────────┤
│ 当前: 未保存的配置  [保存]                        │
├─────────────────────────────────────────────────┤
│ ○ 官方 API                            [编辑] [删除] │
│ ● 自建代理 (激活)                      [编辑] [删除] │
│ ○ 备用服务                            [编辑] [删除] │
├─────────────────────────────────────────────────┤
│                              [+ 添加配置]        │
└─────────────────────────────────────────────────┘
```

### ProviderDialog 表单字段

| 字段 | 必填 | 说明 |
|-----|-----|------|
| 名称 | ✓ | 配置显示名称 |
| Base URL | ✓ | API 地址 |
| Auth Token | ✓ | 认证令牌（密码输入框） |
| Model | | 默认模型别名 |
| Small/Fast Model | | 快速模型 |
| Sonnet Model | | Sonnet 模型 ID |
| Opus Model | | Opus 模型 ID |
| Haiku Model | | Haiku 模型 ID |

### 交互规则

- 点击列表项即切换 Provider
- "未保存的配置" + 保存按钮：基于当前 settings.json 创建新 Provider

## Command Panel 集成

### ActionPanel 扩展

```typescript
// 在 ActionPanel.tsx 中添加 Claude Provider 分组

const providers = useSettingsStore((s) => s.claudeCodeIntegration.providers);
const { data: claudeSettings } = useQuery({
  queryKey: ['claude-settings'],
  queryFn: () => window.electronAPI.claude.readSettings(),
});

const activeProvider = useMemo(() => {
  if (!claudeSettings?.env) return null;
  return providers.find(p =>
    p.baseUrl === claudeSettings.env.ANTHROPIC_BASE_URL &&
    p.authToken === claudeSettings.env.ANTHROPIC_AUTH_TOKEN
  );
}, [providers, claudeSettings]);

// actionGroups 中添加
{
  label: 'Claude Provider',
  items: providers.map(provider => ({
    id: `claude-provider-${provider.id}`,
    label: provider.name,
    icon: provider.id === activeProvider?.id ? CheckCircle : Circle,
    action: () => applyProvider.mutate(provider),
  })),
}
```

### UI 展示

```
┌─────────────────────────────────────┐
│ Filter actions...                   │
├─────────────────────────────────────┤
│ Claude Provider                     │
│   ○ 官方 API                        │
│   ● 自建代理                         │
│   ○ 备用服务                         │
├─────────────────────────────────────┤
│ Panel                               │
│   ...                               │
└─────────────────────────────────────┘
```

- `●` (CheckCircle) = 当前激活
- `○` (Circle) = 未激活
- 点击即切换

## 实施清单

1. **类型定义** (`src/shared/types/claude.ts`)
   - [ ] 定义 ClaudeProvider 接口
   - [ ] 定义 ClaudeSettings 接口（读取用）

2. **IPC 通道** (`src/shared/types/ipc.ts`)
   - [ ] 添加 CLAUDE_PROVIDER_READ_SETTINGS
   - [ ] 添加 CLAUDE_PROVIDER_APPLY

3. **主进程服务** (`src/main/services/claude/ClaudeProviderManager.ts`)
   - [ ] 实现 readClaudeSettings
   - [ ] 实现 extractProviderFromSettings
   - [ ] 实现 applyProvider

4. **IPC 注册** (`src/main/ipc/claude.ts`)
   - [ ] 注册 Provider 相关 handlers

5. **Preload 暴露** (`src/preload/index.ts`)
   - [ ] 暴露 claude.readSettings
   - [ ] 暴露 claude.applyProvider

6. **Settings Store** (`src/renderer/stores/settings.ts`)
   - [ ] 扩展 ClaudeCodeIntegrationSettings
   - [ ] 添加 providers 字段和操作方法

7. **UI 组件**
   - [ ] ProviderList.tsx
   - [ ] ProviderDialog.tsx
   - [ ] ProviderForm.tsx
   - [ ] 集成到 IntegrationSettings.tsx

8. **Command Panel** (`src/renderer/components/layout/ActionPanel.tsx`)
   - [ ] 添加 Claude Provider 分组
