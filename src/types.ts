/**
 * Type definitions for ShadowGit MCP Server
 */

export interface Repository {
  name: string;
  path: string;
}

export interface GitCommandArgs {
  repo: string;
  command: string;
}

export interface ManualCheckpointArgs {
  repo: string;
  title: string;
  message?: string;
  author?: string;
}

// MCP Tool Response format
export type MCPToolResponse = {
  content: Array<{
    type: string;
    text: string;
  }>;
  success?: boolean;  // Optional flag to indicate if the operation was successful
};

// Session API types
export interface SessionStartRequest {
  repoPath: string;
  aiTool: string;
  description: string;
}

export interface SessionStartResponse {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface SessionEndRequest {
  sessionId: string;
  commitHash?: string;
}

export interface SessionEndResponse {
  success: boolean;
  error?: string;
}