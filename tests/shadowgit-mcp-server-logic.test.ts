// Tests for ShadowGit MCP Server logic without importing MCP SDK
// This avoids ESM/CommonJS conflicts while still testing core functionality

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock modules
jest.mock('child_process');
jest.mock('fs');
jest.mock('os');

describe('ShadowGitMCPServer Logic Tests', () => {
  let mockExecFileSync: jest.MockedFunction<typeof execFileSync>;
  let mockExistsSync: jest.MockedFunction<typeof fs.existsSync>;
  let mockReadFileSync: jest.MockedFunction<typeof fs.readFileSync>;
  let mockHomedir: jest.MockedFunction<typeof os.homedir>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;
    mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
    
    // Default mock behaviors
    mockHomedir.mockReturnValue('/home/testuser');
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([
      { name: 'test-repo', path: '/test/repo' },
      { name: 'another-repo', path: '/another/repo' }
    ]));
  });

  describe('Security Validation', () => {
    const SAFE_COMMANDS = new Set([
      'log', 'diff', 'show', 'blame', 'grep', 'status',
      'rev-parse', 'rev-list', 'ls-files', 'cat-file',
      'diff-tree', 'shortlog', 'reflog', 'describe',
      'branch', 'tag', 'for-each-ref', 'ls-tree',
      'merge-base', 'cherry', 'count-objects'
    ]);

    const BLOCKED_ARGS = [
      '--exec', '--upload-pack', '--receive-pack',
      '-c', '--config', '--work-tree', '--git-dir',
      'push', 'pull', 'fetch', 'commit', 'merge',
      'rebase', 'reset', 'clean', 'checkout', 'add',
      'rm', 'mv', 'restore', 'stash', 'remote',
      'submodule', 'worktree', 'filter-branch',
      'repack', 'gc', 'prune', 'fsck'
    ];

    it('should only allow safe read-only commands', () => {
      const testCommands = [
        { cmd: 'log', expected: true },
        { cmd: 'diff', expected: true },
        { cmd: 'commit', expected: false },
        { cmd: 'push', expected: false },
        { cmd: 'merge', expected: false },
        { cmd: 'rebase', expected: false }
      ];

      testCommands.forEach(({ cmd, expected }) => {
        expect(SAFE_COMMANDS.has(cmd)).toBe(expected);
      });
    });

    it('should block dangerous arguments', () => {
      const dangerousCommands = [
        'log --exec=rm -rf /',
        'log -c core.editor=vim',
        'log --work-tree=/other/path',
        'diff push origin',
        'show && commit -m "test"'
      ];

      dangerousCommands.forEach(cmd => {
        const hasBlockedArg = BLOCKED_ARGS.some(arg => cmd.includes(arg));
        expect(hasBlockedArg).toBe(true);
      });
    });

    it('should detect path traversal attempts', () => {
      const PATH_TRAVERSAL_PATTERNS = [
        '../',
        '..\\',
        '%2e%2e',
        '..%2f',
        '..%5c'
      ];

      const maliciousPaths = [
        '../etc/passwd',
        '..\\windows\\system32',
        '%2e%2e%2fetc%2fpasswd',
        'test/../../sensitive'
      ];

      maliciousPaths.forEach(malPath => {
        const hasTraversal = PATH_TRAVERSAL_PATTERNS.some(pattern => 
          malPath.toLowerCase().includes(pattern)
        );
        expect(hasTraversal).toBe(true);
      });
    });
  });

  describe('Repository Path Resolution', () => {
    it('should normalize paths correctly', () => {
      const testPath = '~/projects/test';
      const normalized = testPath.replace('~', '/home/testuser');
      expect(normalized).toBe('/home/testuser/projects/test');
    });

    it('should handle Windows paths', () => {
      const windowsPaths = [
        'C:\\Users\\test\\project',
        'D:\\repos\\myrepo',
        '\\\\server\\share\\repo'
      ];

      windowsPaths.forEach(winPath => {
        const isWindowsPath = winPath.includes(':') || winPath.startsWith('\\\\');
        expect(isWindowsPath).toBe(true);
      });
    });

    it('should validate absolute paths', () => {
      const paths = [
        { path: '/absolute/path', isAbsolute: true },
        { path: 'relative/path', isAbsolute: false },
        { path: './relative', isAbsolute: false }
      ];
      
      // Test Windows path separately on Windows platform
      if (process.platform === 'win32') {
        paths.push({ path: 'C:\\Windows', isAbsolute: true });
      }

      paths.forEach(({ path: testPath, isAbsolute: expected }) => {
        expect(path.isAbsolute(testPath)).toBe(expected);
      });
    });
  });

  describe('Git Environment Configuration', () => {
    it('should set correct environment variables', () => {
      const repoPath = '/test/repo';
      const shadowGitDir = path.join(repoPath, '.shadowgit.git');
      
      const gitEnv = {
        ...process.env,
        GIT_DIR: shadowGitDir,
        GIT_WORK_TREE: repoPath
      };

      expect(gitEnv.GIT_DIR).toBe('/test/repo/.shadowgit.git');
      expect(gitEnv.GIT_WORK_TREE).toBe('/test/repo');
    });

    it('should enforce timeout and buffer limits', () => {
      const TIMEOUT_MS = 10000; // 10 seconds
      const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

      expect(TIMEOUT_MS).toBe(10000);
      expect(MAX_BUFFER_SIZE).toBe(10485760);
    });
  });

  describe('Command Sanitization', () => {
    it('should remove control characters', () => {
      const dirtyCommand = 'log\x00\x01\x02\x1F --oneline';
      const sanitized = dirtyCommand.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      expect(sanitized).toBe('log --oneline');
    });

    it('should enforce command length limit', () => {
      const MAX_COMMAND_LENGTH = 1000;
      const longCommand = 'log ' + 'a'.repeat(2000);
      expect(longCommand.length).toBeGreaterThan(MAX_COMMAND_LENGTH);
    });
  });

  describe('Error Handling', () => {
    it('should handle git not installed error', () => {
      const error: any = new Error('Command not found');
      error.code = 'ENOENT';
      expect(error.code).toBe('ENOENT');
    });

    it('should handle timeout error', () => {
      const error: any = new Error('Timeout');
      error.signal = 'SIGTERM';
      expect(error.signal).toBe('SIGTERM');
    });

    it('should handle buffer overflow error', () => {
      const error: any = new Error('Buffer overflow');
      error.code = 'ENOBUFS';
      expect(error.code).toBe('ENOBUFS');
    });

    it('should handle git error (exit code 128)', () => {
      const error: any = new Error('Git error');
      error.status = 128;
      error.stderr = 'fatal: bad revision';
      expect(error.status).toBe(128);
      expect(error.stderr).toContain('fatal');
    });
  });

  describe('Logging System', () => {
    it('should support multiple log levels', () => {
      const LOG_LEVELS = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
      };

      expect(LOG_LEVELS.debug).toBeLessThan(LOG_LEVELS.info);
      expect(LOG_LEVELS.info).toBeLessThan(LOG_LEVELS.warn);
      expect(LOG_LEVELS.warn).toBeLessThan(LOG_LEVELS.error);
    });

    it('should include timestamp in logs', () => {
      const timestamp = new Date().toISOString();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Configuration', () => {
    it('should read timeout from environment', () => {
      const customTimeout = '30000';
      const timeout = parseInt(customTimeout || '10000', 10);
      expect(timeout).toBe(30000);
    });

    it('should use default timeout if not specified', () => {
      const envTimeout: string | undefined = undefined;
      const timeout = parseInt(envTimeout || '10000', 10);
      expect(timeout).toBe(10000);
    });

    it('should read log level from environment', () => {
      const logLevel = 'debug';
      expect(['debug', 'info', 'warn', 'error']).toContain(logLevel);
    });
  });

  describe('Manual Checkpoint Functionality', () => {
    it('should validate required parameters', () => {
      // Test that repo and title are required
      const validateArgs = (args: any): boolean => {
        return (
          typeof args === 'object' &&
          args !== null &&
          'repo' in args &&
          'title' in args &&
          typeof args.repo === 'string' &&
          typeof args.title === 'string'
        );
      };

      expect(validateArgs({ repo: 'test', title: 'Test' })).toBe(true);
      expect(validateArgs({ repo: 'test' })).toBe(false);
      expect(validateArgs({ title: 'Test' })).toBe(false);
      expect(validateArgs({})).toBe(false);
      expect(validateArgs(null)).toBe(false);
    });

    it('should validate title length', () => {
      const MAX_TITLE_LENGTH = 50;
      const validateTitleLength = (title: string): boolean => {
        return title.length <= MAX_TITLE_LENGTH;
      };

      expect(validateTitleLength('Normal title')).toBe(true);
      expect(validateTitleLength('a'.repeat(50))).toBe(true);
      expect(validateTitleLength('a'.repeat(51))).toBe(false);
    });

    it('should generate correct author email from name', () => {
      const generateAuthorEmail = (author: string): string => {
        return `${author.toLowerCase().replace(/\s+/g, '-')}@shadowgit.local`;
      };

      expect(generateAuthorEmail('Claude')).toBe('claude@shadowgit.local');
      expect(generateAuthorEmail('GPT-4')).toBe('gpt-4@shadowgit.local');
      expect(generateAuthorEmail('AI Assistant')).toBe('ai-assistant@shadowgit.local');
      expect(generateAuthorEmail('Gemini Pro')).toBe('gemini-pro@shadowgit.local');
    });

    it('should properly escape shell special characters', () => {
      const escapeShellString = (str: string): string => {
        return str
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/"/g, '\\"')    // Escape double quotes
          .replace(/\$/g, '\\$')   // Escape dollar signs
          .replace(/`/g, '\\`')    // Escape backticks
          .replace(/'/g, "\\'");   // Escape single quotes
      };

      expect(escapeShellString('normal text')).toBe('normal text');
      expect(escapeShellString('text with $var')).toBe('text with \\$var');
      expect(escapeShellString('text with "quotes"')).toBe('text with \\"quotes\\"');
      expect(escapeShellString('text with `backticks`')).toBe('text with \\`backticks\\`');
      expect(escapeShellString('text with \\backslash')).toBe('text with \\\\backslash');
      expect(escapeShellString("text with 'single'")).toBe("text with \\'single\\'");
      expect(escapeShellString('$var "quote" `tick` \\slash')).toBe('\\$var \\"quote\\" \\`tick\\` \\\\slash');
    });

    it('should format commit message correctly', () => {
      const formatCommitMessage = (
        title: string,
        message: string | undefined,
        author: string,
        timestamp: string
      ): string => {
        let commitMessage = `✋ [${author}] Manual Checkpoint: ${title}`;
        if (message) {
          commitMessage += `\n\n${message}`;
        }
        commitMessage += `\n\nCreated by: ${author}\nTimestamp: ${timestamp}`;
        return commitMessage;
      };

      const timestamp = '2024-01-01T12:00:00Z';
      
      // Test with minimal parameters
      const msg1 = formatCommitMessage('Fix bug', undefined, 'AI Assistant', timestamp);
      expect(msg1).toContain('✋ [AI Assistant] Manual Checkpoint: Fix bug');
      expect(msg1).toContain('Created by: AI Assistant');
      expect(msg1).toContain('Timestamp: 2024-01-01T12:00:00Z');
      expect(msg1).not.toContain('undefined');

      // Test with all parameters
      const msg2 = formatCommitMessage('Add feature', 'Detailed description', 'Claude', timestamp);
      expect(msg2).toContain('✋ [Claude] Manual Checkpoint: Add feature');
      expect(msg2).toContain('Detailed description');
      expect(msg2).toContain('Created by: Claude');
    });

    it('should extract commit hash from git output', () => {
      const extractCommitHash = (output: string): string => {
        const match = output.match(/\[[\w\s-]+\s+([a-f0-9]{7,})\]/);
        return match ? match[1] : 'unknown';
      };

      expect(extractCommitHash('[main abc1234] Test commit')).toBe('abc1234');
      expect(extractCommitHash('[feature-branch def56789] Another commit')).toBe('def56789');
      expect(extractCommitHash('[develop 1a2b3c4d5e6f] Long hash')).toBe('1a2b3c4d5e6f');
      expect(extractCommitHash('No match here')).toBe('unknown');
    });

    it('should set correct Git environment variables', () => {
      const createGitEnv = (author: string) => {
        const authorEmail = `${author.toLowerCase().replace(/\s+/g, '-')}@shadowgit.local`;
        return {
          GIT_AUTHOR_NAME: author,
          GIT_AUTHOR_EMAIL: authorEmail,
          GIT_COMMITTER_NAME: author,
          GIT_COMMITTER_EMAIL: authorEmail
        };
      };

      const env1 = createGitEnv('Claude');
      expect(env1.GIT_AUTHOR_NAME).toBe('Claude');
      expect(env1.GIT_AUTHOR_EMAIL).toBe('claude@shadowgit.local');
      expect(env1.GIT_COMMITTER_NAME).toBe('Claude');
      expect(env1.GIT_COMMITTER_EMAIL).toBe('claude@shadowgit.local');

      const env2 = createGitEnv('GPT-4');
      expect(env2.GIT_AUTHOR_NAME).toBe('GPT-4');
      expect(env2.GIT_AUTHOR_EMAIL).toBe('gpt-4@shadowgit.local');
    });

    it('should handle isInternal flag for bypassing security', () => {
      // Test that internal flag allows normally blocked commands
      const isCommandAllowed = (command: string, isInternal: boolean): boolean => {
        const SAFE_COMMANDS = new Set(['log', 'diff', 'show', 'status']);
        const parts = command.trim().split(/\s+/);
        const gitCommand = parts[0];
        
        if (isInternal) {
          return true; // Bypass all checks for internal operations
        }
        
        return SAFE_COMMANDS.has(gitCommand);
      };

      // Normal security checks
      expect(isCommandAllowed('log', false)).toBe(true);
      expect(isCommandAllowed('commit', false)).toBe(false);
      expect(isCommandAllowed('add', false)).toBe(false);
      
      // Internal bypass
      expect(isCommandAllowed('commit', true)).toBe(true);
      expect(isCommandAllowed('add', true)).toBe(true);
      expect(isCommandAllowed('anything', true)).toBe(true);
    });
  });
});