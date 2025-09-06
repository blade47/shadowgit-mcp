/**
 * Shared constants for ShadowGit MCP Server
 */

export const SHADOWGIT_DIR = '.shadowgit.git';
export const TIMEOUT_MS = parseInt(process.env.SHADOWGIT_TIMEOUT || '10000', 10); // Default 10 seconds
export const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_COMMAND_LENGTH = 1000; // Maximum git command length
export const VERSION = '1.1.2';

// Session API configuration
export const SESSION_API_URL = process.env.SHADOWGIT_SESSION_API || 'http://localhost:45289/api';
export const SESSION_API_TIMEOUT = 3000; // 3 seconds timeout for session API calls