import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GitHandler } from '../../src/handlers/git-handler';
import { RepositoryManager } from '../../src/core/repository-manager';
import { GitExecutor } from '../../src/core/git-executor';

// Mock the dependencies
jest.mock('../../src/core/repository-manager');
jest.mock('../../src/core/git-executor');
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
}));
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

import * as fs from 'fs';

describe('GitHandler', () => {
  let handler: GitHandler;
  let mockRepositoryManager: jest.Mocked<RepositoryManager>;
  let mockGitExecutor: jest.Mocked<GitExecutor>;
  let mockExistsSync: jest.MockedFunction<typeof fs.existsSync>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRepositoryManager = new RepositoryManager() as jest.Mocked<RepositoryManager>;
    mockGitExecutor = new GitExecutor() as jest.Mocked<GitExecutor>;
    mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    
    handler = new GitHandler(mockRepositoryManager, mockGitExecutor);
  });

  describe('handle', () => {
    describe('Validation', () => {
      it('should require both repo and command parameters', async () => {
        // Missing repo
        let result = await handler.handle({ command: 'log' });
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'command' parameters are required");
        
        // Missing command
        result = await handler.handle({ repo: 'test-repo' });
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'command' parameters are required");
        
        // Missing both
        result = await handler.handle({});
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'command' parameters are required");
        
        // Null
        result = await handler.handle(null);
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'command' parameters are required");
      });

      it('should handle non-string repo parameter', async () => {
        const result = await handler.handle({
          repo: 123 as any,
          command: 'log',
        });
        
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'command' parameters are required");
      });

      it('should handle non-string command parameter', async () => {
        const result = await handler.handle({
          repo: 'test-repo',
          command: true as any,
        });
        
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'command' parameters are required");
      });
    });

    describe('Repository Resolution', () => {
      it('should handle repository not found', async () => {
        (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue(null);
        (mockRepositoryManager as any).getRepositories = jest.fn().mockReturnValue([
          { name: 'repo1', path: '/path/to/repo1' },
          { name: 'repo2', path: '/path/to/repo2' },
        ]);

        const result = await handler.handle({
          repo: 'non-existent',
          command: 'log',
        });
        
        expect(result.content[0].text).toContain("Error: Repository 'non-existent' not found");
        expect(result.content[0].text).toContain('Available repositories:');
        expect(result.content[0].text).toContain('repo1:');
        expect(result.content[0].text).toContain('Path: /path/to/repo1');
        expect(result.content[0].text).toContain('repo2:');
        expect(result.content[0].text).toContain('Path: /path/to/repo2');
      });

      it('should handle no repositories configured', async () => {
        (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue(null);
        (mockRepositoryManager as any).getRepositories = jest.fn().mockReturnValue([]);

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log',
        });
        
        expect(result.content[0].text).toContain('No repositories found');
        expect(result.content[0].text).toContain('Please add repositories to ShadowGit first');
      });
    });

    describe('ShadowGit Directory Check', () => {
      beforeEach(() => {
        (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue('/test/repo');
      });

      it('should handle when GitExecutor returns error for missing .shadowgit.git', async () => {
        mockExistsSync.mockReturnValue(false);
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('Error: No ShadowGit repository found at /test/repo');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log',
        });
        
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.content[0]).toBeDefined();
        expect(result.content[0].text).toContain('Error');
        expect(mockGitExecutor.execute).toHaveBeenCalledWith('log', '/test/repo');
      });

      it('should proceed when .shadowgit.git directory exists', async () => {
        mockExistsSync.mockReturnValue(true);
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('commit abc1234\nAuthor: Test');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log -1',
        });
        
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.content[0]).toBeDefined();
        expect(result.content[0].text).toContain('commit abc1234');
        expect(mockGitExecutor.execute).toHaveBeenCalledWith('log -1', '/test/repo');
      });
    });

    describe('Git Command Execution', () => {
      beforeEach(() => {
        (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue('/test/repo');
        mockExistsSync.mockReturnValue(true);
      });

      it('should execute valid git commands', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('commit abc1234\ncommit def5678');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log --oneline -2',
        });
        
        expect(result.content[0].text).toContain('commit abc1234');
        expect(result.content[0].text).toContain('commit def5678');
        expect(mockGitExecutor.execute).toHaveBeenCalledWith(
          'log --oneline -2',
          '/test/repo'
        );
      });

      it('should handle empty output', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'status',
        });
        
        // Now includes workflow reminder for status command
        expect(result.content[0].text).toContain('Planning to Make Changes?');
      });

      it('should trim whitespace from output', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('  \n  output with spaces  \n  ');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log',
        });
        
        // Now includes workflow reminder for log command
        expect(result.content[0].text).toContain('output with spaces');
        expect(result.content[0].text).toContain('Planning to Make Changes?');
      });

      it('should handle error output from GitExecutor', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('Error: Command not allowed');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'commit -m "test"',
        });
        
        expect(result.content[0].text).toContain('Error: Command not allowed');
      });

      it('should handle various git commands', async () => {
        const commands = [
          { cmd: 'log -10', output: 'log output', hasReminder: true },
          { cmd: 'diff HEAD~1', output: 'diff output', hasReminder: true },
          { cmd: 'show abc123', output: 'show output', hasReminder: false },
          { cmd: 'blame file.txt', output: 'blame output', hasReminder: true },
          { cmd: 'status', output: 'status output', hasReminder: true },
          { cmd: 'branch --list', output: 'branch output', hasReminder: false },
        ];

        for (const { cmd, output, hasReminder } of commands) {
          jest.clearAllMocks();
          (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue(output);

          const result = await handler.handle({
            repo: 'test-repo',
            command: cmd,
          });

          expect(result.content[0].text).toContain(output);
          if (hasReminder) {
            expect(result.content[0].text).toContain('Planning to Make Changes?');
          } else {
            expect(result.content[0].text).toBe(output);
          }
          expect(mockGitExecutor.execute).toHaveBeenCalledWith(cmd, '/test/repo');
        }
      });

      it('should pass correct parameters for regular commands', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('output');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log',
        });

        expect(mockGitExecutor.execute).toHaveBeenCalledWith(
          'log',
          '/test/repo'
        );
        // Verify workflow reminder is included
        expect(result.content[0].text).toContain('Planning to Make Changes?');
      });

      it('should handle multi-line output correctly', async () => {
        const multiLineOutput = `commit abc1234
Author: Test User
Date: Mon Jan 1 2024

    First commit
    
commit def5678
Author: Another User
Date: Mon Jan 2 2024

    Second commit`;

        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue(multiLineOutput);

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log -2',
        });
        
        // Now includes workflow reminder for log command
        expect(result.content[0].text).toContain(multiLineOutput);
        expect(result.content[0].text).toContain('Planning to Make Changes?');
      });

      it('should handle special characters in output', async () => {
        const specialOutput = 'Output with $pecial "chars" `backticks` & symbols';
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue(specialOutput);

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'show',
        });
        
        expect(result.content[0].text).toBe(specialOutput);
      });

      it('should handle error responses from GitExecutor', async () => {
        // GitExecutor returns error messages as strings, not rejected promises
        (mockGitExecutor as any).execute = (jest.fn() as any).mockResolvedValue('Error: Execution failed');

        const result = await handler.handle({
          repo: 'test-repo',
          command: 'log',
        });
        
        // The error message is returned as-is
        expect(result.content[0].text).toContain('Error: Execution failed');
      });
    });
  });
});