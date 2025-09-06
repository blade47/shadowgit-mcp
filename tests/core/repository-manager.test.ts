import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RepositoryManager } from '../../src/core/repository-manager';
import * as os from 'os';
import * as path from 'path';
import { getStorageLocation, fileExists, readJsonFile } from '../../src/utils/file-utils';

// Mock the dependencies
jest.mock('os');
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
}));
jest.mock('../../src/utils/file-utils', () => ({
  getStorageLocation: jest.fn(),
  fileExists: jest.fn(),
  readJsonFile: jest.fn(),
}));

describe('RepositoryManager', () => {
  let manager: RepositoryManager;
  let mockGetStorageLocation: jest.MockedFunction<typeof getStorageLocation>;
  let mockFileExists: jest.MockedFunction<typeof fileExists>;
  let mockReadJsonFile: jest.MockedFunction<typeof readJsonFile>;
  let mockHomedir: jest.MockedFunction<typeof os.homedir>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGetStorageLocation = getStorageLocation as jest.MockedFunction<typeof getStorageLocation>;
    mockFileExists = fileExists as jest.MockedFunction<typeof fileExists>;
    mockReadJsonFile = readJsonFile as jest.MockedFunction<typeof readJsonFile>;
    mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
    
    // Default mock behaviors
    mockHomedir.mockReturnValue('/home/testuser');
    mockGetStorageLocation.mockReturnValue('/home/testuser/.shadowgit');
    mockFileExists.mockReturnValue(true);
    mockReadJsonFile.mockReturnValue([
      { name: 'test-repo', path: '/test/repo' },
      { name: 'another-repo', path: '/another/repo' },
    ]);
    
    manager = new RepositoryManager();
  });

  describe('getRepositories', () => {
    it('should load repositories from config file', () => {
      const repos = manager.getRepositories();
      
      expect(repos).toHaveLength(2);
      expect(repos[0]).toEqual({ name: 'test-repo', path: '/test/repo' });
      expect(repos[1]).toEqual({ name: 'another-repo', path: '/another/repo' });
      expect(mockReadJsonFile).toHaveBeenCalledWith(
        path.join('/home/testuser/.shadowgit', 'repos.json'),
        []
      );
    });

    it('should return empty array when config file does not exist', () => {
      mockReadJsonFile.mockReturnValue([]);
      manager = new RepositoryManager();
      
      const repos = manager.getRepositories();
      
      expect(repos).toEqual([]);
    });

    it('should return empty array when config file is empty', () => {
      mockReadJsonFile.mockReturnValue([]);
      manager = new RepositoryManager();
      
      const repos = manager.getRepositories();
      
      expect(repos).toEqual([]);
    });

    it('should return empty array when config file contains invalid JSON', () => {
      // readJsonFile handles invalid JSON and returns default value
      mockReadJsonFile.mockReturnValue([]);
      manager = new RepositoryManager();
      
      const repos = manager.getRepositories();
      
      expect(repos).toEqual([]);
    });

    it('should handle config file with empty array', () => {
      mockReadJsonFile.mockReturnValue([]);
      manager = new RepositoryManager();
      
      const repos = manager.getRepositories();
      
      expect(repos).toEqual([]);
    });

    it('should cache repositories after first load', () => {
      const repos1 = manager.getRepositories();
      const repos2 = manager.getRepositories();
      
      expect(repos1).toBe(repos2); // Same reference
      expect(mockReadJsonFile).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should use getStorageLocation from file-utils', () => {
      mockGetStorageLocation.mockReturnValue('/custom/shadowgit');
      mockReadJsonFile.mockReturnValue([]);
      
      const customManager = new RepositoryManager();
      customManager.getRepositories();
      
      expect(mockReadJsonFile).toHaveBeenCalledWith(
        path.join('/custom/shadowgit', 'repos.json'),
        []
      );
    });

    it('should handle repositories with Windows paths', () => {
      mockReadJsonFile.mockReturnValue([
        { name: 'windows-project', path: 'C:\\Users\\Dev\\Project' },
        { name: 'network-project', path: '\\\\server\\share\\repo' },
      ]);
      manager = new RepositoryManager();
      
      const repos = manager.getRepositories();
      
      expect(repos[0].path).toBe('C:\\Users\\Dev\\Project');
      expect(repos[1].path).toBe('\\\\server\\share\\repo');
    });

    it('should handle malformed repository objects', () => {
      mockReadJsonFile.mockReturnValue([
        { name: 'valid-repo', path: '/valid/path' },
        { name: 'missing-path' }, // Missing path
        { path: '/missing/name' }, // Missing name
        null, // Null entry
        'string-entry', // String instead of object
        { name: 'another-valid', path: '/another/valid' },
      ] as any);
      manager = new RepositoryManager();
      
      const repos = manager.getRepositories();
      
      // The implementation doesn't filter out invalid entries
      expect(repos).toHaveLength(6);
      expect(repos[0]).toEqual({ name: 'valid-repo', path: '/valid/path' });
      expect(repos[5]).toEqual({ name: 'another-valid', path: '/another/valid' });
    });
  });

  describe('resolveRepoPath', () => {
    beforeEach(() => {
      mockReadJsonFile.mockReturnValue([
        { name: 'test-repo', path: '/test/repo' },
        { name: 'another-repo', path: '/another/repo' },
        { name: 'home-repo', path: '~/projects/home' },
      ]);
      manager = new RepositoryManager();
    });

    it('should resolve repository by exact name', () => {
      mockFileExists.mockImplementation((p: any) => p === path.join('/test/repo', '.shadowgit.git'));
      const resolvedPath = manager.resolveRepoPath('test-repo');
      expect(resolvedPath).toBe('/test/repo');
    });

    it('should resolve repository by another name', () => {
      mockFileExists.mockImplementation((p: any) => p === path.join('/another/repo', '.shadowgit.git'));
      const resolvedPath = manager.resolveRepoPath('another-repo');
      expect(resolvedPath).toBe('/another/repo');
    });

    it('should return null for non-existent repository name', () => {
      const resolvedPath = manager.resolveRepoPath('non-existent');
      expect(resolvedPath).toBeNull();
    });

    it('should resolve absolute path directly if it exists with .shadowgit.git', () => {
      mockFileExists.mockImplementation((p: any) => 
        p === '/direct/path' || p === path.join('/direct/path', '.shadowgit.git')
      );
      
      const resolvedPath = manager.resolveRepoPath('/direct/path');
      expect(resolvedPath).toBe('/direct/path');
    });

    it('should return null for non-existent absolute path', () => {
      mockFileExists.mockReturnValue(false);
      
      const resolvedPath = manager.resolveRepoPath('/non/existent/path');
      expect(resolvedPath).toBeNull();
    });

    it('should resolve repository with tilde path', () => {
      mockHomedir.mockReturnValue('/home/testuser');
      // The repository path contains ~/projects/home which needs to be resolved to /home/testuser/projects/home
      // resolveRepoPath will check for .shadowgit.git in the resolved path
      mockFileExists.mockImplementation((p: any) => {
        // When checking if .shadowgit.git exists in the resolved path
        const resolvedPath = p.replace('~', '/home/testuser');
        return resolvedPath === path.join('/home/testuser/projects/home', '.shadowgit.git');
      });
      
      const resolvedPath = manager.resolveRepoPath('home-repo');
      expect(resolvedPath).toBe('/home/testuser/projects/home');
    });

    it('should handle empty input', () => {
      const resolvedPath = manager.resolveRepoPath('');
      expect(resolvedPath).toBeNull();
    });

    it('should handle null input', () => {
      const resolvedPath = manager.resolveRepoPath(null as any);
      expect(resolvedPath).toBeNull();
    });

    it('should handle undefined input', () => {
      const resolvedPath = manager.resolveRepoPath(undefined as any);
      expect(resolvedPath).toBeNull();
    });

    it('should be case-sensitive for repository names', () => {
      mockFileExists.mockImplementation((p: any) => p === path.join('/test/repo', '.shadowgit.git'));
      const path1 = manager.resolveRepoPath('test-repo');
      const path2 = manager.resolveRepoPath('Test-Repo');
      const path3 = manager.resolveRepoPath('TEST-REPO');
      
      expect(path1).toBe('/test/repo');
      expect(path2).toBeNull();
      expect(path3).toBeNull();
    });

    it('should handle Windows absolute paths', () => {
      mockFileExists.mockImplementation((p: any) => {
        // path.isAbsolute on Windows will recognize C:\ paths
        return p === 'C:\\Windows\\Path';
      });
      
      const resolvedPath = manager.resolveRepoPath('C:\\Windows\\Path');
      // On non-Windows systems, path.isAbsolute may not recognize C:\ as absolute
      // So this test may return null on Unix systems
      if (process.platform === 'win32') {
        expect(resolvedPath).toBe('C:\\Windows\\Path');
      } else {
        // On Unix, C:\ is not recognized as an absolute path
        expect(resolvedPath).toBeNull();
      }
    });

    it('should handle UNC paths', () => {
      mockFileExists.mockImplementation((p: any) => p === '\\\\server\\share');
      
      const resolvedPath = manager.resolveRepoPath('\\\\server\\share');
      // UNC paths are Windows-specific
      if (process.platform === 'win32') {
        expect(resolvedPath).toBe('\\\\server\\share');
      } else {
        // On Unix, \\\\ is not recognized as a path
        expect(resolvedPath).toBeNull();
      }
    });

    it('should handle relative paths as repository names', () => {
      // Relative paths should be treated as repo names, not paths
      const resolvedPath = manager.resolveRepoPath('./relative/path');
      expect(resolvedPath).toBeNull();
    });

    it('should handle repository names with special characters', () => {
      mockReadJsonFile.mockReturnValue([
        { name: 'repo-with-dash', path: '/dash/repo' },
        { name: 'repo_with_underscore', path: '/underscore/repo' },
        { name: 'repo.with.dots', path: '/dots/repo' },
      ]);
      mockFileExists.mockImplementation((p: any) => 
        p === path.join('/dash/repo', '.shadowgit.git') ||
        p === path.join('/underscore/repo', '.shadowgit.git') ||
        p === path.join('/dots/repo', '.shadowgit.git')
      );
      manager = new RepositoryManager();
      
      expect(manager.resolveRepoPath('repo-with-dash')).toBe('/dash/repo');
      expect(manager.resolveRepoPath('repo_with_underscore')).toBe('/underscore/repo');
      expect(manager.resolveRepoPath('repo.with.dots')).toBe('/dots/repo');
    });

    it('should check if path is absolute using path.isAbsolute', () => {
      // Mock a path that path.isAbsolute would recognize
      const unixPath = '/absolute/unix/path';
      mockFileExists.mockImplementation((p: any) => 
        p === unixPath || p === path.join(unixPath, '.shadowgit.git')
      );
      
      const resolvedPath = manager.resolveRepoPath(unixPath);
      
      if (path.isAbsolute(unixPath)) {
        expect(resolvedPath).toBe(unixPath);
      } else {
        expect(resolvedPath).toBeNull();
      }
    });

    it('should normalize tilde in repository paths during resolution', () => {
      mockHomedir.mockReturnValue('/home/user');
      mockReadJsonFile.mockReturnValue([
        { name: 'tilde-repo', path: '~/my/project' },
      ]);
      // Now the implementation expands tilde before checking fileExists
      mockFileExists.mockImplementation((p: any) => p === path.join('/home/user/my/project', '.shadowgit.git'));
      manager = new RepositoryManager();
      
      const resolvedPath = manager.resolveRepoPath('tilde-repo');
      expect(resolvedPath).toBe('/home/user/my/project');
    });

    it('should handle tilde at different positions', () => {
      mockHomedir.mockReturnValue('/home/user');
      mockReadJsonFile.mockReturnValue([
        { name: 'repo1', path: '~/project' },
        { name: 'repo2', path: '/path/~/invalid' }, // Tilde not at start
      ]);
      mockFileExists.mockImplementation((p: any) => 
        p === path.join('/home/user/project', '.shadowgit.git') ||
        p === path.join('/path/~/invalid', '.shadowgit.git')
      );
      manager = new RepositoryManager();
      
      expect(manager.resolveRepoPath('repo1')).toBe('/home/user/project');
      expect(manager.resolveRepoPath('repo2')).toBe('/path/~/invalid'); // Not expanded since tilde is not at start
    });
  });
});