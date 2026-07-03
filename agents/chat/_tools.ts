/**
 * Shared utilities for the document processing agent.
 * (TOOLS array and buildToolExecutors removed — now handled by Claude Agent SDK + MCP servers)
 */

/** Shell-safe single-quote wrapping */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Text file extensions that can be inlined when sandbox is unavailable */
const TEXT_FALLBACK_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json', '.xml', '.html', '.css',
  '.js', '.ts', '.tsx', '.py', '.log', '.yml', '.yaml', '.sql',
]);

/** Check if a file can be safely inlined as UTF-8 text */
export function canInlineFallbackFile(fileName: string, content: Buffer): boolean {
  const lowerName = fileName.toLowerCase();
  const extension = lowerName.includes('.')
    ? lowerName.slice(lowerName.lastIndexOf('.'))
    : '';
  if (!TEXT_FALLBACK_EXTENSIONS.has(extension)) return false;
  if (content.includes(0)) return false;

  const decoded = content.toString('utf8');
  const replacementCount = decoded.match(/\uFFFD/g)?.length ?? 0;
  return replacementCount / Math.max(decoded.length, 1) < 0.01;
}

/** Default FaultPack suggestions for the fallback suggest_actions */
type ActionItem = { id: string; emoji: string; title: string; description: string };

export function buildDefaultActions(_uploadedFiles: Array<{ name: string }>): ActionItem[] {
  return [
    { id: 'a1', emoji: '📄', title: 'Generate Troubleshooting PDF', description: 'Create the downloadable field troubleshooting brief' },
    { id: 'a2', emoji: '🔍', title: 'List likely causes', description: 'Rank probable causes from the OEM manual fault section' },
    { id: 'a3', emoji: '🛡️', title: 'Check safety requirements', description: 'Find LOTO and access rules in the site procedure' },
    { id: 'a4', emoji: '🏷️', title: 'Identify the asset', description: 'Locate the asset, breaker, and interlocks in the drawing' },
  ];
}
