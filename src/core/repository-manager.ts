/**
 * Repository discovery and management
 */

import * as path from 'path';
import * as os from 'os';
import { getStorageLocation, fileExists, readJsonFile } from '../utils/file-utils';
import { log } from '../utils/logger';
import { SHADOWGIT_DIR } from '../utils/constants';
import type { Repository } from '../types';

export class RepositoryManager {
  private repositories: Repository[] = [];

  constructor() {
    this.loadRepositories();
  }

  /**
   * Load repositories from ShadowGit's configuration
   */
  private loadRepositories(): void {
    const storageLocation = getStorageLocation();
    const repositoryPath = path.join(storageLocation, 'repos.json');
    
    log('info', `Loading repositories from ${repositoryPath}`);
    
    this.repositories = readJsonFile<Repository[]>(repositoryPath, []);
    
    log('info', `Loaded ${this.repositories.length} repositories`);
    
    if (this.repositories.length === 0) {
      log('warn', 'No repositories found. Please add repositories via ShadowGit app.');
    }
  }

  /**
   * Get all loaded repositories
   */
  getRepositories(): Repository[] {
    return this.repositories;
  }

  /**
   * Find a repository by name
   */
  findRepository(name: string): Repository | undefined {
    return this.repositories.find(r => r.name === name);
  }

  /**
   * Resolve a repository name or path to an absolute path
   */
  resolveRepoPath(repoNameOrPath: string): string | null {
    // Handle null/undefined inputs
    if (!repoNameOrPath) {
      log('warn', 'No repository name or path provided');
      return null;
    }

    // First, check if it's a known repository name
    const knownRepo = this.findRepository(repoNameOrPath);
    if (knownRepo) {
      // Expand tilde in repository path if present
      let repoPath = knownRepo.path;
      if (repoPath.startsWith('~')) {
        const homeDir = os.homedir();
        if (repoPath === '~') {
          repoPath = homeDir;
        } else if (repoPath.startsWith('~/')) {
          repoPath = path.join(homeDir, repoPath.slice(2));
        }
      }
      
      // Validate that the repository exists and has a .shadowgit.git directory
      const shadowgitPath = path.join(repoPath, SHADOWGIT_DIR);
      
      if (fileExists(shadowgitPath)) {
        log('debug', `Resolved repository '${repoNameOrPath}' to path: ${repoPath}`);
        return repoPath;
      } else {
        log('warn', `Repository '${repoNameOrPath}' exists but .shadowgit.git directory not found at: ${shadowgitPath}`);
        log('warn', 'Please ensure ShadowGit is monitoring this repository.');
        return null;
      }
    }
    
    // Support Unix-style paths and Windows paths
    const isPath = repoNameOrPath.startsWith('/') || 
                   repoNameOrPath.startsWith('~') ||
                   repoNameOrPath.includes(':') || // Windows drive letter
                   repoNameOrPath.startsWith('\\\\'); // UNC path
                   
    if (isPath) {
      // Properly handle tilde expansion
      let resolvedPath = repoNameOrPath;
      if (repoNameOrPath.startsWith('~')) {
        const homeDir = os.homedir();
        if (repoNameOrPath === '~') {
          resolvedPath = homeDir;
        } else if (repoNameOrPath.startsWith('~/')) {
          resolvedPath = path.join(homeDir, repoNameOrPath.slice(2));
        } else {
          // ~username not supported, return null
          log('warn', `Unsupported tilde expansion: ${repoNameOrPath}`);
          return null;
        }
      }
      
      resolvedPath = path.normalize(resolvedPath);
      
      // Ensure the resolved path is absolute and doesn't escape
      if (!path.isAbsolute(resolvedPath)) {
        log('warn', `Invalid path provided: ${repoNameOrPath}`);
        return null;
      }
      
      if (fileExists(resolvedPath)) {
        // Validate that the path has a .shadowgit.git directory
        const shadowgitPath = path.join(resolvedPath, SHADOWGIT_DIR);
        if (fileExists(shadowgitPath)) {
          return resolvedPath;
        } else {
          log('warn', `Path exists but .shadowgit.git directory not found at: ${shadowgitPath}`);
          return null;
        }
      }
    }
    
    return null;
  }
}