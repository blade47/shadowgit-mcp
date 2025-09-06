/**
 * Security constants for Git command validation
 */

// Read-only commands allowed for AI assistants
export const SAFE_COMMANDS = new Set([
  'log', 'show', 'diff', 'status',
  'describe', 'rev-parse', 'ls-files',
  'ls-tree', 'cat-file', 'show-branch', 'shortlog',
  'rev-list', 'blame'
]);

// Dangerous arguments that should always be blocked
export const DANGEROUS_PATTERNS = [
  '--upload-pack',
  '--receive-pack', 
  '--exec',
  '-c',              // Block config overrides
  '--config',
  '-e',              // Block -e flag
  '--git-dir',       // Block repository override
  '--work-tree',     // Block work tree override
  '-C'               // Block directory change
];

// Check if an argument is dangerous
export function isDangerousArg(arg: string): boolean {
  const lowerArg = arg.toLowerCase();
  return DANGEROUS_PATTERNS.some(pattern => 
    lowerArg === pattern || lowerArg.startsWith(pattern + '=')
  );
}