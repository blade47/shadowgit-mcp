import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GitExecutor } from '../../src/core/git-executor';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock the dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
}));

describe('GitExecutor', () => {
  let executor: GitExecutor;
  let mockExecFileSync: jest.MockedFunction<typeof execFileSync>;
  let mockExistsSync: jest.MockedFunction<typeof fs.existsSync>;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new GitExecutor();
    mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;
    mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    mockExistsSync.mockReturnValue(true); // Default: .shadowgit.git exists
  });

  describe('execute', () => {
    describe('Security Validation', () => {
      it('should block write commands when isInternal is false', async () => {
        const dangerousCommands = [
          'commit -m "test"',
          'push origin main',
          'pull origin main',
          'merge feature-branch',
          'rebase main',
          'reset --hard HEAD~1',
          'clean -fd',
          'checkout -b new-branch',
          'add .',
          'rm file.txt',
          'mv old.txt new.txt',
        ];

        for (const cmd of dangerousCommands) {
          const result = await executor.execute(cmd, '/test/repo', false);
          const gitCommand = cmd.split(' ')[0];
          expect(result).toContain(`Error: Command '${gitCommand}' is not allowed`);
          expect(result).toContain('Only read-only commands are permitted');
          expect(mockExecFileSync).not.toHaveBeenCalled();
        }
      });

      it('should allow write commands when isInternal is true', async () => {
        mockExecFileSync.mockReturnValue('Success');

        const commands = ['commit -m "test"', 'add .', 'push origin main'];
        
        for (const cmd of commands) {
          jest.clearAllMocks();
          const result = await executor.execute(cmd, '/test/repo', true);
          expect(result).not.toContain('Error: Command not allowed');
          expect(mockExecFileSync).toHaveBeenCalled();
        }
      });

      it('should block dangerous arguments even in read commands', async () => {
        const dangerousArgs = [
          'log --exec=rm -rf /',
          'diff --upload-pack=evil',
          'show --receive-pack=bad',
          'log -e rm',  // -e followed by space
        ];

        for (const cmd of dangerousArgs) {
          const result = await executor.execute(cmd, '/test/repo', false);
          expect(result).toContain('Error: Command contains potentially dangerous arguments');
          expect(mockExecFileSync).not.toHaveBeenCalled();
        }

        // -c flag should now be blocked
        const blockedConfigArgs = [
          'log -c core.editor=vim',
          'diff --config user.name=evil',
        ];
        
        for (const cmd of blockedConfigArgs) {
          jest.clearAllMocks();
          const result = await executor.execute(cmd, '/test/repo', false);
          expect(result).toContain('Error: Command contains potentially dangerous arguments');
          expect(mockExecFileSync).not.toHaveBeenCalled();
        }
      });

      it('should allow safe read-only commands', async () => {
        const safeCommands = [
          'log --oneline -5',
          'diff HEAD~1 HEAD',
          'show abc123',
          'blame file.txt',
          'status',
          'rev-parse HEAD',
          'ls-files',
          'cat-file -p HEAD',
          'describe --tags',
        ];

        mockExecFileSync.mockReturnValue('output');

        for (const cmd of safeCommands) {
          jest.clearAllMocks();
          const result = await executor.execute(cmd, '/test/repo', false);
          expect(result).not.toContain('Error');
          expect(result).toBe('output');
          expect(mockExecFileSync).toHaveBeenCalled();
        }
      });

      it('should detect command injection attempts', async () => {
        const injectionAttempts = [
          '; rm -rf /',
          '&& malicious-command',
          '| evil-pipe',
          '& background-job',
          '|| fallback-command',
          '$(dangerous-subshell)',
          '`backtick-execution`',
        ];

        for (const cmd of injectionAttempts) {
          const result = await executor.execute(cmd, '/test/repo', false);
          // These shell operators become the command name
          const firstToken = cmd.trim().split(/\s+/)[0];
          expect(result).toContain(`Error: Command '${firstToken}' is not allowed`);
          expect(mockExecFileSync).not.toHaveBeenCalled();
        }
      });

      it('should handle path arguments in commands', async () => {
        mockExecFileSync.mockReturnValue('output');
        const pathCommands = [
          'show ../../../etc/passwd',
          'diff ..\\..\\windows\\system32',
          'log %2e%2e%2fetc%2fpasswd',
          'blame ..%2f..%2f..%2fsensitive',
        ];

        // The implementation doesn't block path traversal in arguments
        // Git itself would handle these paths
        for (const cmd of pathCommands) {
          jest.clearAllMocks();
          const result = await executor.execute(cmd, '/test/repo', false);
          expect(result).toBe('output');
          expect(mockExecFileSync).toHaveBeenCalled();
        }
      });

      it('should sanitize control characters', async () => {
        mockExecFileSync.mockReturnValue('output');
        
        const dirtyCommand = 'log\x00\x01\x02\x1F --oneline';
        const result = await executor.execute(dirtyCommand, '/test/repo', false);
        
        // Should execute with cleaned command
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git',
          expect.arrayContaining(['log', '--oneline']),
          expect.any(Object)
        );
      });

      it('should enforce command length limit', async () => {
        const longCommand = 'log ' + 'a'.repeat(2000);
        const result = await executor.execute(longCommand, '/test/repo', false);
        
        expect(result).toContain('Error: Command too long');
        expect(result).toContain('max 1000 characters');
        expect(mockExecFileSync).not.toHaveBeenCalled();
      });
    });

    describe('Git Execution', () => {
      it('should set correct environment variables', async () => {
        mockExecFileSync.mockReturnValue('output');
        
        await executor.execute('log', '/test/repo', false);
        
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git',
          [
            `--git-dir=${path.join('/test/repo', '.shadowgit.git')}`,
            '--work-tree=/test/repo',
            'log'
          ],
          expect.objectContaining({
            cwd: '/test/repo',
            encoding: 'utf-8',
            timeout: 10000,
            maxBuffer: 10 * 1024 * 1024,
            env: expect.objectContaining({
              GIT_TERMINAL_PROMPT: '0',
              GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
              GIT_PAGER: 'cat',
              PAGER: 'cat'
            })
          })
        );
      });

      it('should pass custom environment variables', async () => {
        mockExecFileSync.mockReturnValue('output');
        
        const customEnv = {
          GIT_AUTHOR_NAME: 'Test User',
          GIT_AUTHOR_EMAIL: 'test@example.com',
        };
        
        await executor.execute('commit -m "test"', '/test/repo', true, customEnv);
        
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git',
          [
            `--git-dir=${path.join('/test/repo', '.shadowgit.git')}`,
            '--work-tree=/test/repo',
            'commit', '-m', 'test'
          ],
          expect.objectContaining({
            env: expect.objectContaining({
              GIT_AUTHOR_NAME: 'Test User',
              GIT_AUTHOR_EMAIL: 'test@example.com',
            }),
          })
        );
      });

      it('should handle successful command execution', async () => {
        const expectedOutput = 'commit abc1234\nAuthor: Test';
        mockExecFileSync.mockReturnValue(expectedOutput);
        
        const result = await executor.execute('log -1', '/test/repo', false);
        
        expect(result).toBe(expectedOutput);
      });

      it('should handle empty output', async () => {
        mockExecFileSync.mockReturnValue('');
        
        const result = await executor.execute('status', '/test/repo', false);
        
        expect(result).toBe('(empty output)');
      });

      it('should handle multi-line output', async () => {
        const multiLine = 'line1\nline2\nline3\n';
        mockExecFileSync.mockReturnValue(multiLine);
        
        const result = await executor.execute('log', '/test/repo', false);
        
        expect(result).toBe(multiLine);
      });
    });

    describe('Error Handling', () => {
      it('should handle git not installed (ENOENT)', async () => {
        const error: any = new Error('Command not found');
        error.code = 'ENOENT';
        mockExecFileSync.mockImplementation(() => {
          throw error;
        });
        
        const result = await executor.execute('log', '/test/repo', false);
        
        // ENOENT won't have stderr/stdout, falls to generic error
        expect(result).toBe('Error: Error: Command not found');
      });

      it('should handle timeout (ETIMEDOUT)', async () => {
        const error: any = new Error('Command timeout');
        error.code = 'ETIMEDOUT';
        mockExecFileSync.mockImplementation(() => {
          throw error;
        });
        
        const result = await executor.execute('log', '/test/repo', false);
        
        expect(result).toContain('Error: Command timed out after');
        expect(result).toContain('ms');
      });

      it('should handle buffer overflow (ENOBUFS)', async () => {
        const error: any = new Error('Buffer overflow');
        error.code = 'ENOBUFS';
        mockExecFileSync.mockImplementation(() => {
          throw error;
        });
        
        const result = await executor.execute('log', '/test/repo', false);
        
        // ENOBUFS won't have stderr/stdout, falls to generic error
        expect(result).toBe('Error: Error: Buffer overflow');
      });

      it('should handle git errors (exit code 128)', async () => {
        const error: any = new Error('Git error');
        error.status = 128;
        error.code = 'GITERROR';
        error.stderr = Buffer.from('fatal: bad revision');
        mockExecFileSync.mockImplementation(() => {
          throw error;
        });
        
        const result = await executor.execute('log bad-ref', '/test/repo', false);
        
        expect(result).toContain('Error executing git command');
        expect(result).toContain('fatal: bad revision');
      });

      it('should handle git errors with status but no stderr', async () => {
        const error: any = new Error('Git failed');
        error.status = 1;
        // Need 'code' property for it to go through the detailed error path
        error.code = 'GITERROR';
        mockExecFileSync.mockImplementation(() => {
          throw error;
        });
        
        const result = await executor.execute('log', '/test/repo', false);
        
        expect(result).toContain('Error executing git command');
        expect(result).toContain('Git failed');
      });

      it('should handle generic errors', async () => {
        mockExecFileSync.mockImplementation(() => {
          throw new Error('Unexpected error');
        });
        
        const result = await executor.execute('log', '/test/repo', false);
        
        // Generic errors without code property go through the fallback
        expect(result).toBe('Error: Error: Unexpected error');
      });

      it('should handle non-Error objects thrown', async () => {
        mockExecFileSync.mockImplementation(() => {
          throw 'String error';
        });
        
        const result = await executor.execute('log', '/test/repo', false);
        
        expect(result).toContain('Error: String error');
      });
    });

    describe('Special Cases', () => {
      it('should handle Windows-style paths', async () => {
        mockExecFileSync.mockReturnValue('output');
        
        const windowsPath = 'C:\\Users\\Test\\Project';
        await executor.execute('log', windowsPath, false);
        
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git',
          [
            `--git-dir=${path.join(windowsPath, '.shadowgit.git')}`,
            `--work-tree=${windowsPath}`,
            'log'
          ],
          expect.objectContaining({
            cwd: windowsPath,
          })
        );
      });

      it('should handle paths with spaces', async () => {
        mockExecFileSync.mockReturnValue('output');
        
        const pathWithSpaces = '/path/with spaces/project';
        await executor.execute('log', pathWithSpaces, false);
        
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git',
          [
            `--git-dir=${path.join(pathWithSpaces, '.shadowgit.git')}`,
            `--work-tree=${pathWithSpaces}`,
            'log'
          ],
          expect.objectContaining({
            cwd: pathWithSpaces,
          })
        );
      });

      it('should handle Unicode in output', async () => {
        const unicodeOutput = 'commit with emoji 🎉 and 中文';
        mockExecFileSync.mockReturnValue(unicodeOutput);
        
        const result = await executor.execute('log', '/test/repo', false);
        
        expect(result).toBe(unicodeOutput);
      });

      it('should handle binary output gracefully', async () => {
        // When encoding is specified, execFileSync returns a string even for binary data
        // It will be garbled but still a string
        const garbledString = '\uFFFD\uFFFD\u0000\u0001';
        mockExecFileSync.mockReturnValue(garbledString);
        
        const result = await executor.execute('cat-file -p HEAD:binary', '/test/repo', false);
        
        // Should return a string
        expect(typeof result).toBe('string');
        expect(result).toBe(garbledString);
      });
    });
  });
});