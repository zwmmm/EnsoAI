export type BuiltinAgentId = 'claude' | 'codex' | 'droid' | 'gemini' | 'auggie' | 'cursor';

export type AgentEnvironment = 'native' | 'wsl' | 'hapi';

export interface AgentCliInfo {
  id: string;
  name: string;
  command: string;
  installed: boolean;
  version?: string;
  isBuiltin: boolean;
  environment?: AgentEnvironment;
}

export interface CustomAgent {
  id: string;
  name: string;
  command: string;
  description?: string;
}

export interface AgentCliStatus {
  agents: AgentCliInfo[];
}
