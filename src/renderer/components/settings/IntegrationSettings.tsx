import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { KeybindingInput } from './KeybindingsSettings';

export function IntegrationSettings() {
  const { t } = useI18n();
  const {
    claudeCodeIntegration,
    setClaudeCodeIntegration,
    commitMessageGenerator,
    setCommitMessageGenerator,
    codeReview,
    setCodeReview,
  } = useSettingsStore();
  const [bridgePort, setBridgePort] = React.useState<number | null>(null);

  const debounceOptions = React.useMemo(
    () =>
      [100, 200, 300, 500, 1000].map((value) => ({
        value,
        label: `${value}ms`,
      })),
    []
  );

  // Fetch bridge status on mount and when enabled changes
  React.useEffect(() => {
    if (claudeCodeIntegration.enabled) {
      window.electronAPI.mcp.getStatus().then((status) => {
        setBridgePort(status.port);
      });
    } else {
      setBridgePort(null);
    }
  }, [claudeCodeIntegration.enabled]);

  const handleEnabledChange = (checked: boolean) => {
    // Just update the settings - App.tsx useEffect will handle the bridge
    setClaudeCodeIntegration({ enabled: checked });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('Claude Code Integration')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('Connect to Claude Code CLI for enhanced IDE features')}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-sm font-medium">{t('Enable Integration')}</span>
          <p className="text-xs text-muted-foreground">
            {t('Start WebSocket server for Claude Code connection')}
            {bridgePort && ` (Port: ${bridgePort})`}
          </p>
        </div>
        <Switch checked={claudeCodeIntegration.enabled} onCheckedChange={handleEnabledChange} />
      </div>

      {claudeCodeIntegration.enabled && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Selection Changed Debounce */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <span className="text-sm font-medium">{t('Debounce Time')}</span>
            <div className="space-y-1.5">
              <Select
                value={String(claudeCodeIntegration.selectionChangedDebounce)}
                onValueChange={(v) =>
                  setClaudeCodeIntegration({ selectionChangedDebounce: Number(v) })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue>{claudeCodeIntegration.selectionChangedDebounce}ms</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {debounceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('Delay before sending selection changes to Claude Code')}
              </p>
            </div>
          </div>

          {/* At Mentioned Keybinding */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <span className="text-sm font-medium mt-2">{t('Mention Shortcut')}</span>
            <div className="space-y-1.5">
              <KeybindingInput
                value={claudeCodeIntegration.atMentionedKeybinding}
                onChange={(binding) => setClaudeCodeIntegration({ atMentionedKeybinding: binding })}
              />
              <p className="text-xs text-muted-foreground">
                {t('Send selected code range to Claude Code')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Commit Message Generator Section */}
      <div className="mt-6 border-t pt-6">
        <div>
          <h3 className="text-lg font-medium">{t('Commit Message Generator')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Auto-generate commit messages using Claude')}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">{t('Enable Generator')}</span>
            <p className="text-xs text-muted-foreground">
              {t('Generate commit messages with AI assistance')}
            </p>
          </div>
          <Switch
            checked={commitMessageGenerator.enabled}
            onCheckedChange={(checked) => setCommitMessageGenerator({ enabled: checked })}
          />
        </div>

        {commitMessageGenerator.enabled && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Max Diff Lines */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Max Diff Lines')}</span>
              <div className="space-y-1.5">
                <Input
                  type="number"
                  value={commitMessageGenerator.maxDiffLines}
                  onChange={(e) =>
                    setCommitMessageGenerator({ maxDiffLines: Number(e.target.value) || 1000 })
                  }
                  min={100}
                  max={10000}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  {t('Maximum number of diff lines to include')}
                </p>
              </div>
            </div>

            {/* Timeout */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Timeout')}</span>
              <div className="space-y-1.5">
                <Select
                  value={String(commitMessageGenerator.timeout)}
                  onValueChange={(v) => setCommitMessageGenerator({ timeout: Number(v) })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue>{commitMessageGenerator.timeout}s</SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {[30, 60, 120, 180].map((sec) => (
                      <SelectItem key={sec} value={String(sec)}>
                        {sec}s
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">{t('Timeout in seconds')}</p>
              </div>
            </div>

            {/* Model */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Model')}</span>
              <div className="space-y-1.5">
                <Select
                  value={commitMessageGenerator.model ?? 'haiku'}
                  onValueChange={(v) =>
                    setCommitMessageGenerator({
                      model: v as 'default' | 'opus' | 'sonnet' | 'haiku',
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue>
                      {(commitMessageGenerator.model ?? 'haiku') === 'default'
                        ? t('Default')
                        : (commitMessageGenerator.model ?? 'haiku').charAt(0).toUpperCase() +
                          (commitMessageGenerator.model ?? 'haiku').slice(1)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="haiku">Haiku</SelectItem>
                    <SelectItem value="sonnet">Sonnet</SelectItem>
                    <SelectItem value="opus">Opus</SelectItem>
                    <SelectItem value="default">{t('Default')}</SelectItem>
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('Claude model for generating commit messages')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Code Review Section */}
      <div className="mt-6 border-t pt-6">
        <div>
          <h3 className="text-lg font-medium">{t('Code Review')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('AI-powered code review for staged changes')}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">{t('Enable Code Review')}</span>
            <p className="text-xs text-muted-foreground">
              {t('Show code review button in source control')}
            </p>
          </div>
          <Switch
            checked={codeReview.enabled}
            onCheckedChange={(checked) => setCodeReview({ enabled: checked })}
          />
        </div>

        {codeReview.enabled && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Model */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Model')}</span>
              <div className="space-y-1.5">
                <Select
                  value={codeReview.model}
                  onValueChange={(v) => setCodeReview({ model: v as 'opus' | 'sonnet' | 'haiku' })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue>
                      {codeReview.model.charAt(0).toUpperCase() + codeReview.model.slice(1)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="haiku">Haiku</SelectItem>
                    <SelectItem value="sonnet">Sonnet</SelectItem>
                    <SelectItem value="opus">Opus</SelectItem>
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">{t('Claude model for code review')}</p>
              </div>
            </div>

            {/* Language */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <span className="text-sm font-medium">{t('Language')}</span>
              <div className="space-y-1.5">
                <Input
                  value={codeReview.language ?? '中文'}
                  onChange={(e) => setCodeReview({ language: e.target.value })}
                  placeholder="中文"
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  {t('Language for code review output')}
                </p>
              </div>
            </div>

            {/* Continue Conversation */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">{t('Continue Conversation')}</span>
                <p className="text-xs text-muted-foreground">
                  {t('Preserve session for follow-up conversations after review')}
                </p>
              </div>
              <Switch
                checked={codeReview.continueConversation ?? true}
                onCheckedChange={(checked) => setCodeReview({ continueConversation: checked })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
