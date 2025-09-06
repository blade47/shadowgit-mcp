# Changelog

All notable changes to the ShadowGit MCP Server will be documented in this file.

## [1.1.2] - 2025-09-05

### Security Improvements
- **Critical**: Removed `branch`, `tag`, `reflog` commands to prevent destructive operations
- Added `-C` flag to blocked arguments to prevent directory changes
- Enhanced repository validation to check for .shadowgit.git on raw paths

### Bug Fixes
- Fixed remaining error responses in SessionHandler to use createErrorResponse
- Aligned email domains to consistently use @shadowgit.local

## [1.1.1] - 2025-09-05

### Security Improvements
- **Critical**: Block `--git-dir` and `--work-tree` flags to prevent repository escape attacks
- Switched internal commands to array-based execution, eliminating command injection risks
- Enhanced Git error reporting to include stderr/stdout for better debugging
- Fixed command length validation to only apply to external commands

### Features
- Added `SHADOWGIT_HINTS` environment variable to toggle workflow hints (set to `0` to disable)
- Standardized all error responses with consistent `success: false` flag

### Bug Fixes
- Fixed string command parser to handle all whitespace characters (tabs, spaces, etc.)
- Fixed Jest configuration for extensionless imports
- Removed .js extensions from TypeScript imports for better compatibility
- Improved error handling for Git commands with exit codes

### Developer Experience
- Added comprehensive test coverage for security features
- Improved documentation with security updates and troubleshooting tips
- All 175 tests passing with improved coverage

## [1.1.0] - 2025-09-04

### Features
- Added session management with start_session and end_session
- Added checkpoint command for creating AI-authored commits
- Integrated with ShadowGit Session API for auto-commit control
- Added workflow reminders in git command outputs

### Security
- Implemented comprehensive command validation
- Added dangerous argument blocking
- Path traversal protection
- Repository validation

## [1.0.0] - 2025-09-03

### Initial Release
- MCP server implementation for ShadowGit
- Support for read-only git commands
- Repository listing functionality
- Integration with Claude Code and Claude Desktop
- Basic security restrictions