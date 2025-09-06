/**
 * Simple logging utility for ShadowGit MCP Server
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.SHADOWGIT_LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;

export const log = (level: LogLevel, message: string): void => {
  if (LOG_LEVELS[level] >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    process.stderr.write(`[${timestamp}] [shadowgit-mcp] [${level.toUpperCase()}] ${message}\n`);
  }
};