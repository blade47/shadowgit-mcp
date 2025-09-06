/**
 * HTTP client for ShadowGit Session API
 * Provides session lifecycle management for AI tools
 */

import { log } from '../utils/logger';
import { SESSION_API_URL, SESSION_API_TIMEOUT } from '../utils/constants';
import type { 
  SessionStartRequest, 
  SessionStartResponse, 
  SessionEndRequest, 
  SessionEndResponse 
} from '../types';

export class SessionClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl = SESSION_API_URL, timeout = SESSION_API_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Start a new AI session for a repository
   */
  async startSession(data: SessionStartRequest): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json() as SessionStartResponse;
        if (result.success && result.sessionId) {
          log('info', `Session started: ${result.sessionId} for ${data.repoPath}`);
          return result.sessionId;
        }
      }
      
      log('warn', `Failed to start session: ${response.status} ${response.statusText}`);
    } catch (error) {
      // Silently fail - don't break MCP if Session API is down
      if (error instanceof Error && error.name !== 'AbortError') {
        log('debug', `Session API unavailable: ${error.message}`);
      }
    }
    return null;
  }

  /**
   * End an AI session with optional commit hash
   */
  async endSession(sessionId: string, commitHash?: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const data: SessionEndRequest = { sessionId };
      if (commitHash) {
        data.commitHash = commitHash;
      }

      const response = await fetch(`${this.baseUrl}/session/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json() as SessionEndResponse;
        if (result.success) {
          log('info', `Session ended: ${sessionId}`);
          return true;
        }
      }
      
      log('warn', `Failed to end session: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        log('debug', `Failed to end session: ${error.message}`);
      }
    }
    return false;
  }

  /**
   * Check if Session API is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // Quick health check

      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}