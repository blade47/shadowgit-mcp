/**
 * Git command execution with security and safety checks
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../utils/logger';
import { 
  SHADOWGIT_DIR, 
  TIMEOUT_MS, 
  MAX_BUFFER_SIZE, 
  MAX_COMMAND_LENGTH 
} from '../utils/constants';
import { SAFE_COMMANDS, isDangerousArg } from './security-constants';

export class GitExecutor {

  /**
   * Execute a git command with security checks
   * @param command - Either a string command or array of arguments
   */
  async execute(
    command: string | string[], 
    repoPath: string, 
    isInternal = false,
    additionalEnv?: NodeJS.ProcessEnv
  ): Promise<string> {
    // Parse command into arguments
    let args: string[];
    
    if (Array.isArray(command)) {
      // Array-based command (safer for internal use)
      args = command;
    } else {
      // String command - check length only for external calls
      if (!isInternal && command.length > MAX_COMMAND_LENGTH) {
        return `Error: Command too long (max ${MAX_COMMAND_LENGTH} characters).`;
      }
    
      // Remove control characters
      const sanitizedCommand = command.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // Simple argument parsing that handles quotes and all whitespace
      args = [];
      let current = '';
      let inQuotes = false;
      let quoteChar = '';
      
      for (let i = 0; i < sanitizedCommand.length; i++) {
        const char = sanitizedCommand[i];
        const nextChar = sanitizedCommand[i + 1];
        
        if (!inQuotes && (char === '"' || char === "'")) {
          inQuotes = true;
          quoteChar = char;
        } else if (inQuotes && char === '\\' && nextChar === quoteChar) {
          // Handle escaped quote
          current += quoteChar;
          i++; // Skip the quote
        } else if (inQuotes && char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else if (!inQuotes && /\s/.test(char)) {
          // Split on any whitespace (space, tab, etc.)
          if (current) {
            args.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }
      if (current) {
        args.push(current);
      }
    }
    
    if (args.length === 0) {
      return 'Error: No command provided.';
    }
    
    const gitCommand = args[0];
    
    // Safety check 1: ALWAYS block dangerous arguments
    for (const arg of args) {
      if (isDangerousArg(arg)) {
        return 'Error: Command contains potentially dangerous arguments.';
      }
    }
    
    // Safety check 2: Only check command whitelist for external calls
    if (!isInternal && !SAFE_COMMANDS.has(gitCommand)) {
      return `Error: Command '${gitCommand}' is not allowed. Only read-only commands are permitted.

Allowed commands: ${Array.from(SAFE_COMMANDS).join(', ')}`;
    }
    
    // Safety check 3: Ensure we're operating on a .shadowgit.git repository
    const gitDir = path.join(repoPath, SHADOWGIT_DIR);
    
    if (!fs.existsSync(gitDir)) {
      return `Error: Not a ShadowGit repository. The .shadowgit.git directory was not found at ${gitDir}`;
    }
    
    log('debug', `Executing git ${gitCommand} in ${repoPath}`);
    
    try {
      const output = execFileSync('git', [
        `--git-dir=${gitDir}`,
        `--work-tree=${repoPath}`,
        ...args
      ], {
        cwd: repoPath,
        encoding: 'utf-8',
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_SIZE,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
          GIT_SSH_COMMAND: 'ssh -o BatchMode=yes', // Disable SSH prompts
          GIT_PAGER: 'cat', // Disable pager
          PAGER: 'cat', // Fallback pager disable
          ...additionalEnv
        }
      });
      
      return output || '(empty output)';
    } catch (error: unknown) {
      if (error && typeof error === 'object') {
        const execError = error as any;
        
        // Check for timeout
        if (execError.code === 'ETIMEDOUT' || execError.signal === 'SIGTERM') {
          return `Error: Command timed out after ${TIMEOUT_MS}ms.`;
        }
        
        // Check for detailed error info (has stderr/stdout or status code)
        if ('stderr' in execError || 'stdout' in execError || 'status' in execError) {
          const stderr = execError.stderr?.toString() || '';
          const stdout = execError.stdout?.toString() || '';
          const message = execError.message || 'Unknown error';
          
          return `Error executing git command:
${message}
${stderr ? `\nError output:\n${stderr}` : ''}
${stdout ? `\nPartial output:\n${stdout}` : ''}`;
        }
      }
      
      return `Error: ${error}`;
    }
  }
}