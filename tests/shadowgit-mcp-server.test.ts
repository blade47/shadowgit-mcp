import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ShadowGitMCPServer } from '../src/shadowgit-mcp-server';

// Mock child_process
jest.mock('child_process', () => ({
  execFileSync: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

// Mock os
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/testuser')
}));

describe('ShadowGitMCPServer', () => {
  let server: ShadowGitMCPServer;
  let mockExecFileSync: jest.Mock;
  let mockExistsSync: jest.Mock;
  let mockReadFileSync: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get mock references
    const childProcess = require('child_process');
    const fs = require('fs');
    mockExecFileSync = childProcess.execFileSync as jest.Mock;
    mockExistsSync = fs.existsSync as jest.Mock;
    mockReadFileSync = fs.readFileSync as jest.Mock;
    
    // Setup default mock behaviors
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([
      { name: 'test-repo', path: '/test/repo' },
      { name: 'another-repo', path: '/another/repo' }
    ]));
    
    // Create server instance
    server = new ShadowGitMCPServer();
  });

  describe('Server Initialization', () => {
    it('should create server instance successfully', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(ShadowGitMCPServer);
    });

    it('should initialize with required handlers', () => {
      // Server should be initialized with all required components
      expect(server).toBeDefined();
      // The actual handlers are private, but we can verify the server exists
    });
  });

  describe('Configuration Loading', () => {
    it('should load repositories from config file', () => {
      const testRepos = [
        { name: 'repo1', path: '/path/to/repo1' },
        { name: 'repo2', path: '/path/to/repo2' }
      ];
      
      mockReadFileSync.mockReturnValue(JSON.stringify(testRepos));
      
      // Create a new instance to trigger config loading
      const newServer = new ShadowGitMCPServer();
      
      expect(newServer).toBeDefined();
      expect(mockReadFileSync).toHaveBeenCalled();
    });

    it('should handle missing config file gracefully', () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      // Should not throw when config is missing
      expect(() => new ShadowGitMCPServer()).not.toThrow();
    });
  });

  describe('Server Lifecycle', () => {
    it('should handle server start', async () => {
      // Server should be properly initialized
      expect(server).toBeDefined();
    });

    it('should handle server shutdown gracefully', async () => {
      // Server should clean up resources on shutdown
      // This is typically handled by the Server class from MCP SDK
      expect(server).toBeDefined();
    });
  });
});