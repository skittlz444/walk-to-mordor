import { fellowshipPath, type PathNode } from './fellowship-path';

export const DEFAULT_PATH_KEY = 'fellowship';

export const pathRegistry: Record<string, PathNode[]> = {
  [DEFAULT_PATH_KEY]: fellowshipPath,
};

export function getPathByKey(pathKey: string | null | undefined): PathNode[] {
  if (!pathKey) return fellowshipPath;
  return pathRegistry[pathKey] ?? fellowshipPath;
}
