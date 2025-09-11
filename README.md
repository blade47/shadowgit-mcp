# ShadowGit MCP Server

[![npm version](https://badge.fury.io/js/shadowgit-mcp-server.svg)](https://www.npmjs.com/package/shadowgit-mcp-server)

A Model Context Protocol (MCP) server that provides AI assistants with secure git access to your ShadowGit repositories, including the ability to create organized commits through the Session API. This enables powerful debugging, code analysis, and clean commit management by giving AI controlled access to your project's git history.

## What is ShadowGit?

[ShadowGit](https://shadowgit.com) automatically captures every save as a git commit while also providing a Session API that allows AI assistants to pause auto-commits and create clean, organized commits. The MCP server provides both read access to your detailed development history and the ability to manage AI-assisted changes properly.

## Installation

```bash
npm install -g shadowgit-mcp-server
```

## Setup with Claude Code

```bash
# Add to Claude Code
claude mcp add shadowgit -- shadowgit-mcp-server

# Restart Claude Code to load the server
```

## Setup with Claude Desktop

Add to your Claude Desktop MCP configuration:

**macOS/Linux:** `~/.config/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\\Claude\\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "shadowgit": {
      "command": "shadowgit-mcp-server"
    }
  }
}
```

## Requirements

- **Node.js 18+**
- **ShadowGit app** installed and running with tracked repositories
  - Session API requires ShadowGit version >= 0.3.0
- **Git** available in PATH

## How It Works

**MCP servers are stateless and use stdio transport:**
- The server runs on-demand when AI tools (Claude, Cursor) invoke it
- Communication happens via stdin/stdout, not HTTP
- The server starts when needed and exits when done
- No persistent daemon or background process

## Environment Variables

You can configure the server behavior using these optional environment variables:

- `SHADOWGIT_TIMEOUT` - Command execution timeout in milliseconds (default: 10000)
- `SHADOWGIT_SESSION_API` - Session API URL (default: http://localhost:45289/api)
- `SHADOWGIT_LOG_LEVEL` - Log level: debug, info, warn, error (default: info)
- `SHADOWGIT_HINTS` - Set to `0` to disable workflow hints in git command outputs (default: enabled)

Example:
```bash
export SHADOWGIT_TIMEOUT=30000  # 30 second timeout
export SHADOWGIT_LOG_LEVEL=debug  # Enable debug logging
export SHADOWGIT_HINTS=0  # Disable workflow banners for cleaner output
```

## Available Commands

### Session Management

**The Session API** (requires ShadowGit >= 0.3.0) allows AI assistants to temporarily pause ShadowGit's auto-commit feature and create clean, organized commits instead of having fragmented auto-commits during AI work.

**IMPORTANT**: AI assistants MUST follow this four-step workflow when making changes:

1. **`start_session({repo, description})`** - Start work session BEFORE making changes (pauses auto-commits)
2. **Make your changes** - Edit code, fix bugs, add features
3. **`checkpoint({repo, title, message?, author?})`** - Create a clean commit AFTER completing work  
4. **`end_session({sessionId, commitHash?})`** - End session when done (resumes auto-commits)

This workflow ensures AI-assisted changes result in clean, reviewable commits instead of fragmented auto-saves.

### `list_repos()`
Lists all ShadowGit-tracked repositories.

```javascript
await shadowgit.list_repos()
```

### `git_command({repo, command})`
Executes read-only git commands on a specific repository.

```javascript
// View recent commits
await shadowgit.git_command({
  repo: "my-project",
  command: "log --oneline -10"
})

// Check what changed recently
await shadowgit.git_command({
  repo: "my-project", 
  command: "diff HEAD~5 HEAD --stat"
})

// Find who changed a specific line
await shadowgit.git_command({
  repo: "my-project",
  command: "blame src/auth.ts"
})
```

### `start_session({repo, description})`
Starts an AI work session using the Session API. This pauses ShadowGit's auto-commit feature, allowing you to make multiple changes that will be grouped into a single clean commit.

```javascript
const result = await shadowgit.start_session({
  repo: "my-app",
  description: "Fixing authentication bug"
})
// Returns: Session ID (e.g., "mcp-client-1234567890")
```

### `checkpoint({repo, title, message?, author?})`
Creates a checkpoint commit to save your work.

```javascript
// After fixing a bug
const result = await shadowgit.checkpoint({
  repo: "my-app",
  title: "Fix null pointer exception in auth",
  message: "Added null check before accessing user object",
  author: "Claude"
})
// Returns formatted commit details including the commit hash

// After adding a feature
await shadowgit.checkpoint({
  repo: "my-app",
  title: "Add dark mode toggle",
  message: "Implemented theme switching using CSS variables and localStorage persistence",
  author: "GPT-4"
})

// Minimal usage (author defaults to "AI Assistant")
await shadowgit.checkpoint({
  repo: "my-app",
  title: "Update dependencies"
})
```

### `end_session({sessionId, commitHash?})`
Ends the AI work session via the Session API. This resumes ShadowGit's auto-commit functionality for regular development.

```javascript
await shadowgit.end_session({
  sessionId: "mcp-client-1234567890",
  commitHash: "abc1234"  // Optional: from checkpoint result
})
```

**Parameters:**
- `repo` (required): Repository name or full path
- `title` (required): Short commit title (max 50 characters)
- `message` (optional): Detailed description of changes
- `author` (optional): Your identifier (e.g., "Claude", "GPT-4", "Gemini") - defaults to "AI Assistant"

**Notes:**
- Sessions prevent auto-commits from interfering with AI work
- Automatically respects `.gitignore` patterns
- Creates a timestamped commit with author identification
- Will report if there are no changes to commit

## Security

- **Read-only access**: Only safe git commands are allowed
- **No write operations**: Commands like `commit`, `push`, `merge` are blocked
- **No destructive operations**: Commands like `branch`, `tag`, `reflog` are blocked to prevent deletions
- **Repository validation**: Only ShadowGit repositories can be accessed  
- **Path traversal protection**: Attempts to access files outside repositories are blocked
- **Command injection prevention**: Uses `execFileSync` with array arguments for secure execution
- **Dangerous flag blocking**: Blocks `--git-dir`, `--work-tree`, `--exec`, `-c`, `--config`, `-C` and other risky flags
- **Timeout protection**: Commands are limited to prevent hanging
- **Enhanced error reporting**: Git errors now include stderr/stdout for better debugging

## Best Practices for AI Assistants

When using ShadowGit MCP Server, AI assistants should:

1. **Follow the workflow**: Always: `start_session()` → make changes → `checkpoint()` → `end_session()`
2. **Use descriptive titles**: Keep titles under 50 characters but make them meaningful
3. **Always create checkpoints**: Call `checkpoint()` after completing each task
4. **Identify yourself**: Use the `author` parameter to identify which AI created the checkpoint
5. **Document changes**: Use the `message` parameter to explain what was changed and why
6. **End sessions properly**: Always call `end_session()` to resume auto-commits

### Complete Example Workflow
```javascript
// 1. First, check available repositories
const repos = await shadowgit.list_repos()

// 2. Start session BEFORE making changes
const sessionId = await shadowgit.start_session({
  repo: "my-app",
  description: "Refactoring authentication module"
})

// 3. Examine recent history
await shadowgit.git_command({
  repo: "my-app",
  command: "log --oneline -5"
})

// 4. Make your changes to the code...
// ... (edit files, fix bugs, etc.) ...

// 5. IMPORTANT: Create a checkpoint after completing the task
const commitHash = await shadowgit.checkpoint({
  repo: "my-app",
  title: "Refactor authentication module",
  message: "Simplified login flow and added better error handling",
  author: "Claude"
})

// 6. End the session when done
await shadowgit.end_session({
  sessionId: sessionId,
  commitHash: commitHash  // Optional but recommended
})
```

## Example Use Cases

### Debug Recent Changes
```javascript
// Find what broke in the last hour
await shadowgit.git_command({
  repo: "my-app",
  command: "log --since='1 hour ago' --oneline"
})
```

### Trace Code Evolution
```javascript
// See how a function evolved
await shadowgit.git_command({
  repo: "my-app", 
  command: "log -L :functionName:src/file.ts"
})
```

### Cross-Repository Analysis
```javascript
// Compare activity across projects
const repos = await shadowgit.list_repos()
for (const repo of repos) {
  await shadowgit.git_command({
    repo: repo.name,
    command: "log --since='1 day ago' --oneline"
  })
}
```

## Troubleshooting

### No repositories found
- Ensure ShadowGit app is installed and has tracked repositories
- Check that `~/.shadowgit/repos.json` exists

### Repository not found
- Use `list_repos()` to see exact repository names
- Ensure the repository has a `.shadowgit.git` directory

### Git commands fail
- Verify git is installed: `git --version`
- Only read-only commands are allowed
- Use absolute paths or repository names from `list_repos()`
- Check error output which now includes stderr details for debugging

### Workflow hints are too verbose
- Set `SHADOWGIT_HINTS=0` environment variable to disable workflow banners
- This provides cleaner output for programmatic use

### Session API offline
If you see "Session API is offline. Proceeding without session tracking":
- The ShadowGit app may not be running
- Sessions won't be tracked but git commands will still work
- Auto-commits won't be paused (may cause fragmented commits)
- Make sure ShadowGit app is running
- Go in ShadowGit settings and check that the Session API is healthy

## Development

For contributors who want to modify or extend the MCP server:

```bash
# Clone the repository (private GitHub repo)
git clone https://github.com/shadowgit/shadowgit-mcp-server.git
cd shadowgit-mcp-server
npm install

# Build
npm run build

# Test
npm test

# Run locally for development
npm run dev

# Test the built version locally
node dist/shadowgit-mcp-server.js
```

### Publishing Updates

```bash
# Update version
npm version patch  # or minor/major

# Build and test
npm run build
npm test

# Publish to npm (public registry)
npm publish
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [ShadowGit](https://shadowgit.com) - Automatic code snapshot tool
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Model Context Protocol TypeScript SDK

---


Transform your development history into a powerful AI debugging assistant! 🚀

[![MCP Badge](https://lobehub.com/badge/mcp/shadowgit-shadowgit-mcp-server)](https://lobehub.com/mcp/shadowgit-shadowgit-mcp-server)
