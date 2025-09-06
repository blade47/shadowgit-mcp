/**
 * Handler for session management - start and end sessions
 */

import { RepositoryManager } from '../core/repository-manager';
import { SessionClient } from '../core/session-client';
import { log } from '../utils/logger';
import { createErrorResponse } from '../utils/response-utils';
import type { MCPToolResponse } from '../types';

interface StartSessionArgs {
  repo: string;
  description: string;
}

interface EndSessionArgs {
  sessionId: string;
  commitHash?: string;
}

export class SessionHandler {
  constructor(
    private repositoryManager: RepositoryManager,
    private sessionClient: SessionClient
  ) {}

  /**
   * Start a new work session
   */
  async startSession(args: unknown): Promise<MCPToolResponse> {
    // Validate args
    if (!this.isStartSessionArgs(args)) {
      return createErrorResponse(
        'Error: Both "repo" and "description" are required for start_session.'
      );
    }

    // Resolve repository
    const repoPath = this.repositoryManager.resolveRepoPath(args.repo);
    if (!repoPath) {
      return createErrorResponse(
        `Error: Repository '${args.repo}' not found. Use list_repos() to see available repositories.`
      );
    }

    // Start session
    const sessionId = await this.sessionClient.startSession({
      repoPath,
      aiTool: 'MCP Client',
      description: args.description
    });

    if (sessionId) {
      log('info', `Session started: ${sessionId}`);
      return {
        content: [{
          type: 'text',
          text: `Session started successfully.
Session ID: ${sessionId}

📋 **Your Workflow Checklist:**
1. Make your changes
2. Call checkpoint() to commit
3. Call end_session() with this session ID`
        }]
      };
    }

    // Fallback if Session API is offline
    return createErrorResponse(
      'Session API is offline. Proceeding without session tracking.'
    );
  }

  /**
   * End an active session
   */
  async endSession(args: unknown): Promise<MCPToolResponse> {
    // Validate args
    if (!this.isEndSessionArgs(args)) {
      return createErrorResponse(
        'Error: "sessionId" is required for end_session.'
      );
    }

    // End session
    const success = await this.sessionClient.endSession(
      args.sessionId,
      args.commitHash
    );

    if (success) {
      log('info', `Session ended: ${args.sessionId}`);
      return {
        content: [{
          type: 'text',
          text: `Session ${args.sessionId} ended successfully.`
        }]
      };
    }

    return createErrorResponse(
      `❌ **Failed to End Session**
${'='.repeat(50)}

⚠️ The session may have already ended or expired.

**Note:** Auto-commits may have already resumed.

💡 **NEXT STEP:** You can continue working or start a new session.`
    );
  }

  private isStartSessionArgs(args: unknown): args is StartSessionArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      'repo' in args &&
      'description' in args &&
      typeof (args as StartSessionArgs).repo === 'string' &&
      typeof (args as StartSessionArgs).description === 'string'
    );
  }

  private isEndSessionArgs(args: unknown): args is EndSessionArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      'sessionId' in args &&
      typeof (args as EndSessionArgs).sessionId === 'string'
    );
  }
}