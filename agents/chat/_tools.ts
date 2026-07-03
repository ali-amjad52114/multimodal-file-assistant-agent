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

/** Default suggestions per file type for the fallback suggest_actions */
type ActionItem = { id: string; emoji: string; title: string; description: string };

export function buildDefaultActions(uploadedFiles: Array<{ name: string }>): ActionItem[] {
  const fileTypes = new Set(uploadedFiles.map(f => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['xls', 'xlsx'].includes(ext)) return 'excel';
    if (ext === 'csv') return 'csv';
    return 'text';
  }));

  if (fileTypes.has('image')) {
    return [
      { id: 'a1', emoji: '🔄', title: '格式转换', description: '将图片转换为 PNG、WebP 等其他格式' },
      { id: 'a2', emoji: '📦', title: '压缩图片', description: '压缩图片文件大小，优化存储' },
      { id: 'a3', emoji: '📐', title: '调整尺寸', description: '调整图片尺寸或裁剪' },
      { id: 'a4', emoji: '💧', title: '添加水印', description: '在图片上添加自定义文字水印' },
    ];
  }
  if (fileTypes.has('pdf')) {
    return [
      { id: 'a1', emoji: '📝', title: '提取文字', description: '从 PDF 中提取全部文本内容' },
      { id: 'a2', emoji: '📊', title: '提取表格', description: '提取 PDF 中的表格数据' },
      { id: 'a3', emoji: '📋', title: '生成摘要', description: '总结 PDF 文档的核心内容' },
      { id: 'a4', emoji: '🔗', title: '合并 PDF', description: '与其他 PDF 文件合并' },
    ];
  }
  if (fileTypes.has('word')) {
    return [
      { id: 'a1', emoji: '📄', title: '转换为 PDF', description: '将 Word 文档转换为 PDF 格式' },
      { id: 'a2', emoji: '📝', title: '提取文字', description: '提取文档中的全部文本' },
      { id: 'a3', emoji: '📊', title: '提取表格', description: '提取文档中的表格数据' },
      { id: 'a4', emoji: '📋', title: '内容摘要', description: '生成文档核心内容摘要' },
    ];
  }
  if (fileTypes.has('csv') || fileTypes.has('excel')) {
    return [
      { id: 'a1', emoji: '📊', title: '数据分析', description: '统计分析并生成摘要' },
      { id: 'a2', emoji: '📈', title: '生成图表', description: '将数据可视化为图表' },
      { id: 'a3', emoji: '📄', title: '导出 PDF 报告', description: '生成格式化的 PDF 数据报告' },
    ];
  }
  return [
    { id: 'a1', emoji: '📋', title: '内容摘要', description: '提取核心内容生成摘要' },
    { id: 'a2', emoji: '📄', title: '转换为 PDF', description: '将文本内容排版为 PDF 文件' },
    { id: 'a3', emoji: '🔍', title: '结构分析', description: '分析文件结构和关键信息' },
    { id: 'a4', emoji: '🌐', title: '翻译', description: '将内容翻译为其他语言' },
  ];
}
