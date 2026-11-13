import { safeAppPath } from '@/lib/deep-links';

// Every link that opens the app from outside (custom scheme, universal link, notification) passes through here first.
// Only known screens with well-formed ids get through; anything else lands on the start-up gate.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return safeAppPath(path) ?? '/';
}
