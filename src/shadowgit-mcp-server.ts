/**
 * ShadowGit MCP Server - Main Entry Point
 * Provides read-only Git access, session management and checkpoint creation for AI assistants
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

import { log } from './utils/logger';
import { VERSION } from './utils/constants';
import { RepositoryManager } from './core/repository-manager';
import { GitExecutor } from './core/git-executor';
import { SessionClient } from './core/session-client';
import { GitHandler } from './handlers/git-handler';
import { ListReposHandler } from './handlers/list-repos-handler';
import { CheckpointHandler } from './handlers/checkpoint-handler';
import { SessionHandler } from './handlers/session-handler';

export class ShadowGitMCPServer {
  private server: Server;
  private repositoryManager: RepositoryManager;
  private gitExecutor: GitExecutor;
  private sessionClient: SessionClient;
  private gitHandler: GitHandler;
  private listReposHandler: ListReposHandler;
  private checkpointHandler: CheckpointHandler;
  private sessionHandler: SessionHandler;

  constructor() {
    // Initialize core services
    this.repositoryManager = new RepositoryManager();
    this.gitExecutor = new GitExecutor();
    this.sessionClient = new SessionClient();
    
    // Initialize handlers
    this.gitHandler = new GitHandler(this.repositoryManager, this.gitExecutor);
    this.listReposHandler = new ListReposHandler(this.repositoryManager);
    this.checkpointHandler = new CheckpointHandler(
      this.repositoryManager, 
      this.gitExecutor
    );
    this.sessionHandler = new SessionHandler(
      this.repositoryManager,
      this.sessionClient
    );
    
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'shadowgit-mcp-server',
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_repos',
          description: 'List all available ShadowGit repositories. Use this first to discover which repositories you can work with.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'git_command',
          description: 'Execute a read-only git command on a ShadowGit repository. Only safe, read-only commands are allowed.',
          inputSchema: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'Repository name (use list_repos to see available repositories)',
              },
              command: {
                type: 'string',
                description: 'Git command to execute (e.g., "log -10", "diff HEAD~1", "status")',
              },
            },
            required: ['repo', 'command'],
          },
        },
        {
          name: 'start_session',
          description: 'Start a work session. MUST be called BEFORE making any changes. Without this, ShadowGit will create fragmented auto-commits during your work!',
          inputSchema: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              description: {
                type: 'string',
                description: 'What you plan to do in this session',
              },
            },
            required: ['repo', 'description'],
          },
        },
        {
          name: 'checkpoint',
          description: 'Create a git commit with your changes. Call this AFTER completing your work but BEFORE end_session. Creates a clean commit for the user to review.',
          inputSchema: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              title: {
                type: 'string',
                description: 'Commit title (max 50 chars) - REQUIRED. Be specific about what was changed.',
              },
              message: {
                type: 'string',
                description: 'Detailed commit message (optional, max 1000 chars)',
              },
              author: {
                type: 'string',
                description: 'Author name (e.g., "Claude", "GPT-4"). Defaults to "AI Assistant"',
              },
            },
            required: ['repo', 'title'],
          },
        },
        {
          name: 'end_session',
          description: 'End your work session to resume ShadowGit auto-commits. MUST be called AFTER checkpoint to properly close your work session.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from start_session',
              },
              commitHash: {
                type: 'string',
                description: 'Commit hash from checkpoint (optional)',
              },
            },
            required: ['sessionId'],
          },
        }
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      log('info', `Tool called: ${name}`);
      
      try {
        switch (name) {
          case 'list_repos':
            return await this.listReposHandler.handle();
            
          case 'git_command':
            return await this.gitHandler.handle(args);
            
          case 'start_session':
            return await this.sessionHandler.startSession(args);
            
          case 'checkpoint':
            return await this.checkpointHandler.handle(args);
            
          case 'end_session':
            return await this.sessionHandler.endSession(args);
            
          default:
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown tool: ${name}. Available tools: list_repos, git_command, start_session, checkpoint, end_session`,
                },
              ],
            };
        }
      } catch (error) {
        log('error', `Tool execution error: ${error}`);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error}`,
            },
          ],
        };
      }
    });
  }

  async start(): Promise<void> {
    log('info', `Starting ShadowGit MCP Server v${VERSION}`);
    
    // Check Session API health
    const isSessionApiHealthy = await this.sessionClient.isHealthy();
    if (isSessionApiHealthy) {
      log('info', 'Session API is available - session tracking enabled');
    } else {
      log('warn', 'Session API is not available - proceeding without session tracking');
    }
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    log('info', 'ShadowGit MCP Server is running');
  }

  shutdown(signal: string): void {
    log('info', `Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  }
}

// Main entry point
async function main(): Promise<void> {
  // Handle CLI arguments
  if (process.argv.includes('--version')) {
    console.log(VERSION);
    process.exit(0);
  }
  
  try {
    const server = new ShadowGitMCPServer();
    
    // Handle shutdown signals
    process.on('SIGINT', () => server.shutdown('SIGINT'));
    process.on('SIGTERM', () => server.shutdown('SIGTERM'));
    
    await server.start();
  } catch (error) {
    log('error', `Failed to start server: ${error}`);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  log('error', `Unhandled error: ${error}`);
  process.exit(1);
});