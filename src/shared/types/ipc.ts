export const IPC_CHANNELS = {
  // Git
  GIT_STATUS: 'git:status',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_BRANCH_LIST: 'git:branch:list',
  GIT_BRANCH_CREATE: 'git:branch:create',
  GIT_BRANCH_CHECKOUT: 'git:branch:checkout',
  GIT_LOG: 'git:log',
  GIT_DIFF: 'git:diff',

  // Worktree
  WORKTREE_LIST: 'worktree:list',
  WORKTREE_ADD: 'worktree:add',
  WORKTREE_REMOVE: 'worktree:remove',

  // Files
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_LIST: 'file:list',
  FILE_WATCH_START: 'file:watch:start',
  FILE_WATCH_STOP: 'file:watch:stop',
  FILE_CHANGE: 'file:change',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DESTROY: 'terminal:destroy',
  TERMINAL_DATA: 'terminal:data',

  // Agent
  AGENT_LIST: 'agent:list',
  AGENT_START: 'agent:start',
  AGENT_STOP: 'agent:stop',
  AGENT_SEND: 'agent:send',
  AGENT_MESSAGE: 'agent:message',

  // Database
  DB_QUERY: 'db:query',
  DB_EXECUTE: 'db:execute',

  // App
  APP_GET_PATH: 'app:getPath',
  APP_UPDATE_AVAILABLE: 'app:updateAvailable',

  // Dialog
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',
  DIALOG_OPEN_FILE: 'dialog:openFile',

  // Context Menu
  CONTEXT_MENU_SHOW: 'contextMenu:show',

  // App Detector
  APP_DETECT: 'app:detect',
  APP_OPEN_WITH: 'app:openWith',
  APP_GET_ICON: 'app:getIcon',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
