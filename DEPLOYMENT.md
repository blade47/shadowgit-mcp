# Deployment Guide

## Current Version
- **Package**: `shadowgit-mcp-server`
- **Version**: 1.1.2
- **npm Registry**: https://www.npmjs.com/package/shadowgit-mcp-server

## Installation

### For Users
```bash
# Install globally from npm
npm install -g shadowgit-mcp-server

# The command will be available globally
shadowgit-mcp-server --version
```

### For Development
```bash
# Clone and build locally
git clone https://github.com/shadowgit/shadowgit-mcp-server.git
cd shadowgit-mcp-server
npm install
npm run build
npm link  # Makes it available globally for testing
```

## Build System

### Production Build
```bash
npm run build
```
- Creates a single optimized bundle (`dist/shadowgit-mcp-server.js`)
- Size: ~93KB (includes all dependencies)
- Uses esbuild for fast bundling and minification
- Cross-platform: Works on macOS, Windows, and Linux

### File Structure
```
dist/
├── shadowgit-mcp-server.js    # Main bundled executable (93KB)
├── shadowgit-mcp-server.d.ts  # TypeScript declarations
└── [other .d.ts files]        # Additional type definitions
```

## Publishing Updates

### 1. Update Version
```bash
npm version patch  # Bug fixes (1.1.2 -> 1.1.3)
npm version minor  # New features (1.1.2 -> 1.2.0)
npm version major  # Breaking changes (1.1.2 -> 2.0.0)
```

### 2. Build and Test
```bash
npm run build
npm test
```

### 3. Publish to npm
```bash
npm publish
```

## MCP Configuration

### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "shadowgit": {
      "command": "shadowgit-mcp-server"
    }
  }
}
```

### Direct Execution
```json
{
  "mcpServers": {
    "shadowgit": {
      "command": "node",
      "args": ["/path/to/shadowgit-mcp-server/dist/shadowgit-mcp-server.js"]
    }
  }
}
```

## Cross-Platform Support

The bundled JavaScript file works identically across all platforms:
- **macOS/Linux**: Direct execution with shebang support
- **Windows**: npm creates `.cmd` wrapper for global installs
- **Node.js Requirement**: Version 18 or higher

## Quick Commands

```bash
# Check version
shadowgit-mcp-server --version

# Build locally
npm run build

# Run tests
npm test

# Clean build artifacts
npm run clean

# Development mode (TypeScript directly)
npm run dev
```

## Troubleshooting

### Module Not Found
- Run `npm install` to ensure all dependencies are installed
- For global install issues, check npm prefix: `npm config get prefix`

### Permission Denied (Unix)
```bash
chmod +x dist/shadowgit-mcp-server.js
```

### Windows Execution
Use `node dist/shadowgit-mcp-server.js` if the global command doesn't work

## Support

- GitHub Issues: https://github.com/shadowgit/shadowgit-mcp-server
- npm Package: https://www.npmjs.com/package/shadowgit-mcp-server