import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from '@/components/ui/select';
import {
  MessageSquare,
  FileCode,
  Terminal,
  GitBranch,
  Plus,
  Sparkles,
  Paperclip,
  Mic,
  ArrowUp,
  FolderOpen,
} from 'lucide-react';
import { OpenInMenu } from '@/components/app/OpenInMenu';

const buttonVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0, opacity: 0 },
};

type TabId = 'chat' | 'file' | 'terminal' | 'source-control';

interface MainContentProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  workspaceName?: string;
  worktreePath?: string;
  workspaceCollapsed?: boolean;
  worktreeCollapsed?: boolean;
  onExpandWorkspace?: () => void;
  onExpandWorktree?: () => void;
}

const tabs: Array<{ id: TabId; icon: React.ElementType; label: string }> = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'file', icon: FileCode, label: 'File' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
  { id: 'source-control', icon: GitBranch, label: 'Source Control' },
];

export function MainContent({
  activeTab,
  onTabChange,
  workspaceName,
  worktreePath,
  workspaceCollapsed = false,
  worktreeCollapsed = false,
  onExpandWorkspace,
  onExpandWorktree,
}: MainContentProps) {
  // Need extra padding for traffic lights when both panels are collapsed
  const needsTrafficLightPadding = workspaceCollapsed && worktreeCollapsed;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header with tabs */}
      <header className={cn(
        "flex h-12 shrink-0 items-center justify-between border-b px-4 drag-region",
        needsTrafficLightPadding && "pl-[70px]"
      )}>
        {/* Left: Expand buttons + Tabs */}
        <div className="flex items-center gap-1 no-drag">
          {/* Expand buttons when panels are collapsed */}
          <AnimatePresence>
            {worktreeCollapsed && (
              <>
                {/* Left separator */}
                {needsTrafficLightPadding && (
                  <motion.div
                    key="left-sep"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-1 h-4 w-px bg-border"
                  />
                )}
                {/* Workspace expand button - shown when both panels are collapsed */}
                {workspaceCollapsed && onExpandWorkspace && (
                  <motion.button
                    key="expand-workspace"
                    variants={buttonVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    onClick={onExpandWorkspace}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                    title="展开 Workspace"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </motion.button>
                )}
                {/* Worktree expand button */}
                {onExpandWorktree && (
                  <motion.button
                    key="expand-worktree"
                    variants={buttonVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.05 }}
                    onClick={onExpandWorktree}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                    title="展开 Worktree"
                  >
                    <GitBranch className="h-4 w-4" />
                  </motion.button>
                )}
                {/* Right separator */}
                <motion.div
                  key="right-sep"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mx-1 h-4 w-px bg-border"
                />
              </>
            )}
          </AnimatePresence>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
                activeTab === tab.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
          <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Right: Open In Menu */}
        <div className="flex items-center gap-2 no-drag">
          <OpenInMenu path={worktreePath} />
        </div>
      </header>

      {/* Session info bar */}
      {worktreePath && (
        <div className="flex h-8 items-center border-b px-4 text-xs text-muted-foreground">
          Session started with Claude in {worktreePath}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'file' && <FilePlaceholder />}
        {activeTab === 'terminal' && <TerminalPlaceholder />}
        {activeTab === 'source-control' && <SourceControlPlaceholder />}
      </div>
    </main>
  );
}

function ChatView() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Chat history */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <p>chat history</p>
        </div>
      </div>

      {/* Chat input */}
      <div className="shrink-0 border-t p-4">
        <div className="mx-auto max-w-3xl">
          {/* Model selector */}
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Claude</span>
            <span>·</span>
            <span>Default</span>
          </div>

          {/* Input box */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Select defaultValue="default">
                <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  <SelectValue>Default (recommended)</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="default">Default (recommended)</SelectItem>
                  <SelectItem value="precise">Precise</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectPopup>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Mic className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-8 w-8 shrink-0 rounded-full">
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilePlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <p>File Explorer - Phase 4</p>
    </div>
  );
}

function TerminalPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <p>Terminal - Phase 5</p>
    </div>
  );
}

function SourceControlPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <p>Source Control - Coming Soon</p>
    </div>
  );
}
