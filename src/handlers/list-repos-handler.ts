/**
 * Handler for list_repos tool
 */

import { RepositoryManager } from '../core/repository-manager';
import { createTextResponse, formatRepositoryList } from '../utils/response-utils';
import type { MCPToolResponse } from '../types';

export class ListReposHandler {
  constructor(private repositoryManager: RepositoryManager) {}

  /**
   * Handle list_repos tool execution
   */
  async handle(): Promise<MCPToolResponse> {
    const repos = this.repositoryManager.getRepositories();
    
    if (repos.length === 0) {
      return createTextResponse(
        `No repositories found in ShadowGit.

To add repositories:
1. Open the ShadowGit application
2. Click "Add Repository" 
3. Select the repository you want to track

ShadowGit will automatically create shadow repositories (.shadowgit.git) to track changes.`
      );
    }
    
    const repoList = formatRepositoryList(repos);
    const firstRepo = repos[0].name;
    
    return createTextResponse(
      `🚀 **ShadowGit MCP Server Connected**
${'='.repeat(50)}

📁 **Available Repositories (${repos.length})**
${repoList}

${'='.repeat(50)}
⚠️ **CRITICAL: Required Workflow for ALL Changes**
${'='.repeat(50)}

**You MUST follow this 4-step workflow:**

1️⃣ **START SESSION** (before ANY edits)
   \`start_session({repo: "${firstRepo}", description: "your task"})\`

2️⃣ **MAKE YOUR CHANGES**
   Edit code, fix bugs, add features

3️⃣ **CREATE CHECKPOINT** (after changes complete)
   \`checkpoint({repo: "${firstRepo}", title: "Clear commit message"})\`

4️⃣ **END SESSION** (to resume auto-commits)
   \`end_session({sessionId: "...", commitHash: "..."})\`

${'='.repeat(50)}

💡 **Quick Start Examples:**
\`\`\`javascript
// Check recent history
git_command({repo: "${firstRepo}", command: "log -5"})

// Start your work session
start_session({repo: "${firstRepo}", description: "Fixing authentication bug"})
\`\`\`

📖 **NEXT STEP:** Call \`start_session()\` before making any changes!`
    );
  }
}