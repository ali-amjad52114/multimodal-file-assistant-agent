'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { useI18n } from '@/lib/i18n';
import { DeployButtons } from './components/deploy-buttons';

// Configure marked for GFM tables
marked.setOptions({ gfm: true, breaks: true });

// ============ Types ============

export type DocRole = 'drawing' | 'manual' | 'procedure';

export interface FileItem {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'word' | 'excel' | 'csv' | 'text';
  size: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  base64?: string;
  role?: DocRole;
}

interface TraceStep {
  type: 'tool_call' | 'error' | 'trace';
  content: string;
  step?: number;
  phase?: string;
  source?: string;
  page?: number;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'user' | 'text' | 'tool_call' | 'tool_output' | 'file_download' | 'error' | 'system' | 'suggestions' | 'thinking_group' | 'retry_card' | 'safety_decision';
  content: string;
  meta?: Record<string, any>;
}

// ============ Markdown Renderer ============

function MarkdownBlock({ content }: { content: string }) {
  const html = marked.parse(content) as string;
  return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
}

function StreamingText({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  return (
    <div className="relative">
      <MarkdownBlock content={content} />
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-0.5 align-middle rounded-sm bg-current opacity-60 animate-pulse" />
      )}
    </div>
  );
}

// ============ Trace Panel ============

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  drawing: { label: 'Drawing', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  manual: { label: 'Manual', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  procedure: { label: 'Procedure', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

function TracePanel({
  steps,
  collapsed,
  isLive,
  onToggle,
  isDark,
  locale,
}: {
  steps: TraceStep[];
  collapsed: boolean;
  isLive: boolean;
  onToggle: () => void;
  isDark: boolean;
  locale: string;
}) {
  const isZh = locale === 'zh';
  const traceCount = steps.filter((s) => s.type === 'trace').length;
  const stepCount = steps.length;

  return (
    <div className={`rounded-xl border overflow-hidden text-xs ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50/90 border-gray-200'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${isDark ? 'hover:bg-gray-800/40' : 'hover:bg-gray-100/80'}`}
      >
        {isLive ? (
          <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
        ) : (
          <svg
            className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {isLive
            ? (isZh ? '分析中...' : 'Analyzing...')
            : traceCount > 0
              ? (isZh ? `追溯时间线 · ${traceCount} 步` : `Trace · ${traceCount} steps`)
              : stepCount > 0
                ? (isZh ? `操作记录 · ${stepCount} 步` : `Actions · ${stepCount} steps`)
                : (isZh ? '追溯时间线' : 'Trace')}
        </span>
        {!isLive && stepCount > 0 && (
          <span className={`ml-auto ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            {collapsed ? '▼' : '▲'}
          </span>
        )}
      </button>

      {/* Steps */}
      {!collapsed && (
        <div className={`border-t ${isDark ? 'border-gray-700/40' : 'border-gray-100'}`}>
          <div className="px-3 py-2.5 space-y-1.5">
            {steps.map((step, i) => {
              if (step.type === 'trace') {
                const badge = step.source && SOURCE_BADGE[step.source];
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`flex-shrink-0 w-5 text-center px-0.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                      {step.step ?? i + 1}
                    </span>
                    <span className={`leading-relaxed flex-1 min-w-0 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {step.content}
                      {badge && (
                        <span className={`ml-1.5 inline-block px-1 py-0 rounded border text-[9px] font-medium align-middle ${badge.cls}`}>
                          {badge.label}{step.page ? ` p.${step.page}` : ''}
                        </span>
                      )}
                    </span>
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className={`flex-shrink-0 px-1 py-0.5 rounded text-[10px] font-medium mt-0.5 ${
                    step.type === 'error'
                      ? (isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600')
                      : (isDark ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-700')
                  }`}>
                    {step.type === 'error' ? 'ERR' : (isZh ? '操作' : 'ACT')}
                  </span>
                  <span className={`leading-relaxed ${
                    step.type === 'error'
                      ? (isDark ? 'text-red-300/80' : 'text-red-600')
                      : (isDark ? 'text-amber-200/70' : 'text-amber-700')
                  }`}>{step.content}</span>
                </div>
              );
            })}
            {isLive && (
              <div className={`flex items-center gap-1.5 pt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                <span>{isZh ? '等待下一步操作...' : 'Waiting for next step...'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Safety Decision Card ============

function SafetyDecisionCard({
  status,
  reason,
  missing,
  isDark,
  locale,
}: {
  status: string;
  reason: string;
  missing: string[];
  isDark: boolean;
  locale: string;
}) {
  const isZh = locale === 'zh';
  const meta = status === 'blocked'
    ? {
        title: isZh ? '⛔ 安全检查未通过，暂缓作业' : '⛔ BLOCKED UNTIL SAFETY CHECK',
        wrap: isDark ? 'bg-red-950/20 border-red-700/50' : 'bg-red-50 border-red-300',
        title_cls: isDark ? 'text-red-300' : 'text-red-700',
      }
    : status === 'ready'
      ? {
          title: isZh ? '✅ 可以开展作业' : '✅ READY',
          wrap: isDark ? 'bg-emerald-950/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-300',
          title_cls: isDark ? 'text-emerald-300' : 'text-emerald-700',
        }
      : {
          title: isZh ? '⚠️ 需要更多信息' : '⚠️ NEEDS MORE INFO',
          wrap: isDark ? 'bg-amber-950/20 border-amber-700/50' : 'bg-amber-50 border-amber-300',
          title_cls: isDark ? 'text-amber-300' : 'text-amber-700',
        };

  return (
    <div className={`flex-1 rounded-xl border-2 p-4 ${meta.wrap}`}>
      <p className={`text-sm font-bold ${meta.title_cls}`}>{meta.title}</p>
      <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{reason}</p>
      {missing.length > 0 && (
        <div className="mt-2.5">
          <p className={`text-[11px] font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {isZh ? '所需证据：' : 'Required evidence:'}
          </p>
          <ul className={`mt-1 space-y-0.5 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {missing.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============ Helpers ============

function getFileType(name: string): FileItem['type'] {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['csv'].includes(ext)) return 'csv';
  return 'text';
}

function getFileIcon(type: FileItem['type'], role?: DocRole): string {
  if (role === 'drawing') return '📐';
  if (role === 'manual') return '📕';
  if (role === 'procedure') return '📋';
  switch (type) {
    case 'pdf': return '📄';
    case 'word': return '📝';
    case 'excel': return '📊';
    case 'image': return '🖼️';
    case 'csv': return '📋';
    default: return '📃';
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

function toolToAgentAction(tool: string, input: any, locale: string): string {
  const isZh = locale === 'zh';
  switch (tool) {
    case 'files': {
      const op = input?.op;
      const path = input?.path || '';
      const fname = path.split('/').pop();
      if (op === 'read') return isZh ? `📖 读取文件 ${fname}` : `📖 Reading ${fname}`;
      if (op === 'write') return isZh ? `✍️ 写入文件 ${fname}` : `✍️ Writing ${fname}`;
      if (op === 'list') return isZh ? `📂 列出目录 ${path}` : `📂 Listing ${path}`;
      if (op === 'exists') return isZh ? `🔍 检查文件 ${fname}` : `🔍 Checking ${fname}`;
      if (op === 'makeDir') return isZh ? `📁 创建目录 ${path}` : `📁 Creating dir ${path}`;
      if (op === 'remove') return isZh ? `🗑️ 删除文件 ${fname}` : `🗑️ Removing ${fname}`;
      return isZh ? `📄 文件操作: ${op}` : `📄 File op: ${op}`;
    }
    case 'commands': {
      const cmd = (input?.cmd || '').slice(0, 120);
      if (cmd.includes('pip install')) return isZh ? `📦 准备处理环境...` : `📦 Preparing environment...`;
      if (cmd.includes('base64')) return isZh ? `📤 准备文件下载` : `📤 Preparing download`;
      return isZh ? `⚡ 正在处理...` : `⚡ Processing...`;
    }
    case 'code_interpreter': {
      const lang = input?.language || 'python';
      const code = (input?.code || '').slice(0, 200);
      if (code.includes('pdfplumber')) return isZh ? `🔎 检索 PDF 文档...` : `🔎 Searching PDF documents...`;
      if (code.includes('PdfPages') || code.includes('matplotlib')) return isZh ? `📄 生成排障简报 PDF...` : `📄 Generating troubleshooting brief PDF...`;
      if (code.includes('pandas') || code.includes('pd.read_csv')) return isZh ? `🐍 Python 数据分析中...` : `🐍 Python data analysis...`;
      return isZh ? `🐍 ${lang} 代码执行中...` : `🐍 Running ${lang} code...`;
    }
    case 'deliver_file': {
      const fname = input?.filename || '';
      return isZh ? `📥 交付文件: ${fname}` : `📥 Delivering: ${fname}`;
    }
    default:
      return isZh ? `🔧 ${tool}` : `🔧 ${tool}`;
  }
}

// ============ Demo documents ============

const DEMO_DOCS: Array<{ file: string; role: DocRole }> = [
  { file: 'CV-104-drawing.pdf', role: 'drawing' },
  { file: 'CV-104-drawing.txt', role: 'drawing' },
  { file: 'VFD-manual.pdf', role: 'manual' },
  { file: 'VFD-manual.txt', role: 'manual' },
  { file: 'site-procedure.pdf', role: 'procedure' },
  { file: 'site-procedure.txt', role: 'procedure' },
];

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)));
  }
  return btoa(bin);
}

// ============ Main Component ============

export default function Home() {
  const { t, locale, setLocale } = useI18n();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [conversationId] = useState(() => crypto.randomUUID());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isDragging, setIsDragging] = useState(false);
  const [showEdgeoneCard, setShowEdgeoneCard] = useState(false);
  const activityEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const pendingAutoAnalyze = useRef(false);
  // Which document slot the next file-picker selection belongs to
  const pendingRoleRef = useRef<DocRole | undefined>(undefined);
  // Track which files have already been sent to avoid re-uploading
  const sentFileIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities]);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const addActivity = useCallback((type: ActivityEntry['type'], content: string, meta?: Record<string, any>) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setActivities((prev) => [...prev, { id, timestamp: Date.now(), type, content, meta }]);
  }, []);

  // File handling
  const processFiles = useCallback(async (selectedFiles: File[], role?: DocRole) => {
    const items: FileItem[] = await Promise.all(
      selectedFiles.map(async (f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        type: getFileType(f.name),
        size: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`,
        status: 'queued' as const,
        base64: await readFileAsBase64(f),
        role,
      }))
    );
    setFiles((prev) => {
      // A role slot holds one document — replace any queued file with the same role
      const kept = role ? prev.filter((p) => p.role !== role || sentFileIds.current.has(p.id)) : prev;
      return [...kept, ...items];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    pendingAutoAnalyze.current = true;
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const role = pendingRoleRef.current;
    pendingRoleRef.current = undefined;
    if (selectedFiles.length > 0) await processFiles(role ? selectedFiles.slice(0, 1) : selectedFiles, role);
  }, [processFiles]);

  const openSlotPicker = useCallback((role?: DocRole) => {
    pendingRoleRef.current = role;
    fileInputRef.current?.click();
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) await processFiles(droppedFiles);
  }, [processFiles]);

  // Load the CV-104 demo pack: 3 PDFs + 3 TXT mirrors (extraction fallback)
  const loadDemoDocuments = useCallback(async () => {
    try {
      const items: FileItem[] = [];
      for (const d of DEMO_DOCS) {
        const resp = await fetch(`/demo/${d.file}`);
        if (!resp.ok) throw new Error(`demo file missing: ${d.file}`);
        const bytes = new Uint8Array(await resp.arrayBuffer());
        items.push({
          id: crypto.randomUUID(),
          name: d.file,
          type: getFileType(d.file),
          size: `${(bytes.length / 1024).toFixed(1)} KB`,
          status: 'queued',
          base64: bytesToBase64(bytes),
          role: d.role,
        });
      }
      setFiles((prev) => [...prev, ...items]);
      pendingAutoAnalyze.current = true;
    } catch (err) {
      addActivity('error', `Failed to load demo documents: ${(err as Error).message}`);
    }
  }, [addActivity]);

  // Send message
  const sendMessage = useCallback(async (customMsg?: string, silent?: boolean) => {
    const text = customMsg || userInput.trim();
    if (!text || isProcessing) return;
    setIsProcessing(true);
    setUserInput('');

    // Only upload files that haven't been sent before
    const newFiles = files.filter((f) => f.status === 'queued' && !sentFileIds.current.has(f.id));
    let fullMessage = text;
    const filesToUpload: Array<{ name: string; base64: string; role?: string }> = [];

    if (newFiles.length > 0) {
      const desc = newFiles.map((f) => `- ${f.name}${f.role ? ` [${f.role}]` : ''} (${f.type}, ${f.size})`).join('\n');
      fullMessage = `${text}\n\nUploaded documents:\n${desc}`;
      for (const f of newFiles) {
        if (f.base64) filesToUpload.push({ name: f.name, base64: f.base64, role: f.role });
        sentFileIds.current.add(f.id);
      }
      // Mark files as done
      setFiles((prev) => prev.map((f) => sentFileIds.current.has(f.id) ? { ...f, status: 'done' } : f));
    }

    const langHint = locale === 'zh'
      ? '\n\n[语言要求：所有输出内容（包括生成的文件、报告标题、表头等）必须使用中文]'
      : '\n\n[Language: All output (including generated files, report titles, headers) must be in English]';
    fullMessage += langHint;

    if (silent) {
      const fileCount = newFiles.length || files.length;
      const msg = locale === 'zh' ? `📎 已接收 ${fileCount} 份文件，正在识别...` : `📎 Received ${fileCount} document(s), reviewing...`;
      addActivity('system', msg);
    } else {
      addActivity('user', text);
    }

    // Create a trace group for this processing run
    const thinkingGroupId = `thinking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setActivities((prev) => [...prev, {
      id: thinkingGroupId,
      timestamp: Date.now(),
      type: 'thinking_group' as const,
      content: '',
      meta: { steps: [] as TraceStep[], collapsed: false, isLive: true },
    }]);

    // Deferred suggestions
    let pendingSuggestions: Array<{ id: string; emoji: string; title: string; description: string }> | null = null;
    let hadErrors = false;
    let gotFile = false;
    let hadTraceSteps = false;

    // Helper: push a step into the trace group
    const pushTraceStep = (step: TraceStep) => {
      if (step.type === 'trace') hadTraceSteps = true;
      setActivities((prev) => prev.map((a) =>
        a.id === thinkingGroupId
          ? { ...a, meta: { ...a.meta, steps: [...(a.meta?.steps || []), step] } }
          : a
      ));
    };

    // Helper: finish the trace group. The trace IS the product — keep it
    // expanded when it contains trace steps; collapse plain tool-call groups.
    const closeTraceGroup = () => {
      setActivities((prev) => prev.map((a) =>
        a.id === thinkingGroupId
          ? { ...a, meta: { ...a.meta, collapsed: !hadTraceSteps, isLive: false } }
          : a
      ));
    };

    try {
      const resp = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'makers-conversation-id': conversationId,
        },
        body: JSON.stringify({ message: fullMessage, files: filesToUpload.length > 0 ? filesToUpload : undefined }),
      });

      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        try {
          const errBody = await resp.text();
          if (resp.status === 429 || errBody.includes("quota")) {
            errMsg = t.quotaExhausted;
          } else if (errBody) {
            errMsg = errBody.slice(0, 200);
          }
        } catch {}
        throw new Error(errMsg);
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentText = '';
      let currentTextId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const event = JSON.parse(payload);

            if (event.type === 'text_delta' && event.delta) {
              currentText += event.delta;
              const snapshot = currentText;
              if (!currentTextId) {
                currentTextId = `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const newId = currentTextId;
                setActivities((prev) => {
                  if (prev.some((a) => a.id === newId)) return prev.map((a) => a.id === newId ? { ...a, content: snapshot } : a);
                  return [...prev, { id: newId, timestamp: Date.now(), type: 'text' as const, content: snapshot }];
                });
              } else {
                const updateId = currentTextId;
                setActivities((prev) => prev.map((a) => a.id === updateId ? { ...a, content: snapshot } : a));
              }
            } else if (event.type === 'trace') {
              pushTraceStep({
                type: 'trace',
                content: event.detail || '',
                step: event.step,
                phase: event.phase,
                source: event.source,
                page: event.page,
              });
            } else if (event.type === 'safety_decision') {
              addActivity('safety_decision', event.reason || '', {
                status: event.status,
                missing: event.missing_evidence || [],
              });
            } else if (event.type === 'tool_called' && event.tool) {
              currentText = '';
              currentTextId = '';
              // Custom-tool calls surface through their own SSE events
              if (!['suggest_actions', 'report_trace', 'safety_decision'].includes(event.tool)) {
                const agentAction = toolToAgentAction(event.tool, event.input, locale);
                pushTraceStep({ type: 'tool_call', content: agentAction });
              }
            } else if (event.type === 'suggest_actions' && event.actions) {
              pendingSuggestions = event.actions;
            } else if (event.type === 'code_output') {
              // Intentionally suppressed — AI text response already summarises results
            } else if (event.type === 'code_error') {
              if (event.stderr?.trim()) {
                hadErrors = true;
                const errLines = event.stderr.trim().split('\n');
                const errorLine = errLines.find((l: string) =>
                  /^(Error|Exception|ValueError|TypeError|ImportError|SyntaxError|AttributeError|NameError|KeyError|IndexError|OSError|IOError|RuntimeError|ModuleNotFoundError|FileNotFoundError|PermissionError|ZeroDivisionError)/
                    .test(l)
                ) || errLines[errLines.length - 1] || errLines[0];
                pushTraceStep({ type: 'error', content: errorLine.slice(0, 300) });
              }
            } else if (event.type === 'file_output' && event.filename) {
              gotFile = true;
              addActivity('file_download', event.filename, { base64: event.base64, description: event.description });
            }
          } catch { /* skip */ }
        }
      }

      closeTraceGroup();

      // Render suggestions, retry card, or task complete
      if (pendingSuggestions) {
        addActivity('suggestions', '', { actions: pendingSuggestions });
      } else if (hadErrors && !gotFile) {
        addActivity('retry_card',
          locale === 'zh' ? '处理过程中遇到了问题，请重试' : 'Something went wrong during processing, please retry',
          { message: text }
        );
      } else {
        addActivity('system', t.taskComplete);
      }
    } catch (err) {
      closeTraceGroup();
      addActivity('error', `${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [userInput, files, isProcessing, conversationId, addActivity, locale, t.quotaExhausted, t.taskComplete]);

  // Auto-trigger analysis only when all three document roles are present
  useEffect(() => {
    if (pendingAutoAnalyze.current && files.length > 0 && !isProcessing) {
      const queuedNew = files.filter((f) => f.status === 'queued' && !sentFileIds.current.has(f.id));
      const roles = new Set(queuedNew.map((f) => f.role).filter(Boolean));
      if (roles.has('drawing') && roles.has('manual') && roles.has('procedure')) {
        pendingAutoAnalyze.current = false;
        sendMessage(t.suggestPrompt, true);
      }
      // Otherwise stay pending: fire once the remaining slots are filled,
      // or the user sends manually.
    }
  }, [files, isProcessing, sendMessage, t.suggestPrompt]);

  const isDark = theme === 'dark';
  const hasConversation = activities.length > 0;

  // Queued (unsent) files — shown as chips in the input area
  const queuedFiles = files.filter((f) => !sentFileIds.current.has(f.id));

  const slotFor = (role: DocRole) =>
    files.filter((f) => f.role === role && f.type === 'pdf').pop() ??
    files.filter((f) => f.role === role).pop();

  const SLOT_DEFS: Array<{ role: DocRole; label: string; icon: string }> = [
    { role: 'drawing', label: t.slotDrawing, icon: '📐' },
    { role: 'manual', label: t.slotManual, icon: '📕' },
    { role: 'procedure', label: t.slotProcedure, icon: '📋' },
  ];

  return (
    <div
      className={`h-screen flex flex-col ${isDark ? 'bg-[#0a0a0f] text-gray-100' : 'bg-gray-50 text-gray-900'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={dropZoneRef}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none border-2 border-dashed rounded-lg m-3 ${isDark ? 'bg-blue-950/60 border-blue-400' : 'bg-blue-50/80 border-blue-400'}`}>
          <div className="text-center">
            <div className="text-4xl mb-2">📂</div>
            <p className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
              {locale === 'zh' ? '释放以上传文件' : 'Drop files to upload'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`flex-shrink-0 ${isDark ? 'bg-[#12121a] border-gray-800/60' : 'bg-white border-gray-200'} border-b px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-600/20' : 'bg-amber-100'}`}>
            <span className="text-base">⚡</span>
          </div>
          <div className="flex flex-col">
            <h1 className={`text-sm font-semibold leading-tight ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {t.title}
            </h1>
            <span className={`text-[10px] leading-tight ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t.tagline}
            </span>
          </div>
          <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
        </div>
        <div className="flex items-center gap-2">
          <DeployButtons
            templateSlug="multimodal-file-assistant-agent"
            githubUrl="https://github.com/ali-amjad52114/multimodal-file-assistant-agent"
            lang={locale}
          />
          <button
            onClick={() => setShowEdgeoneCard((v) => !v)}
            title={t.edgeoneTitle}
            className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
            ⚡ EdgeOne
          </button>
          <button onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
            {locale === 'zh' ? 'EN' : '中'}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* EdgeOne Makers card (judge-visible, toggleable) */}
      {showEdgeoneCard && (
        <div className={`flex-shrink-0 border-b px-5 py-3 ${isDark ? 'bg-[#0f0f17] border-gray-800/60' : 'bg-white border-gray-200'}`}>
          <div className="max-w-3xl mx-auto">
            <p className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{t.edgeoneTitle}</p>
            <ul className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t.edgeoneLines.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

          {/* Empty state: three document slots */}
          {!hasConversation && (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="text-center max-w-md w-full">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-amber-600/10' : 'bg-amber-50'}`}>
                  <span className="text-3xl">⚡</span>
                </div>
                <h2 className={`text-base font-semibold mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {t.title}
                </h2>
                <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t.emptyHint}
                </p>

                {/* Three document slots */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
                  {SLOT_DEFS.map((slot) => {
                    const filled = slotFor(slot.role);
                    return (
                      <button
                        key={slot.role}
                        onClick={() => openSlotPicker(slot.role)}
                        disabled={isProcessing}
                        className={`flex flex-col items-center gap-1.5 px-3 py-5 rounded-2xl border-2 border-dashed transition-all disabled:opacity-50 ${
                          filled
                            ? (isDark ? 'border-emerald-600/60 bg-emerald-950/20 text-emerald-300' : 'border-emerald-400 bg-emerald-50 text-emerald-700')
                            : (isDark
                              ? 'border-gray-700 hover:border-amber-500 hover:bg-amber-600/5 text-gray-500 hover:text-amber-400'
                              : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-400 hover:text-amber-600')
                        }`}
                      >
                        <span className="text-2xl">{filled ? '✅' : slot.icon}</span>
                        <span className="text-xs font-medium">{slot.label}</span>
                        <span className={`text-[10px] max-w-full truncate ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {filled ? filled.name : t.slotEmpty}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  <span className="flex-1 h-px bg-current opacity-20" />
                  <span>{locale === 'zh' ? '或' : 'or'}</span>
                  <span className="flex-1 h-px bg-current opacity-20" />
                </div>

                <button onClick={loadDemoDocuments} disabled={isProcessing}
                  className={`mt-3 px-5 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 shadow-sm'}`}>
                  {t.importSample}
                </button>

                <p className={`mt-3 text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  {t.supportedTypes}
                </p>
              </div>
            </div>
          )}

          {/* Activity entries */}
          {activities.map((entry) => {

            // ── Trace group (collapsible, expanded after run when it has traces) ──
            if (entry.type === 'thinking_group') {
              const steps: TraceStep[] = entry.meta?.steps || [];
              if (steps.length === 0) return null;
              return (
                <div key={entry.id} className="flex items-start gap-3 min-w-0 max-w-3xl mx-auto w-full">
                  <span className={`text-[10px] font-mono mt-3 w-14 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{timeStr(entry.timestamp)}</span>
                  <div className="flex-1 min-w-0">
                    <TracePanel
                      steps={steps}
                      collapsed={entry.meta?.collapsed ?? false}
                      isLive={entry.meta?.isLive ?? false}
                      onToggle={() => {
                        setActivities((prev) => prev.map((a) =>
                          a.id === entry.id
                            ? { ...a, meta: { ...a.meta, collapsed: !a.meta?.collapsed } }
                            : a
                        ));
                      }}
                      isDark={isDark}
                      locale={locale}
                    />
                  </div>
                </div>
              );
            }

            // ── Safety decision card ──
            if (entry.type === 'safety_decision') {
              return (
                <div key={entry.id} className="flex items-start gap-3 min-w-0 max-w-3xl mx-auto w-full">
                  <span className={`text-[10px] font-mono mt-1 w-14 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{timeStr(entry.timestamp)}</span>
                  <SafetyDecisionCard
                    status={entry.meta?.status || 'needs_info'}
                    reason={entry.content}
                    missing={entry.meta?.missing || []}
                    isDark={isDark}
                    locale={locale}
                  />
                </div>
              );
            }

            // ── Retry card ──
            if (entry.type === 'retry_card') {
              return (
                <div key={entry.id} className="flex items-start gap-3 min-w-0 max-w-3xl mx-auto w-full">
                  <span className={`text-[10px] font-mono mt-1 w-14 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{timeStr(entry.timestamp)}</span>
                  <div className={`flex-1 rounded-xl border p-3.5 ${isDark ? 'bg-red-950/10 border-red-800/30' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-xs mb-3 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                      ⚠️ {entry.content}
                    </p>
                    <button
                      onClick={() => sendMessage(entry.meta?.message)}
                      disabled={isProcessing}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${isDark
                        ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/40'
                        : 'bg-white hover:bg-red-50 text-red-600 border border-red-200 shadow-sm'
                      }`}
                    >
                      🔄 {locale === 'zh' ? '重新操作' : 'Retry'}
                    </button>
                  </div>
                </div>
              );
            }

            // ── Standard entries ──
            return (
              <div key={entry.id} className="flex items-start gap-3 min-w-0 max-w-3xl mx-auto w-full">
                <span className={`text-[10px] font-mono mt-1 w-14 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{timeStr(entry.timestamp)}</span>

                {entry.type === 'user' && (
                  <>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${isDark ? 'bg-blue-600/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>YOU</span>
                    <p className={`text-sm ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>{entry.content}</p>
                  </>
                )}

                {entry.type === 'system' && (
                  <p className={`text-xs italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{entry.content}</p>
                )}

                {/* tool_call kept for legacy/fallback rendering */}
                {entry.type === 'tool_call' && (
                  <>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${isDark ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                      {locale === 'zh' ? '操作' : 'ACT'}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-amber-200/80' : 'text-amber-700'}`}>{entry.content}</span>
                  </>
                )}

                {entry.type === 'suggestions' && entry.meta?.actions && (
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {(entry.meta.actions as Array<{ id: string; emoji: string; title: string; description: string }>).map((action) => (
                        <button
                          key={action.id}
                          onClick={() => sendMessage(action.title)}
                          disabled={isProcessing}
                          className={`text-left px-3.5 py-3 rounded-xl border transition-all disabled:opacity-50 ${isDark
                            ? 'bg-gray-800/40 hover:bg-gray-700/60 border-gray-700/60 hover:border-amber-500/50'
                            : 'bg-white hover:bg-amber-50 border-gray-200 hover:border-amber-300 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="text-base flex-shrink-0 mt-0.5">{action.emoji}</span>
                            <div className="min-w-0">
                              <p className={`text-xs font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{action.title}</p>
                              <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{action.description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {entry.type === 'text' && (
                  <>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${isDark ? 'bg-gray-700/60 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>AI</span>
                    <div className="flex-1 min-w-0 overflow-x-auto">
                      <StreamingText content={entry.content} isStreaming={isProcessing && entry.id === activities[activities.length - 1]?.id} />
                    </div>
                  </>
                )}

                {entry.type === 'file_download' && (
                  <>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${isDark ? 'bg-emerald-900/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>FILE</span>
                    <span className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {locale === 'zh' ? '简报已生成 ↓' : 'Brief ready ↓'}
                    </span>
                  </>
                )}

                {entry.type === 'error' && (
                  <>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${isDark ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-600'}`}>ERR</span>
                    <pre className={`text-xs overflow-x-auto max-h-20 overflow-y-auto flex-1 p-1.5 rounded ${isDark ? 'text-red-300/80 bg-red-900/10' : 'text-red-600 bg-red-50'}`}>
                      {entry.content.slice(0, 500)}
                    </pre>
                  </>
                )}
              </div>
            );
          })}

          {isProcessing && (
            <div className={`flex items-center gap-2 text-xs py-1 max-w-3xl mx-auto w-full ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {locale === 'zh' ? '处理中...' : 'Processing...'}
            </div>
          )}

          {/* File downloads */}
          {!isProcessing && activities.filter((a) => a.type === 'file_download').length > 0 && (
            <div className={`mt-4 p-4 rounded-xl border max-w-3xl mx-auto w-full ${isDark ? 'bg-emerald-950/10 border-emerald-800/30' : 'bg-emerald-50/50 border-emerald-200'}`}>
              <p className={`text-xs font-medium mb-2.5 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                📥 {locale === 'zh' ? '可下载文件' : 'Downloads'}
              </p>
              <div className="space-y-2">
                {activities.filter((a) => a.type === 'file_download').map((entry) => (
                  <a key={entry.id}
                    href={`data:application/octet-stream;base64,${entry.meta?.base64 || ''}`}
                    download={entry.content}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-gray-800/40 border-emerald-800/30 hover:bg-emerald-950/30' : 'bg-white border-emerald-200 hover:bg-emerald-50 shadow-sm'}`}>
                    <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className={`text-xs font-medium ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>{entry.content}</span>
                    {entry.meta?.description && (
                      <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>— {entry.meta.description.slice(0, 50)}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div ref={activityEndRef} />
        </div>

        {/* Input area */}
        <div className={`flex-shrink-0 border-t ${isDark ? 'border-gray-800/60 bg-[#0f0f17]' : 'border-gray-200 bg-white'} px-4 pt-3 pb-2`}>
          <div className="max-w-3xl mx-auto">

            {/* Queued file chips */}
            {queuedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {queuedFiles.map((f) => (
                  <span
                    key={f.id}
                    className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${isDark
                      ? 'bg-blue-950/40 border-blue-800/50 text-blue-300'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}
                  >
                    <span>{getFileIcon(f.type, f.role)}</span>
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-800/60 hover:text-white' : 'text-blue-400 hover:bg-blue-200 hover:text-blue-700'}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {queuedFiles.length > 1 && (
                  <button
                    onClick={() => {
                      setFiles((prev) => prev.filter((f) => sentFileIds.current.has(f.id)));
                    }}
                    className={`text-[11px] px-2 py-1 rounded-full transition-colors ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                  >
                    {locale === 'zh' ? '清空' : 'Clear all'}
                  </button>
                )}
              </div>
            )}

            {/* Input row */}
            <div className={`flex items-end gap-2 rounded-2xl border p-2 transition-colors ${isDark
              ? 'bg-gray-900 border-gray-700 focus-within:border-amber-600'
              : 'bg-white border-gray-200 shadow-sm focus-within:border-amber-400'
            }`}>
              {/* Attach button */}
              <button
                onClick={() => openSlotPicker(undefined)}
                disabled={isProcessing}
                title={locale === 'zh' ? '上传文件' : 'Attach files'}
                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${isDark
                  ? 'text-gray-400 hover:text-amber-400 hover:bg-amber-600/10'
                  : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Text input */}
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t.inputPlaceholder}
                disabled={isProcessing}
                className={`flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50 py-1 px-1 ${isDark ? 'text-gray-100 placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`}
              />

              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={!userInput.trim() || isProcessing}
                className={`flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-xl transition-all disabled:opacity-40 ${isDark ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-200'}`}>
                {isProcessing ? '...' : locale === 'zh' ? '发送' : 'Send'}
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.md"
            />

            {/* Disclaimer */}
            <p className={`mt-2 text-center text-[10px] leading-relaxed ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              {t.disclaimer}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
