import { useCallback, useEffect, useRef, useState } from 'react';
import { useXterm } from '@/hooks/useXterm';
import { useSettingsStore } from '@/stores/settings';
import { TerminalSearchBar, type TerminalSearchBarRef } from './TerminalSearchBar';

interface ShellTerminalProps {
  cwd?: string;
  isActive?: boolean;
  onExit?: () => void;
  onTitleChange?: (title: string) => void;
}

export function ShellTerminal({
  cwd,
  isActive = false,
  onExit,
  onTitleChange,
}: ShellTerminalProps) {
  const {
    containerRef,
    isLoading,
    settings,
    findNext,
    findPrevious,
    clearSearch,
    terminal,
    clear,
  } = useXterm({
    cwd,
    isActive,
    onExit,
    onTitleChange,
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBarRef = useRef<TerminalSearchBarRef>(null);
  const terminalKeybindings = useSettingsStore((state) => state.terminalKeybindings);

  // Check if a keyboard event matches a keybinding
  const matchesKeybinding = useCallback(
    (
      e: KeyboardEvent,
      binding: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }
    ) => {
      const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();
      const ctrlMatch = binding.ctrl !== undefined ? e.ctrlKey === binding.ctrl : true;
      const altMatch = binding.alt !== undefined ? e.altKey === binding.alt : true;
      const shiftMatch = binding.shift !== undefined ? e.shiftKey === binding.shift : true;
      const metaMatch = binding.meta !== undefined ? e.metaKey === binding.meta : true;

      return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
    },
    []
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        if (isSearchOpen) {
          searchBarRef.current?.focus();
        } else {
          setIsSearchOpen(true);
        }
        return;
      }

      // Clear terminal shortcut
      if (matchesKeybinding(e, terminalKeybindings.clear)) {
        e.preventDefault();
        clear();
        return;
      }
    },
    [isSearchOpen, terminalKeybindings, matchesKeybinding, clear]
  );

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault();

      const selectedId = await window.electronAPI.contextMenu.show([
        { id: 'clear', label: '清除终端' },
        { id: 'separator-1', label: '', type: 'separator' },
        { id: 'copy', label: '复制', disabled: !terminal?.hasSelection() },
        { id: 'paste', label: '粘贴' },
        { id: 'selectAll', label: '全选' },
      ]);

      if (!selectedId) return;

      switch (selectedId) {
        case 'clear':
          clear();
          break;
        case 'copy':
          if (terminal?.hasSelection()) {
            const selection = terminal.getSelection();
            navigator.clipboard.writeText(selection);
          }
          break;
        case 'paste':
          navigator.clipboard.readText().then((text) => {
            terminal?.paste(text);
          });
          break;
        case 'selectAll':
          terminal?.selectAll();
          break;
      }
    },
    [terminal, clear]
  );

  useEffect(() => {
    if (!isActive) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleKeyDown]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isActive) return;

    container.addEventListener('contextmenu', handleContextMenu);
    return () => container.removeEventListener('contextmenu', handleContextMenu);
  }, [isActive, handleContextMenu, containerRef]);

  return (
    <div className="relative h-full w-full" style={{ backgroundColor: settings.theme.background }}>
      <div ref={containerRef} className="h-full w-full px-[5px] py-[2px]" />
      <TerminalSearchBar
        ref={searchBarRef}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onFindNext={findNext}
        onFindPrevious={findPrevious}
        onClearSearch={clearSearch}
        theme={settings.theme}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
              style={{ color: settings.theme.foreground, opacity: 0.5 }}
            />
            <span style={{ color: settings.theme.foreground, opacity: 0.5 }} className="text-sm">
              Starting shell...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
