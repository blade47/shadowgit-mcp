import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListReposHandler } from '../../src/handlers/list-repos-handler';
import { RepositoryManager } from '../../src/core/repository-manager';

// Mock the dependencies
jest.mock('../../src/core/repository-manager');
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
}));

describe('ListReposHandler', () => {
  let handler: ListReposHandler;
  let mockRepositoryManager: jest.Mocked<RepositoryManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRepositoryManager = new RepositoryManager() as jest.Mocked<RepositoryManager>;
    handler = new ListReposHandler(mockRepositoryManager);
  });

  describe('handle', () => {
    it('should list repositories when available', async () => {
      const mockRepos = [
        { name: 'project-alpha', path: '/home/user/projects/alpha' },
        { name: 'project-beta', path: '/home/user/projects/beta' },
        { name: 'my-app', path: '/Users/dev/workspace/my-app' },
      ];
      
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(mockRepos);

      const result = await handler.handle();

      expect(result.content[0].text).toContain('Available Repositories (3)');
      expect(result.content[0].text).toContain('project-alpha:\n    Path: /home/user/projects/alpha');
      expect(result.content[0].text).toContain('project-beta:\n    Path: /home/user/projects/beta');
      expect(result.content[0].text).toContain('my-app:\n    Path: /Users/dev/workspace/my-app');
      expect(result.content[0].text).toContain('CRITICAL: Required Workflow for ALL Changes');
      expect(result.content[0].text).toContain('start_session');
    });

    it('should handle no repositories configured', async () => {
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue([]);

      const result = await handler.handle();

      expect(result.content[0].text).toContain('No repositories found in ShadowGit');
      expect(result.content[0].text).toContain('To add repositories:');
      expect(result.content[0].text).toContain('Open the ShadowGit application');
      expect(result.content[0].text).not.toContain('Available Repositories');
    });

    it('should handle single repository', async () => {
      const mockRepos = [
        { name: 'solo-project', path: '/workspace/solo' },
      ];
      
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(mockRepos);

      const result = await handler.handle();

      expect(result.content[0].text).toContain('Available Repositories (1)');
      expect(result.content[0].text).toContain('solo-project:\n    Path: /workspace/solo');
      expect(result.content[0].text).toContain('git_command({repo: "solo-project"');
    });

    it('should handle repositories with special characters in names', async () => {
      const mockRepos = [
        { name: 'project-with-dashes', path: '/path/to/project' },
        { name: 'project_with_underscores', path: '/another/path' },
        { name: 'project.with.dots', path: '/dotted/path' },
      ];
      
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(mockRepos);

      const result = await handler.handle();

      expect(result.content[0].text).toContain('project-with-dashes:\n    Path: /path/to/project');
      expect(result.content[0].text).toContain('project_with_underscores:\n    Path: /another/path');
      expect(result.content[0].text).toContain('project.with.dots:\n    Path: /dotted/path');
    });

    it('should handle repositories with long paths', async () => {
      const mockRepos = [
        { 
          name: 'deep-project', 
          path: '/very/long/path/to/deeply/nested/project/directory/structure/here' 
        },
      ];
      
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(mockRepos);

      const result = await handler.handle();

      expect(result.content[0].text).toContain(
        'deep-project:\n    Path: /very/long/path/to/deeply/nested/project/directory/structure/here'
      );
    });

    it('should handle Windows-style paths', async () => {
      const mockRepos = [
        { name: 'windows-project', path: 'C:\\Users\\Developer\\Projects\\MyApp' },
        { name: 'network-project', path: '\\\\server\\share\\project' },
      ];
      
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(mockRepos);

      const result = await handler.handle();

      expect(result.content[0].text).toContain('windows-project:\n    Path: C:\\Users\\Developer\\Projects\\MyApp');
      expect(result.content[0].text).toContain('network-project:\n    Path: \\\\server\\share\\project');
    });

    it('should handle many repositories', async () => {
      const mockRepos = Array.from({ length: 20 }, (_, i) => ({
        name: `project-${i + 1}`,
        path: `/path/to/project${i + 1}`,
      }));
      
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(mockRepos);

      const result = await handler.handle();

      expect(result.content[0].text).toContain('Available Repositories (20)');
      expect(result.content[0].text).toContain('project-1:\n    Path: /path/to/project1');
      expect(result.content[0].text).toContain('project-20:\n    Path: /path/to/project20');
    });

    it('should always return MCPToolResponse with text content', async () => {
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue([]);

      const result = await handler.handle();

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should throw if getRepositories throws', async () => {
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockImplementation(() => {
        throw new Error('Failed to read repositories');
      });

      // Should propagate the error
      await expect(handler.handle()).rejects.toThrow('Failed to read repositories');
    });

    it('should handle null return from getRepositories', async () => {
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(null as any);

      // This will cause an error when trying to check length
      await expect(handler.handle()).rejects.toThrow();
    });

    it('should handle undefined return from getRepositories', async () => {
      (mockRepositoryManager.getRepositories as any) = jest.fn().mockReturnValue(undefined as any);

      // This will cause an error when trying to check length
      await expect(handler.handle()).rejects.toThrow();
    });
  });
});