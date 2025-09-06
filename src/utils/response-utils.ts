/**
 * Utility functions for creating consistent MCPToolResponse objects
 */

import type { MCPToolResponse } from '../types';

/**
 * Create a text response for MCP tools
 */
export function createTextResponse(text: string): MCPToolResponse {
  return {
    content: [
      {
        type: 'text',
        text
      }
    ]
  };
}

/**
 * Create an error response for MCP tools
 */
export function createErrorResponse(error: string, details?: string): MCPToolResponse {
  const message = details ? `${error}\n\n${details}` : error;
  return {
    content: [
      {
        type: 'text',
        text: message
      }
    ],
    success: false
  };
}

/**
 * Format a list of repositories for display
 */
export function formatRepositoryList(repos: Array<{ name: string; path: string }>): string {
  if (repos.length === 0) {
    return 'No repositories available.';
  }
  return repos.map(r => `  ${r.name}:\n    Path: ${r.path}`).join('\n\n');
}

/**
 * Create repository not found error response
 */
export function createRepoNotFoundResponse(repoName: string, availableRepos: Array<{ name: string; path: string }>): MCPToolResponse {
  let errorMsg = `Error: Repository '${repoName}' not found.`;
  
  if (availableRepos.length > 0) {
    errorMsg += `\n\nAvailable repositories:\n${formatRepositoryList(availableRepos)}`;
  } else {
    errorMsg += '\n\nNo repositories found. Please add repositories to ShadowGit first.';
  }
  
  return createErrorResponse(errorMsg);
}