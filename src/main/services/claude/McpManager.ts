import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  McpHttpConfig,
  McpHttpServer,
  McpServer,
  McpServerConfig,
  McpStdioConfig,
  McpStdioServer,
} from '@shared/types';
import { isHttpMcpConfig, isHttpMcpServer, isStdioMcpServer } from '@shared/types';

function getClaudeJsonPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

interface ClaudeJson {
  mcpServers?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

/**
 * 读取 ~/.claude.json
 */
function readClaudeJson(): ClaudeJson {
  try {
    const jsonPath = getClaudeJsonPath();
    if (!fs.existsSync(jsonPath)) {
      return {};
    }
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content) as ClaudeJson;
  } catch (error) {
    console.error('[McpManager] Failed to read .claude.json:', error);
    return {};
  }
}

/**
 * 写入 ~/.claude.json
 */
function writeClaudeJson(data: ClaudeJson): boolean {
  try {
    const jsonPath = getClaudeJsonPath();
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    return true;
  } catch (error) {
    console.error('[McpManager] Failed to write .claude.json:', error);
    return false;
  }
}

/**
 * 读取当前 MCP 服务器配置
 */
export function readMcpServers(): Record<string, McpServerConfig> {
  const data = readClaudeJson();
  return data.mcpServers ?? {};
}

/**
 * 将配置转换为 McpServer
 */
function configToServer(id: string, config: McpServerConfig): McpServer {
  if (isHttpMcpConfig(config)) {
    return {
      id,
      name: id,
      transportType: config.type,
      url: config.url,
      headers: config.headers,
      enabled: true,
    } as McpHttpServer;
  }
  return {
    id,
    name: id,
    transportType: 'stdio',
    command: config.command,
    args: config.args,
    env: config.env,
    enabled: true,
  } as McpStdioServer;
}

/**
 * 将 McpServer 转换为配置
 * 兼容旧数据：没有 transportType 但有 command 的服务器视为 stdio 类型
 */
function serverToConfig(server: McpServer): McpServerConfig | null {
  if (isHttpMcpServer(server)) {
    return {
      type: server.transportType,
      url: server.url,
      ...(server.headers && Object.keys(server.headers).length > 0 && { headers: server.headers }),
    } as McpHttpConfig;
  }
  // 兼容旧数据：检查 command 字段是否存在
  const command = isStdioMcpServer(server)
    ? server.command
    : (server as { command?: string }).command;
  if (!command) {
    return null;
  }
  return {
    command,
    ...(server.args && server.args.length > 0 && { args: server.args }),
    ...(server.env && Object.keys(server.env).length > 0 && { env: server.env }),
  } as McpStdioConfig;
}

/**
 * 同步启用的 MCP 服务器到 ~/.claude.json
 * 只写入 enabled=true 的服务器
 * 注意：会保留原有的 HTTP/SSE 配置
 */
export function syncMcpServers(servers: McpServer[]): boolean {
  const data = readClaudeJson();
  const existingConfigs = data.mcpServers ?? {};

  // 构建 mcpServers 对象（只包含 enabled 的）
  const mcpServers: Record<string, McpServerConfig> = {};

  for (const server of servers) {
    if (!server.enabled) continue;

    // 检查原有配置，保留 HTTP/SSE 类型的完整配置
    const existingConfig = existingConfigs[server.id];
    if (existingConfig && isHttpMcpConfig(existingConfig)) {
      // 对于 HTTP/SSE 类型，保留原有配置
      mcpServers[server.id] = existingConfig;
    } else {
      // 对于 stdio 类型，使用 server 数据
      const config = serverToConfig(server);
      if (config) {
        mcpServers[server.id] = config;
      } else if (existingConfig) {
        // 如果转换失败但存在原配置，保留原配置
        mcpServers[server.id] = existingConfig;
      }
    }
  }

  data.mcpServers = mcpServers;
  const success = writeClaudeJson(data);

  if (success) {
    console.log(`[McpManager] Synced ${Object.keys(mcpServers).length} MCP servers`);
  }

  return success;
}

/**
 * 添加或更新单个 MCP 服务器
 * 保留现有配置，只修改指定的服务器
 */
export function upsertMcpServer(server: McpServer): boolean {
  const data = readClaudeJson();

  if (!data.mcpServers) {
    data.mcpServers = {};
  }

  const existingConfig = data.mcpServers[server.id];

  if (server.enabled) {
    // 检查是否已存在 HTTP/SSE 类型的配置
    if (existingConfig && isHttpMcpConfig(existingConfig)) {
      // HTTP/SSE 类型，保留原有配置不修改
      // 因为这类配置需要通过 claude mcp 命令管理
      data.mcpServers[server.id] = existingConfig;
    } else {
      // 转换 server 为配置（serverToConfig 已兼容旧数据）
      const config = serverToConfig(server);
      if (config) {
        data.mcpServers[server.id] = config;
      } else if (existingConfig) {
        // 转换失败但存在原配置，保留原配置
        data.mcpServers[server.id] = existingConfig;
      }
      // 如果转换失败且无原配置，不写入
    }
  } else {
    // 如果禁用了，从配置中移除
    delete data.mcpServers[server.id];
  }

  return writeClaudeJson(data);
}

/**
 * 删除 MCP 服务器
 */
export function deleteMcpServer(serverId: string): boolean {
  const data = readClaudeJson();

  if (data.mcpServers) {
    delete data.mcpServers[serverId];
  }

  return writeClaudeJson(data);
}

// Re-export utility functions
export { configToServer, serverToConfig };
