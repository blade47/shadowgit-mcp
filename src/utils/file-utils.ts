/**
 * File system utility functions
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function getStorageLocation(): string {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin':
      return path.join(homeDir, '.shadowgit');
    case 'win32':
      return path.join(
        process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'),
        'shadowgit'
      );
    default:
      return path.join(
        process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share'),
        'shadowgit'
      );
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fileExists(filePath)) {
      return defaultValue;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    return defaultValue;
  }
}