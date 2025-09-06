import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CheckpointHandler } from '../../src/handlers/checkpoint-handler';
import { RepositoryManager } from '../../src/core/repository-manager';
import { GitExecutor } from '../../src/core/git-executor';

// Mock the dependencies
jest.mock('../../src/core/repository-manager');
jest.mock('../../src/core/git-executor');
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
}));

describe('CheckpointHandler', () => {
  let handler: CheckpointHandler;
  let mockRepositoryManager: jest.Mocked<RepositoryManager>;
  let mockGitExecutor: jest.Mocked<GitExecutor>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRepositoryManager = new RepositoryManager() as jest.Mocked<RepositoryManager>;
    mockGitExecutor = new GitExecutor() as jest.Mocked<GitExecutor>;
    
    handler = new CheckpointHandler(mockRepositoryManager, mockGitExecutor);
  });

  describe('handle', () => {
    describe('Validation', () => {
      it('should require both repo and title parameters', async () => {
        // Missing repo
        let result = await handler.handle({ title: 'Test' });
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'title' parameters are required");
        
        // Missing title
        result = await handler.handle({ repo: 'test-repo' });
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'title' parameters are required");
        
        // Missing both
        result = await handler.handle({});
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'title' parameters are required");
        
        // Null
        result = await handler.handle(null);
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'title' parameters are required");
      });

      it('should validate title length (max 50 chars)', async () => {
        const longTitle = 'a'.repeat(51);
        const result = await handler.handle({
          repo: 'test-repo',
          title: longTitle,
        });
        
        expect(result.content[0].text).toContain('Error: Title must be 50 characters or less');
        expect(result.content[0].text).toContain('(current: 51 chars)');
      });

      it('should validate message length (max 1000 chars)', async () => {
        const longMessage = 'a'.repeat(1001);
        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
          message: longMessage,
        });
        
        expect(result.content[0].text).toContain('Error: Message must be 1000 characters or less');
        expect(result.content[0].text).toContain('(current: 1001 chars)');
      });

      it('should handle non-string repo parameter', async () => {
        const result = await handler.handle({
          repo: 123 as any,
          title: 'Test',
        });
        
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'title' parameters are required");
      });

      it('should handle non-string title parameter', async () => {
        const result = await handler.handle({
          repo: 'test-repo',
          title: true as any,
        });
        
        expect(result.content[0].text).toContain("Error: Both 'repo' and 'title' parameters are required");
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
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain("Error: Repository 'non-existent' not found");
        expect(result.content[0].text).toContain('Available repositories:');
        expect(result.content[0].text).toContain('repo1: /path/to/repo1');
        expect(result.content[0].text).toContain('repo2: /path/to/repo2');
      });

      it('should handle no repositories configured', async () => {
        (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue(null);
        (mockRepositoryManager as any).getRepositories = jest.fn().mockReturnValue([]);

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain('Error: No repositories found');
        expect(result.content[0].text).toContain('Please add repositories to ShadowGit first');
      });
    });

    describe('Git Operations', () => {
      beforeEach(() => {
        (mockRepositoryManager as any).resolveRepoPath = jest.fn().mockReturnValue('/test/repo');
      });

      it('should handle no changes to commit', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce(''); // status --porcelain returns empty

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain('No Changes Detected');
        expect(result.content[0].text).toContain('Repository has no changes to commit');
        expect(mockGitExecutor.execute).toHaveBeenCalledWith(
          ['status', '--porcelain'],
          '/test/repo',
          true
        );
      });

      it('should handle empty output from status', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('(empty output)');

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain('No Changes Detected');
      });

      it('should create checkpoint with minimal parameters', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt\nA new.txt') // status --porcelain
          .mockResolvedValueOnce('') // add -A
          .mockResolvedValueOnce('[main abc1234] Test checkpoint\n2 files changed') // commit
          .mockResolvedValueOnce('commit abc1234\nAuthor: AI Assistant'); // show --stat

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain('Checkpoint Created Successfully!');
        expect(result.content[0].text).toContain('[main abc1234] Test checkpoint');
        expect(result.content[0].text).toContain('Commit Hash:** `abc1234`');
        expect(mockGitExecutor.execute).toHaveBeenCalledTimes(4);
      });

      it('should create checkpoint with all parameters', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt') // status --porcelain
          .mockResolvedValueOnce('') // add -A
          .mockResolvedValueOnce('[main def5678] Fix bug') // commit
          .mockResolvedValueOnce('commit def5678\nAuthor: Claude'); // show --stat

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Fix bug',
          message: 'Fixed null pointer exception',
          author: 'Claude',
        });
        
        expect(result.content[0].text).toContain('Checkpoint Created Successfully!');
        expect(result.content[0].text).toContain('Commit Hash:** `def5678`');
      });

      it('should properly escape special characters in commit message', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt') // status
          .mockResolvedValueOnce('') // add
          .mockResolvedValueOnce('[main xyz789] Escaped') // commit
          .mockResolvedValueOnce('commit xyz789'); // show

        await handler.handle({
          repo: 'test-repo',
          title: 'Test with $pecial "quotes" and `backticks`',
          message: 'Message with $vars and `commands`',
          author: 'Test',
        });

        // Check that commit was called with array args
        const commitCall = mockGitExecutor.execute.mock.calls.find(
          call => Array.isArray(call[0]) && call[0][0] === 'commit'
        );
        expect(commitCall).toBeDefined();
        // Message is passed as a separate argument
        expect(commitCall![0]).toEqual(['commit', '-m', expect.any(String)]);
        const message = commitCall![0][2];
        // Special characters should be preserved
        expect(message).toContain('$pecial');
        expect(message).toContain('"quotes"');
        expect(message).toContain('`backticks`');
        expect(message).toContain('`commands`');
      });

      it('should set correct Git author environment', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt')
          .mockResolvedValueOnce('')
          .mockResolvedValueOnce('[main abc1234] Test')
          .mockResolvedValueOnce('commit abc1234');

        await handler.handle({
          repo: 'test-repo',
          title: 'Test',
          author: 'GPT-4',
        });

        // Check the commit call
        const commitCall = mockGitExecutor.execute.mock.calls.find(
          call => Array.isArray(call[0]) && call[0][0] === 'commit'
        );
        expect(commitCall).toBeDefined();
        expect(commitCall![3]).toMatchObject({
          GIT_AUTHOR_NAME: 'GPT-4',
          GIT_AUTHOR_EMAIL: 'gpt-4@shadowgit.local',
          GIT_COMMITTER_NAME: 'ShadowGit MCP',
          GIT_COMMITTER_EMAIL: 'shadowgit-mcp@shadowgit.local',
        });
      });

      it('should use default author when not specified', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt')
          .mockResolvedValueOnce('')
          .mockResolvedValueOnce('[main abc1234] Test')
          .mockResolvedValueOnce('commit abc1234');

        await handler.handle({
          repo: 'test-repo',
          title: 'Test',
        });

        const commitCall = mockGitExecutor.execute.mock.calls.find(
          call => Array.isArray(call[0]) && call[0][0] === 'commit'
        );
        expect(commitCall![3]).toMatchObject({
          GIT_AUTHOR_NAME: 'AI Assistant',
          GIT_AUTHOR_EMAIL: 'ai-assistant@shadowgit.local',
        });
      });

      it('should handle git add failure', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt') // status
          .mockResolvedValueOnce('Error: Failed to add files'); // add fails

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain('Failed to Stage Changes');
        expect(result.content[0].text).toContain('Error: Failed to add files');
      });

      it('should handle git commit failure', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt') // status
          .mockResolvedValueOnce('') // add
          .mockResolvedValueOnce('Error: Cannot commit'); // commit fails

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain('Failed to Create Commit');
        expect(result.content[0].text).toContain('Error: Cannot commit');
      });

      it('should handle commit output without hash', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt')
          .mockResolvedValueOnce('')
          .mockResolvedValueOnce('Commit created successfully') // No hash in output
          .mockResolvedValueOnce('commit details');

        const result = await handler.handle({
          repo: 'test-repo',
          title: 'Test checkpoint',
        });
        
        expect(result.content[0].text).toContain('Checkpoint Created Successfully!');
        expect(result.content[0].text).toContain('Commit Hash:** `unknown`');
      });

      it('should extract commit hash from various formats', async () => {
        const hashFormats = [
          '[main abc1234] Message',
          '[feature-branch def5678] Message',
          '[develop 1a2b3c4d5e6f] Message',
        ];

        for (const format of hashFormats) {
          jest.clearAllMocks();
          (mockGitExecutor as any).execute = (jest.fn() as any)
            .mockResolvedValueOnce('M file.txt')
            .mockResolvedValueOnce('')
            .mockResolvedValueOnce(format)
            .mockResolvedValueOnce('details');

          const result = await handler.handle({
            repo: 'test-repo',
            title: 'Test',
          });

          const match = format.match(/\[[\w-]+ ([a-f0-9]+)\]/);
          expect(result.content[0].text).toContain(`Commit Hash:** \`${match![1]}\``);
        }
      });

      it('should include commit message body when provided', async () => {
        (mockGitExecutor as any).execute = (jest.fn() as any)
          .mockResolvedValueOnce('M file.txt')
          .mockResolvedValueOnce('')
          .mockResolvedValueOnce('[main abc1234] Title')
          .mockResolvedValueOnce('commit abc1234');

        await handler.handle({
          repo: 'test-repo',
          title: 'Fix critical bug',
          message: 'Added null check to prevent crash',
          author: 'Claude',
        });

        const commitCall = mockGitExecutor.execute.mock.calls.find(
          call => Array.isArray(call[0]) && call[0][0] === 'commit'
        );
        // Check that commit message includes all parts
        const message = commitCall![0][2];
        expect(message).toContain('Fix critical bug');
        expect(message).toContain('Added null check to prevent crash');
        expect(message).toContain('Claude');
        expect(message).toContain('(via ShadowGit MCP)');
      });
    });
  });
});