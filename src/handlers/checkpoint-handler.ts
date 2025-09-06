/**
 * Handler for checkpoint tool - creates git commits
 */

import { RepositoryManager } from '../core/repository-manager';
import { GitExecutor } from '../core/git-executor';
import { createErrorResponse } from '../utils/response-utils';
import type { MCPToolResponse, ManualCheckpointArgs } from '../types';

export class CheckpointHandler {
  constructor(
    private repositoryManager: RepositoryManager,
    private gitExecutor: GitExecutor
  ) {}

  /**
   * Validate checkpoint arguments
   */
  private isValidArgs(args: unknown): args is ManualCheckpointArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      'repo' in args &&
      'title' in args &&
      typeof (args as ManualCheckpointArgs).repo === 'string' &&
      typeof (args as ManualCheckpointArgs).title === 'string'
    );
  }

  /**
   * Handle checkpoint tool execution
   */
  async handle(args: unknown): Promise<MCPToolResponse> {
    if (!this.isValidArgs(args)) {
      return createErrorResponse(
        "Error: Both 'repo' and 'title' parameters are required.",
        `Example usage:
  checkpoint({
    repo: "my-project",
    title: "Fix authentication bug",
    author: "Claude"
  })

Use list_repos() to see available repositories.`
      );
    }
    
    // Validate title length
    if (args.title.length > 50) {
      return createErrorResponse(
        `Error: Title must be 50 characters or less (current: ${args.title.length} chars).`
      );
    }
    
    // Validate message length if provided
    if (args.message && args.message.length > 1000) {
      return createErrorResponse(
        `Error: Message must be 1000 characters or less (current: ${args.message.length} chars).`
      );
    }
    
    const repoPath = this.repositoryManager.resolveRepoPath(args.repo);
    
    if (!repoPath) {
      const repos = this.repositoryManager.getRepositories();
      
      if (repos.length === 0) {
        return createErrorResponse(
          'Error: No repositories found. Please add repositories to ShadowGit first.'
        );
      }
      
      return createErrorResponse(
        `Error: Repository '${args.repo}' not found.`,
        `Available repositories:
${repos.map(r => `  - ${r.name}: ${r.path}`).join('\n')}`
      );
    }


    // Check for changes
    const statusOutput = await this.gitExecutor.execute(['status', '--porcelain'], repoPath, true);
    
    if (!statusOutput || statusOutput.trim() === '' || statusOutput === '(empty output)') {
      return createErrorResponse(
        `❌ **No Changes Detected**
${'='.repeat(50)}

📁 Repository has no changes to commit.

⚠️ **Important:** Do NOT call end_session() - no commit was created.

💡 **NEXT STEP:** Make some changes first, then call checkpoint() again.`
      );
    }
    
    // Build commit message
    const commitTitle = args.title;
    const commitBody = args.message || '';
    const author = args.author || 'AI Assistant';
    
    // Add all changes
    const addOutput = await this.gitExecutor.execute(['add', '-A'], repoPath, true);
    
    if (addOutput.startsWith('Error:')) {
      return createErrorResponse(
        `❌ **Failed to Stage Changes**
${'='.repeat(50)}

🚨 **Error:** ${addOutput}

⚠️ **Important:** Do NOT call end_session() - commit was not created.

💡 **NEXT STEP:** Check the error and try again.`
      );
    }
    
    // Build full commit message
    let fullMessage = commitTitle;
    if (commitBody) {
      fullMessage += `\n\n${commitBody}`;
    }
    fullMessage += `\n\nAuthor: ${author} (via ShadowGit MCP)`;
    
    // Create commit with author information
    const commitEnv = {
      GIT_AUTHOR_NAME: author,
      GIT_AUTHOR_EMAIL: `${author.toLowerCase().replace(/\s+/g, '-')}@shadowgit.local`,
      GIT_COMMITTER_NAME: 'ShadowGit MCP',
      GIT_COMMITTER_EMAIL: 'shadowgit-mcp@shadowgit.local'
    };
    
    // Use array-based command to avoid parsing issues
    const commitOutput = await this.gitExecutor.execute(
      ['commit', '-m', fullMessage],
      repoPath,
      true,
      commitEnv
    );
    
    if (commitOutput.startsWith('Error:')) {
      return createErrorResponse(
        `❌ **Failed to Create Commit**
${'='.repeat(50)}

🚨 **Error:** ${commitOutput}

⚠️ **Important:** Do NOT call end_session() - commit was not created.

💡 **NEXT STEP:** Check the error message and try checkpoint() again.`
      );
    }
    
    // Extract commit hash from output
    let commitHash: string | undefined;
    const hashMatch = commitOutput.match(/\[[\w\-]+ ([a-f0-9]+)\]/);
    if (hashMatch) {
      commitHash = hashMatch[1];
    }
    
    
    // Get summary of changes
    const showOutput = await this.gitExecutor.execute(['show', '--stat', '--format=short', 'HEAD'], repoPath, true);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ **Checkpoint Created Successfully!**
${'='.repeat(50)}

📦 **Commit Details:**
${commitOutput}

📊 **Changes Summary:**
${showOutput}

🔑 **Commit Hash:** \`${commitHash || 'unknown'}\`

${'='.repeat(50)}

📋 **Workflow Progress:**
- [x] Session started
- [x] Changes made
- [x] Checkpoint created ✨
- [ ] Session ended

🚨 **REQUIRED NEXT STEP:**
You MUST now call \`end_session()\` to resume auto-commits:

\`\`\`javascript
end_session({
  sessionId: "your-session-id",
  commitHash: "${commitHash || 'unknown'}"
})
\`\`\`

⚠️ **Important:** Only call end_session() because the commit was SUCCESSFUL.`
        }
      ],
      success: true
    };
  }
}