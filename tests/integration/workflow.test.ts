import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RepositoryManager } from '../../src/core/repository-manager';
import { GitExecutor } from '../../src/core/git-executor';
import { SessionClient } from '../../src/core/session-client';
import { GitHandler } from '../../src/handlers/git-handler';
import { ListReposHandler } from '../../src/handlers/list-repos-handler';
import { CheckpointHandler } from '../../src/handlers/checkpoint-handler';
import { SessionHandler } from '../../src/handlers/session-handler';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';

// Mock all external dependencies
jest.mock('fs');
jest.mock('os');
jest.mock('child_process');
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
}));

// Mock fetch for SessionClient
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('Integration: Complete Workflow', () => {
  let repositoryManager: RepositoryManager;
  let gitExecutor: GitExecutor;
  let sessionClient: SessionClient;
  let gitHandler: GitHandler;
  let listReposHandler: ListReposHandler;
  let checkpointHandler: CheckpointHandler;
  let sessionHandler: SessionHandler;
  
  let mockExistsSync: jest.MockedFunction<typeof fs.existsSync>;
  let mockReadFileSync: jest.MockedFunction<typeof fs.readFileSync>;
  let mockHomedir: jest.MockedFunction<typeof os.homedir>;
  let mockExecFileSync: jest.MockedFunction<typeof execFileSync>;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mock references
    mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
    mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Setup default mocks
    mockHomedir.mockReturnValue('/home/testuser');
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([
      { name: 'my-project', path: '/workspace/my-project' },
      { name: 'another-project', path: '/workspace/another-project' },
    ]));
    
    // Initialize services
    repositoryManager = new RepositoryManager();
    gitExecutor = new GitExecutor();
    sessionClient = new SessionClient();
    
    // Initialize handlers
    gitHandler = new GitHandler(repositoryManager, gitExecutor);
    listReposHandler = new ListReposHandler(repositoryManager);
    checkpointHandler = new CheckpointHandler(repositoryManager, gitExecutor);
    sessionHandler = new SessionHandler(repositoryManager, sessionClient);
  });

  describe('Scenario: Complete AI Work Session with Session API Available', () => {
    it('should complete full workflow: list → start_session → git_command → checkpoint → end_session', async () => {
      const sessionId = 'session-123-abc';
      const commitHash = 'abc1234';
      
      // Step 1: List repositories
      const listResult = await listReposHandler.handle();
      expect(listResult.content[0].text).toContain('my-project:');
      expect(listResult.content[0].text).toContain('Path: /workspace/my-project');
      expect(listResult.content[0].text).toContain('another-project:');
      expect(listResult.content[0].text).toContain('Path: /workspace/another-project');
      
      // Step 2: Start session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          success: true,
          sessionId,
        }),
      } as unknown as Response);
      
      const startResult = await sessionHandler.startSession({
        repo: 'my-project',
        description: 'Implementing new feature X',
      });
      
      expect(startResult.content[0].text).toContain('Session started successfully');
      expect(startResult.content[0].text).toContain(sessionId);
      
      // Step 3: Execute git commands
      mockExecFileSync.mockReturnValue('On branch main\nYour branch is up to date');
      
      const statusResult = await gitHandler.handle({
        repo: 'my-project',
        command: 'status',
      });
      
      expect(statusResult.content[0].text).toContain('On branch main');
      
      // Step 4: Simulate some changes and check diff
      mockExecFileSync.mockReturnValue('diff --git a/file.txt b/file.txt\n+new line');
      
      const diffResult = await gitHandler.handle({
        repo: 'my-project',
        command: 'diff',
      });
      
      expect(diffResult.content[0].text).toContain('diff --git');
      
      // Step 5: Create checkpoint
      mockExecFileSync
        .mockReturnValueOnce('M file.txt\nA newfile.js') // status --porcelain
        .mockReturnValueOnce('') // add -A
        .mockReturnValueOnce(`[main ${commitHash}] Add feature X`) // commit
        .mockReturnValueOnce('commit abc1234\nAuthor: Claude'); // show --stat
      
      const checkpointResult = await checkpointHandler.handle({
        repo: 'my-project',
        title: 'Add feature X',
        message: 'Implemented new feature X with comprehensive tests',
        author: 'Claude',
      });
      
      expect(checkpointResult.content[0].text).toContain('Checkpoint Created Successfully!');
      expect(checkpointResult.content[0].text).toContain(commitHash);
      
      // Step 6: End session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          success: true,
        }),
      } as unknown as Response);
      
      const endResult = await sessionHandler.endSession({
        sessionId,
        commitHash,
      });
      
      expect(endResult.content[0].text).toContain(`Session ${sessionId} ended successfully`);
    });
  });

  describe('Scenario: Session API Offline Fallback', () => {
    it('should handle workflow when Session API is unavailable', async () => {
      // Session API is offline
      mockFetch.mockRejectedValue(new Error('Connection refused'));
      
      // Step 1: Try to start session (should fallback gracefully)
      const startResult = await sessionHandler.startSession({
        repo: 'my-project',
        description: 'Fixing bug in authentication',
      });
      
      expect(startResult.content[0].text).toContain('Session API is offline');
      expect(startResult.content[0].text).toContain('Proceeding without session tracking');
      
      // Step 2: Continue with git operations
      mockExecFileSync.mockReturnValue('file.txt | 2 +-');
      
      const diffStatResult = await gitHandler.handle({
        repo: 'my-project',
        command: 'diff --stat',
      });
      
      expect(diffStatResult.content[0].text).toContain('file.txt | 2 +-');
      
      // Step 3: Create checkpoint (should work without session)
      mockExecFileSync
        .mockReturnValueOnce('M file.txt') // status
        .mockReturnValueOnce('') // add
        .mockReturnValueOnce('[main def5678] Fix auth bug') // commit
        .mockReturnValueOnce('commit def5678'); // show
      
      const checkpointResult = await checkpointHandler.handle({
        repo: 'my-project',
        title: 'Fix auth bug',
        author: 'GPT-4',
      });
      
      expect(checkpointResult.content[0].text).toContain('Checkpoint Created Successfully!');
      
      // Step 4: Try to end session (should handle gracefully)
      const endResult = await sessionHandler.endSession({
        sessionId: 'non-existent-session',
      });
      
      expect(endResult.content[0].text).toContain('Failed to End Session');
    });
  });

  describe('Scenario: Multiple AI Agents Collaboration', () => {
    it('should handle multiple agents working on different repositories', async () => {
      const sessions = [
        { id: 'claude-session-1', repo: 'my-project', agent: 'Claude' },
        { id: 'gpt4-session-2', repo: 'another-project', agent: 'GPT-4' },
      ];
      
      // Both agents start sessions
      for (const session of sessions) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: (jest.fn() as any).mockResolvedValue({
            success: true,
            sessionId: session.id,
          }),
        } as unknown as Response);
        
        const result = await sessionHandler.startSession({
          repo: session.repo,
          description: `${session.agent} working on ${session.repo}`,
        });
        
        expect(result.content[0].text).toContain(session.id);
      }
      
      // Each agent makes changes and creates checkpoints
      for (const session of sessions) {
        mockExecFileSync
          .mockReturnValueOnce('M file.txt') // status
          .mockReturnValueOnce('') // add
          .mockReturnValueOnce(`[main abc${session.id.slice(0, 4)}] ${session.agent} changes`) // commit
          .mockReturnValueOnce('commit details'); // show
        
        const checkpointResult = await checkpointHandler.handle({
          repo: session.repo,
          title: `${session.agent} changes`,
          author: session.agent,
        });
        
        expect(checkpointResult.content[0].text).toContain('Checkpoint Created Successfully!');
      }
      
      // Both agents end their sessions
      for (const session of sessions) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: (jest.fn() as any).mockResolvedValue({
            success: true,
          }),
        } as unknown as Response);
        
        const result = await sessionHandler.endSession({
          sessionId: session.id,
        });
        
        expect(result.content[0].text).toContain(`Session ${session.id} ended successfully`);
      }
    });
  });

  describe('Scenario: Error Recovery', () => {
    it('should handle errors at each stage gracefully', async () => {
      // Repository not found
      const invalidRepoResult = await gitHandler.handle({
        repo: 'non-existent-repo',
        command: 'log',
      });
      
      expect(invalidRepoResult.content[0].text).toContain("Error: Repository 'non-existent-repo' not found");
      
      // No .shadowgit.git directory
      mockExistsSync.mockImplementation(p => {
        if (typeof p === 'string' && p.includes('.shadowgit.git')) return false;
        if (typeof p === 'string' && p.includes('repos.json')) return true;
        return true;
      });
      
      const noShadowGitResult = await gitHandler.handle({
        repo: 'my-project',
        command: 'log',
      });
      
      expect(noShadowGitResult.content[0].text).toContain('not found');
      
      // Reset mock for next tests
      mockExistsSync.mockReturnValue(true);
      
      // Invalid git command
      mockExecFileSync.mockReturnValue('Error: Command not allowed');
      
      const invalidCommandResult = await gitHandler.handle({
        repo: 'my-project',
        command: 'push origin main',
      });
      
      expect(invalidCommandResult.content[0].text).toContain('not allowed');
      
      // No changes to commit
      mockExecFileSync.mockReturnValueOnce(''); // empty status
      
      const noChangesResult = await checkpointHandler.handle({
        repo: 'my-project',
        title: 'No changes',
        author: 'Claude',
      });
      
      expect(noChangesResult.content[0].text).toContain('No Changes Detected');
      
      // Git commit failure
      mockExecFileSync
        .mockReturnValueOnce('M file.txt') // status
        .mockReturnValueOnce('') // add
        .mockReturnValueOnce('Error: Cannot create commit'); // commit fails
      
      const commitFailResult = await checkpointHandler.handle({
        repo: 'my-project',
        title: 'Test',
        author: 'Claude',
      });
      
      expect(commitFailResult.content[0].text).toContain('Failed to Create Commit');
    });
  });

  describe('Scenario: Validation and Edge Cases', () => {
    it('should validate all required parameters', async () => {
      // Missing parameters for start_session
      let result = await sessionHandler.startSession({
        repo: 'my-project',
        // missing description
      });
      expect(result.content[0].text).toContain('Error');
      
      // Missing parameters for checkpoint
      result = await checkpointHandler.handle({
        repo: 'my-project',
        // missing title
      });
      expect(result.content[0].text).toContain('Error');
      
      // Title too long
      result = await checkpointHandler.handle({
        repo: 'my-project',
        title: 'a'.repeat(51),
      });
      expect(result.content[0].text).toContain('50 characters or less');
      
      // Message too long
      result = await checkpointHandler.handle({
        repo: 'my-project',
        title: 'Valid title',
        message: 'a'.repeat(1001),
      });
      expect(result.content[0].text).toContain('1000 characters or less');
    });
    
    it('should handle special characters in commit messages', async () => {
      mockExecFileSync
        .mockReturnValueOnce('M file.txt') // status
        .mockReturnValueOnce('') // add
        .mockReturnValueOnce('[main xyz789] Special') // commit
        .mockReturnValueOnce('commit xyz789'); // show
      
      const result = await checkpointHandler.handle({
        repo: 'my-project',
        title: 'Fix $pecial "bug" with `quotes`',
        message: 'Message with $var and backslash',
        author: 'AI-Agent',
      });
      
      expect(result.content[0].text).toContain('Checkpoint Created Successfully!');
      
      // Verify commit was called with correct arguments
      const commitCall = mockExecFileSync.mock.calls.find(
        call => Array.isArray(call[1]) && call[1].includes('commit')
      );
      expect(commitCall).toBeDefined();
      // With execFileSync, first arg is 'git', second is array of args
      expect(commitCall![0]).toBe('git');
      // Find the commit message in the arguments array
      const args = commitCall![1] as string[];
      const messageIndex = args.indexOf('-m') + 1;
      const commitMessage = args[messageIndex];
      // Special characters should be preserved in the message
      expect(commitMessage).toContain('$pecial');
      expect(commitMessage).toContain('"bug"');
      expect(commitMessage).toContain('`quotes`');
    });
  });

  describe('Scenario: Cross-Platform Compatibility', () => {
    it('should handle Windows paths correctly', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify([
        { name: 'windows-project', path: 'C:\\Projects\\MyApp' },
      ]));
      
      // Reinitialize to load Windows paths
      repositoryManager = new RepositoryManager();
      gitHandler = new GitHandler(repositoryManager, gitExecutor);
      
      mockExecFileSync.mockReturnValue('Windows output');
      
      const result = await gitHandler.handle({
        repo: 'windows-project',
        command: 'status',
      });
      
      // Now includes workflow reminder for status command
      expect(result.content[0].text).toContain('Windows output');
      expect(result.content[0].text).toContain('Planning to Make Changes?');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining([
          expect.stringContaining('--git-dir='),
          expect.stringContaining('--work-tree='),
        ]),
        expect.objectContaining({
          cwd: 'C:\\Projects\\MyApp',
        })
      );
    });
    
    it('should handle paths with spaces', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify([
        { name: 'space-project', path: '/path/with spaces/project' },
      ]));
      
      repositoryManager = new RepositoryManager();
      gitHandler = new GitHandler(repositoryManager, gitExecutor);
      
      mockExecFileSync.mockReturnValue('Output');
      
      const result = await gitHandler.handle({
        repo: 'space-project',
        command: 'log',
      });
      
      // Now includes workflow reminder for log command
      expect(result.content[0].text).toContain('Output');
      expect(result.content[0].text).toContain('Planning to Make Changes?');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining([
          expect.stringContaining('--git-dir='),
          expect.stringContaining('--work-tree='),
        ]),
        expect.objectContaining({
          cwd: '/path/with spaces/project',
        })
      );
    });
  });
});