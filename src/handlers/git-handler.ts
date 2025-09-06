/**
 * Handler for git_command tool
 */

import { RepositoryManager } from '../core/repository-manager';
import { GitExecutor } from '../core/git-executor';
import { createErrorResponse, createTextResponse, createRepoNotFoundResponse } from '../utils/response-utils';
import type { MCPToolResponse, GitCommandArgs } from '../types';

export class GitHandler {
  constructor(
    private repositoryManager: RepositoryManager,
    private gitExecutor: GitExecutor
  ) {}

  /**
   * Validate git command arguments
   */
  private isGitCommandArgs(args: unknown): args is GitCommandArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      'repo' in args &&
      'command' in args &&
      typeof (args as GitCommandArgs).repo === 'string' &&
      typeof (args as GitCommandArgs).command === 'string'
    );
  }

  /**
   * Handle git_command tool execution
   */
  async handle(args: unknown): Promise<MCPToolResponse> {
    if (!this.isGitCommandArgs(args)) {
      return createErrorResponse(
        "Error: Both 'repo' and 'command' parameters are required.",
        `Example usage:
  git_command({repo: "my-project", command: "log --oneline -10"})
  git_command({repo: "my-project", command: "diff HEAD~1"})
  
Use list_repos() to see available repositories.`
      );
    }

    const repoPath = this.repositoryManager.resolveRepoPath(args.repo);
    
    if (!repoPath) {
      const repos = this.repositoryManager.getRepositories();
      return createRepoNotFoundResponse(args.repo, repos);
    }

    const output = await this.gitExecutor.execute(args.command, repoPath);
    
    // Add workflow reminder for common commands that suggest changes are being planned
    // Show workflow hints unless disabled
    const showHints = process.env.SHADOWGIT_HINTS !== '0';
    const reminderCommands = ['diff', 'status', 'log', 'blame'];
    const needsReminder = showHints && reminderCommands.some(cmd => args.command.toLowerCase().includes(cmd));
    
    if (needsReminder) {
      return createTextResponse(
        `${output}

${'='.repeat(50)}
📝 **Planning to Make Changes?**
${'='.repeat(50)}

**Required Workflow:**
1️⃣ \`start_session({repo: "${args.repo}", description: "your task"})\`
2️⃣ Make your changes
3️⃣ \`checkpoint({repo: "${args.repo}", title: "commit message"})\`
4️⃣ \`end_session({sessionId: "...", commitHash: "..."})\`

💡 **NEXT STEP:** Call \`start_session()\` before editing any files!`
      );
    }
    
    return createTextResponse(output);
  }
}