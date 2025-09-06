import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionHandler } from '../../src/handlers/session-handler';
import { RepositoryManager } from '../../src/core/repository-manager';
import { SessionClient } from '../../src/core/session-client';

// Mock the dependencies
jest.mock('../../src/core/repository-manager');
jest.mock('../../src/core/session-client');
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
}));

describe('SessionHandler', () => {
  let handler: SessionHandler;
  let mockRepositoryManager: jest.Mocked<RepositoryManager>;
  let mockSessionClient: jest.Mocked<SessionClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    mockRepositoryManager = new RepositoryManager() as jest.Mocked<RepositoryManager>;
    mockSessionClient = new SessionClient() as jest.Mocked<SessionClient>;
    
    handler = new SessionHandler(mockRepositoryManager, mockSessionClient);
  });

  describe('startSession', () => {
    it('should successfully start a session with valid arguments', async () => {
      const testSessionId = 'test-session-123';
      (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue('/test/repo');
      (mockSessionClient as any).startSession = (jest.fn() as any).mockResolvedValue(testSessionId);

      const result = await handler.startSession({
        repo: 'test-repo',
        description: 'Testing session',
      });

      expect(result.content[0].text).toContain('Session started successfully');
      expect(result.content[0].text).toContain(testSessionId);
      expect(mockRepositoryManager.resolveRepoPath).toHaveBeenCalledWith('test-repo');
      expect(mockSessionClient.startSession).toHaveBeenCalledWith({
        repoPath: '/test/repo',
        aiTool: 'MCP Client',
        description: 'Testing session',
      });
    });

    it('should return error when repo is missing', async () => {
      const result = await handler.startSession({
        description: 'Testing session',
      });

      expect(result.content[0].text).toContain('Error: Both "repo" and "description" are required');
      expect(mockRepositoryManager.resolveRepoPath).not.toHaveBeenCalled();
      expect(mockSessionClient.startSession).not.toHaveBeenCalled();
    });

    it('should return error when description is missing', async () => {
      const result = await handler.startSession({
        repo: 'test-repo',
      });

      expect(result.content[0].text).toContain('Error: Both "repo" and "description" are required');
      expect(mockRepositoryManager.resolveRepoPath).not.toHaveBeenCalled();
      expect(mockSessionClient.startSession).not.toHaveBeenCalled();
    });

    it('should return error when both parameters are missing', async () => {
      const result = await handler.startSession({});

      expect(result.content[0].text).toContain('Error: Both "repo" and "description" are required');
    });

    it('should return error when null is passed', async () => {
      const result = await handler.startSession(null);

      expect(result.content[0].text).toContain('Error: Both "repo" and "description" are required');
    });

    it('should return error when repository is not found', async () => {
      (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue(null);

      const result = await handler.startSession({
        repo: 'non-existent',
        description: 'Testing session',
      });

      expect(result.content[0].text).toContain("Error: Repository 'non-existent' not found");
      expect(result.content[0].text).toContain('Use list_repos()');
      expect(mockSessionClient.startSession).not.toHaveBeenCalled();
    });

    it('should handle Session API being offline gracefully', async () => {
      (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue('/test/repo');
      (mockSessionClient as any).startSession = (jest.fn() as any).mockResolvedValue(null);

      const result = await handler.startSession({
        repo: 'test-repo',
        description: 'Testing session',
      });

      expect(result.content[0].text).toContain('Session API is offline');
      expect(result.content[0].text).toContain('Proceeding without session tracking');
    });

    it('should include helpful instructions in success message', async () => {
      const testSessionId = 'test-session-456';
      (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue('/test/repo');
      (mockSessionClient as any).startSession = (jest.fn() as any).mockResolvedValue(testSessionId);

      const result = await handler.startSession({
        repo: 'test-repo',
        description: 'Testing session',
      });

      expect(result.content[0].text).toContain('📋 **Your Workflow Checklist:**');
      expect(result.content[0].text).toContain('Session started successfully');
      expect(result.content[0].text).toContain('checkpoint()');
      expect(result.content[0].text).toContain('end_session()');
    });

    it('should handle non-string repo parameter', async () => {
      const result = await handler.startSession({
        repo: 123 as any,
        description: 'Testing session',
      });

      expect(result.content[0].text).toContain('Error: Both "repo" and "description" are required');
    });

    it('should handle non-string description parameter', async () => {
      const result = await handler.startSession({
        repo: 'test-repo',
        description: true as any,
      });

      expect(result.content[0].text).toContain('Error: Both "repo" and "description" are required');
    });
  });

  describe('endSession', () => {
    it('should successfully end a session with sessionId and commitHash', async () => {
      (mockSessionClient as any).endSession = (jest.fn() as any).mockResolvedValue(true);

      const result = await handler.endSession({
        sessionId: 'test-session-123',
        commitHash: 'abc1234',
      });

      expect(result.content[0].text).toContain('Session test-session-123 ended successfully');
      expect(mockSessionClient.endSession).toHaveBeenCalledWith('test-session-123', 'abc1234');
    });

    it('should successfully end a session with only sessionId', async () => {
      // Create a fresh mock to avoid pollution from previous tests
      const freshMockClient = new SessionClient() as jest.Mocked<SessionClient>;
      (freshMockClient as any).endSession = (jest.fn() as any).mockResolvedValue(true);
      const freshHandler = new SessionHandler(mockRepositoryManager, freshMockClient);

      const result = await freshHandler.endSession({
        sessionId: 'test-session-456',
      });

      expect(result.content[0].text).toContain('Session test-session-456 ended successfully');
      expect(freshMockClient.endSession).toHaveBeenCalledWith('test-session-456', undefined);
    });

    it('should return error when sessionId is missing', async () => {
      const result = await handler.endSession({
        commitHash: 'abc1234',
      });

      expect(result.content[0].text).toContain('Error: "sessionId" is required');
      expect(mockSessionClient.endSession).not.toHaveBeenCalled();
    });

    it('should return error when arguments are missing', async () => {
      const result = await handler.endSession({});

      expect(result.content[0].text).toContain('Error: "sessionId" is required');
    });

    it('should return error when null is passed', async () => {
      const result = await handler.endSession(null);

      expect(result.content[0].text).toContain('Error: "sessionId" is required');
    });

    it('should handle session not found or already ended', async () => {
      (mockSessionClient as any).endSession = (jest.fn() as any).mockResolvedValue(false);

      const result = await handler.endSession({
        sessionId: 'invalid-session',
      });

      expect(result.content[0].text).toContain('Failed to End Session');
      expect(result.content[0].text).toContain('may have already ended or expired');
    });

    it('should handle non-string sessionId parameter', async () => {
      const result = await handler.endSession({
        sessionId: 123 as any,
      });

      expect(result.content[0].text).toContain('Error: "sessionId" is required');
    });

    it('should handle Session API error gracefully', async () => {
      // SessionClient.endSession returns false on error, not a rejected promise
      const errorMockClient = new SessionClient() as jest.Mocked<SessionClient>;
      (errorMockClient as any).endSession = (jest.fn() as any).mockResolvedValue(false);
      const errorHandler = new SessionHandler(mockRepositoryManager, errorMockClient);

      const result = await errorHandler.endSession({
        sessionId: 'test-session-789',
      });

      // Should handle the error and return false
      expect(result.content[0].text).toContain('Failed to End Session');
      expect(result.content[0].text).toContain('may have already ended or expired');
    });

    it('should pass optional commitHash to SessionClient', async () => {
      (mockSessionClient as any).endSession = (jest.fn() as any).mockResolvedValue(true);

      await handler.endSession({
        sessionId: 'test-session-999',
        commitHash: 'def5678',
      });

      expect(mockSessionClient.endSession).toHaveBeenCalledWith('test-session-999', 'def5678');
    });

    it('should not pass commitHash when not provided', async () => {
      (mockSessionClient as any).endSession = (jest.fn() as any).mockResolvedValue(true);

      await handler.endSession({
        sessionId: 'test-session-888',
      });

      expect(mockSessionClient.endSession).toHaveBeenCalledWith('test-session-888', undefined);
    });
  });
});