'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { useI18n } from '@/lib/i18n';
import { DeployButtons } from './components/deploy-buttons';

// Configure marked for GFM tables
marked.setOptions({ gfm: true, breaks: true });

// ============ Types ============

export interface FileItem {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'word' | 'excel' | 'csv' | 'text';
  size: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  base64?: string;
}

interface ThinkingStep {
  type: 'tool_call' | 'error';
  content: string;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'user' | 'text' | 'tool_call' | 'tool_output' | 'file_download' | 'error' | 'system' | 'suggestions' | 'thinking_group' | 'retry_card';
  content: string;
  meta?: Record<string, any>;
}

// ============ Markdown Renderer ============

function MarkdownBlock({ content }: { content: string }) {
  const html = marked.parse(content) as string;
  return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
}

function StreamingText({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  // Always render Markdown in real time during streaming — marked.parse is
  // synchronous so every accumulated delta is parsed immediately.
  // A pulsing cursor is appended while still streaming.
  return (
    <div className="relative">
      <MarkdownBlock content={content} />
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-0.5 align-middle rounded-sm bg-current opacity-60 animate-pulse" />
      )}
    </div>
  );
}

// ============ Thinking Panel ============

function ThinkingPanel({
  steps,
  collapsed,
  isLive,
  onToggle,
  isDark,
  locale,
}: {
  steps: ThinkingStep[];
  collapsed: boolean;
  isLive: boolean;
  onToggle: () => void;
  isDark: boolean;
  locale: string;
}) {
  const isZh = locale === 'zh';
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
            ? (isZh ? '处理中...' : 'Processing...')
            : stepCount > 0
              ? (isZh ? `思考过程 · ${stepCount} 步操作` : `Thinking · ${stepCount} steps`)
              : (isZh ? '思考过程' : 'Thinking')}
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
            {steps.map((step, i) => (
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
            ))}
            {isLive && (
              <div className={`flex items-center gap-1.5 pt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                <span>{isZh ? '等待下一步操作...' : 'Waiting for next action...'}</span>
              </div>
            )}
          </div>
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

function getFileIcon(type: FileItem['type']): string {
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
      if (cmd.includes('file ') || cmd.includes('identify')) return isZh ? `🔍 检查文件信息` : `🔍 Checking file info`;
      return isZh ? `⚡ 正在处理...` : `⚡ Processing...`;
    }
    case 'code_interpreter': {
      const lang = input?.language || 'python';
      const code = (input?.code || '').slice(0, 80);
      if (code.includes('pandas') || code.includes('pd.read_csv')) return isZh ? `🐍 Python 数据分析中...` : `🐍 Python data analysis...`;
      if (code.includes('FPDF') || code.includes('fpdf')) return isZh ? `🐍 Python 生成 PDF...` : `🐍 Python generating PDF...`;
      if (code.includes('matplotlib') || code.includes('plt.')) return isZh ? `📊 Python 生成图表...` : `📊 Python creating chart...`;
      if (code.includes('docx') || code.includes('Document')) return isZh ? `🐍 Python 处理 Word 文档...` : `🐍 Python processing Word doc...`;
      if (code.includes('PIL') || code.includes('Image')) return isZh ? `🖼️ Python 处理图片...` : `🖼️ Python processing image...`;
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

// ============ Sample Files ============

const SAMPLE_FILES: Omit<FileItem, 'base64'>[] = [
  { id: 's1', name: 'quarterly-report.txt', type: 'text', size: '2.1 KB', status: 'queued' },
  { id: 's2', name: 'project-plan.md', type: 'text', size: '1.5 KB', status: 'queued' },
  { id: 's3', name: 'sales-data.csv', type: 'csv', size: '380 B', status: 'queued' },
  { id: 's4', name: 'team-contacts.csv', type: 'csv', size: '260 B', status: 'queued' },
];

function generateSampleContent(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  let text = '';
  if (ext === 'txt') {
    text = 'Quarterly Financial Report 2024 Q4\n====================================\n\nRevenue: $2.4B (+15% YoY)\nNet Profit: $340M (+22% YoY)\nOperating Margin: 28%\n\nKey Highlights:\n- Expanded into 3 new markets\n- Customer base grew 22%\n- Reduced operational costs by 18%\n- Launched AI-powered product suite\n\nRevenue Breakdown:\n- Enterprise: $1.2B (50%)\n- SMB: $720M (30%)\n- Consumer: $480M (20%)';
  } else if (ext === 'md') {
    text = '# Project Plan: AI Integration 2025\n\n## Phase 1: Research (Jan-Mar)\n- Evaluate LLM providers\n- Build POC\n\n## Phase 2: Development (Apr-Jun)\n- API architecture\n- RAG pipeline\n- Testing framework\n\n## Phase 3: Launch (Jul-Sep)\n- Beta testing\n- Customer pilot\n- Production deployment\n\n## Team\n| Role | Name | Allocation |\n|------|------|---|\n| Tech Lead | Alice | 100% |\n| Backend | Bob | 100% |\n| ML | Eric | 100% |\n| PM | Fiona | 50% |';
  } else if (ext === 'csv' && name.includes('sales')) {
    text = 'Product,Q1_Revenue,Q2_Revenue,Q3_Revenue,Q4_Revenue,Unit_Price,Units_Sold\nWidget Pro,45000,52000,61000,72000,299,241\nWidget Lite,28000,31000,35000,42000,149,282\nWidget Enterprise,120000,135000,155000,180000,999,180\nCloud Suite,85000,95000,110000,128000,599,214\nData Toolkit,32000,38000,44000,51000,199,256\nAI Assistant,15000,42000,68000,95000,399,238\nMobile App,22000,25000,29000,34000,99,343\nAPI Gateway,55000,62000,71000,82000,499,164';
  } else if (ext === 'csv') {
    text = 'Name,Email,Department,Role,Location,Start_Date\nAlice Chen,alice@company.com,Engineering,Tech Lead,Beijing,2020-03-15\nBob Wang,bob@company.com,Engineering,Senior Engineer,Shanghai,2021-06-01\nCharlie Liu,charlie@company.com,Engineering,Engineer,Shenzhen,2022-01-10\nDiana Zhang,diana@company.com,Product,Product Manager,Beijing,2021-09-20\nEric Li,eric@company.com,Engineering,ML Engineer,Hangzhou,2023-02-28\nFiona Wu,fiona@company.com,Product,Senior PM,Beijing,2019-11-05\nGrace Huang,grace@company.com,Design,UI Designer,Shanghai,2022-07-15';
  } else {
    text = `Sample content for ${name}`;
  }
  return btoa(unescape(encodeURIComponent(text)));
}

// ============ Main Component ============

export default function Home() {
  const { t, locale, setLocale } = useI18n();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [conversationId] = useState(() => crypto.randomUUID());
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0 });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isDragging, setIsDragging] = useState(false);
  const activityEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const pendingAutoAnalyze = useRef(false);
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
  const processFiles = useCallback(async (selectedFiles: File[]) => {
    const items: FileItem[] = await Promise.all(
      selectedFiles.map(async (f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        type: getFileType(f.name),
        size: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`,
        status: 'queued' as const,
        base64: await readFileAsBase64(f),
      }))
    );
    setFiles((prev) => [...prev, ...items]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    pendingAutoAnalyze.current = true;
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) await processFiles(selectedFiles);
  }, [processFiles]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide drag state if leaving the drop zone entirely
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

  const loadSamples = useCallback(() => {
    const items: FileItem[] = SAMPLE_FILES.map((f) => ({
      ...f, id: crypto.randomUUID(), base64: generateSampleContent(f.name),
    }));
    setFiles(items);
    pendingAutoAnalyze.current = true;
  }, []);

  // Send message
  const sendMessage = useCallback(async (customMsg?: string, silent?: boolean) => {
    const text = customMsg || userInput.trim();
    if (!text || isProcessing) return;
    setIsProcessing(true);
    setUserInput('');

    // Only upload files that haven't been sent before
    const newFiles = files.filter((f) => f.status === 'queued' && !sentFileIds.current.has(f.id));
    let fullMessage = text;
    const filesToUpload: Array<{ name: string; base64: string }> = [];

    if (newFiles.length > 0) {
      const desc = newFiles.map((f) => `- ${f.name} (${f.type}, ${f.size})`).join('\n');
      fullMessage = `${text}\n\n上传的文件：\n${desc}`;
      for (const f of newFiles) {
        if (f.base64) filesToUpload.push({ name: f.name, base64: f.base64 });
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
      const msg = locale === 'zh' ? `📎 已接收 ${fileCount} 份文件，正在分析...` : `📎 Received ${fileCount} file(s), analyzing...`;
      addActivity('system', msg);
    } else {
      addActivity('user', text);
    }

    // Create a thinking group for this processing run
    const thinkingGroupId = `thinking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setActivities((prev) => [...prev, {
      id: thinkingGroupId,
      timestamp: Date.now(),
      type: 'thinking_group' as const,
      content: '',
      meta: { steps: [] as ThinkingStep[], collapsed: false, isLive: true },
    }]);

    // Deferred suggestions
    let pendingSuggestions: Array<{ id: string; emoji: string; title: string; description: string }> | null = null;
    let hadErrors = false;
    let gotFile = false;

    // Helper: push a step into the thinking group
    const pushThinkingStep = (step: ThinkingStep) => {
      setActivities((prev) => prev.map((a) =>
        a.id === thinkingGroupId
          ? { ...a, meta: { ...a.meta, steps: [...(a.meta?.steps || []), step] } }
          : a
      ));
    };

    // Helper: close (collapse) the thinking group
    const closeThinkingGroup = () => {
      setActivities((prev) => prev.map((a) =>
        a.id === thinkingGroupId
          ? { ...a, meta: { ...a.meta, collapsed: true, isLive: false } }
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
            } else if (event.type === 'tool_called' && event.tool) {
              currentText = '';
              currentTextId = '';
              if (event.tool !== 'suggest_actions') {
                const agentAction = toolToAgentAction(event.tool, event.input, locale);
                pushThinkingStep({ type: 'tool_call', content: agentAction });
              }
            } else if (event.type === 'suggest_actions' && event.actions) {
              pendingSuggestions = event.actions;
            } else if (event.type === 'code_output') {
              // Intentionally suppressed — AI text response already summarises results
            } else if (event.type === 'code_error') {
              if (event.stderr?.trim()) {
                hadErrors = true;
                // Show only the first meaningful error line, not full Python traceback
                const lines = event.stderr.trim().split('\n');
                const errorLine = lines.find((l: string) =>
                  /^(Error|Exception|ValueError|TypeError|ImportError|SyntaxError|AttributeError|NameError|KeyError|IndexError|OSError|IOError|RuntimeError|ModuleNotFoundError|FileNotFoundError|PermissionError|ZeroDivisionError)/
                    .test(l)
                ) || lines[lines.length - 1] || lines[0];
                pushThinkingStep({ type: 'error', content: errorLine.slice(0, 300) });
              }
            } else if (event.type === 'file_output' && event.filename) {
              gotFile = true;
              addActivity('file_download', event.filename, { base64: event.base64, description: event.description });
            } else if (event.type === 'usage') {
              setTokenUsage((prev) => ({ input: prev.input + (event.input_tokens || 0), output: prev.output + (event.output_tokens || 0) }));
            }
          } catch { /* skip */ }
        }
      }

      // Collapse the thinking group now that processing is done
      closeThinkingGroup();

      // Render suggestions, retry card, or task complete
      if (pendingSuggestions) {
        addActivity('suggestions', '', { actions: pendingSuggestions });
      } else if (hadErrors && !gotFile) {
        // Errors occurred but no file was produced — show retry card
        addActivity('retry_card',
          locale === 'zh' ? '处理过程中遇到了问题，请重试' : 'Something went wrong during processing, please retry',
          { message: text }
        );
      } else {
        setActivities((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === 'text' && last.content) {
            const cleaned = last.content.replace(/\n*(?:以下是|请选择|请点击|点击上方|您可以选择|推荐的处理方案|以下是为您推荐)[\s\S]*$/, '').trim();
            if (cleaned !== last.content && cleaned) {
              return prev.map((a) => a.id === last.id ? { ...a, content: cleaned } : a);
            }
          }
          return prev;
        });
        addActivity('system', t.taskComplete);
      }
    } catch (err) {
      closeThinkingGroup();
      addActivity('error', `${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [userInput, files, isProcessing, conversationId, addActivity, locale]);

  // Auto-trigger analysis only for NEW files
  useEffect(() => {
    if (pendingAutoAnalyze.current && files.length > 0 && !isProcessing) {
      // Check if there are actually new (unsent) files
      const hasNewFiles = files.some((f) => f.status === 'queued' && !sentFileIds.current.has(f.id));
      if (hasNewFiles) {
        pendingAutoAnalyze.current = false;
        sendMessage(t.suggestPrompt, true);
      } else {
        pendingAutoAnalyze.current = false;
      }
    }
  }, [files, isProcessing, sendMessage, t.suggestPrompt]);

  const isDark = theme === 'dark';
  const hasConversation = activities.length > 0;

  // Queued (unsent) files — shown as chips in the input area
  const queuedFiles = files.filter((f) => !sentFileIds.current.has(f.id));

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
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
            <svg className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            {locale === 'zh' ? '智能文档处理' : 'Smart Doc Processor'}
          </h1>
          <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
        </div>
        <div className="flex items-center gap-2">
          <DeployButtons
            templateSlug="multimodal-file-assistant-agent"
            githubUrl="https://github.com/edgeone-pages-test/multimodal-file-assistant-agent"
            lang={locale}
          />
          {tokenUsage.input > 0 && (
            <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              {(tokenUsage.input + tokenUsage.output).toLocaleString()} tokens
            </span>
          )}
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

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

          {/* Empty state */}
          {!hasConversation && (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="text-center max-w-sm">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-600/10' : 'bg-blue-50'}`}>
                  <svg className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className={`text-base font-semibold mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {locale === 'zh' ? '智能文档处理' : 'Smart Document Processor'}
                </h2>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t.emptyHint}
                </p>

                {/* Upload area */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className={`w-full max-w-xs mx-auto flex flex-col items-center gap-2.5 px-6 py-6 rounded-2xl border-2 border-dashed transition-all disabled:opacity-50 ${isDark
                    ? 'border-gray-700 hover:border-blue-500 hover:bg-blue-600/5 text-gray-500 hover:text-blue-400'
                    : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-400 hover:text-blue-500'
                  }`}
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium">
                    {locale === 'zh' ? '点击上传文件' : 'Click to upload files'}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    {t.supportedTypes}
                  </span>
                </button>

                <div className={`mt-3 flex items-center gap-3 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  <span className="flex-1 h-px bg-current opacity-20" />
                  <span>{locale === 'zh' ? '或' : 'or'}</span>
                  <span className="flex-1 h-px bg-current opacity-20" />
                </div>

                <button onClick={loadSamples} disabled={isProcessing}
                  className={`mt-3 px-5 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 shadow-sm'}`}>
                  {t.importSample}
                </button>
              </div>
            </div>
          )}

          {/* Activity entries */}
          {activities.map((entry) => {

            // ── Thinking group (collapsible) ──
            if (entry.type === 'thinking_group') {
              const steps: ThinkingStep[] = entry.meta?.steps || [];
              // Only show the thinking panel when there is at least one tool
              // step. Pure text Q&A (no tool calls) should never render the
              // "Processing.../Waiting for next action..." panel — even while
              // the run is live — since there is no agent action to show.
              if (steps.length === 0) return null;
              return (
                <div key={entry.id} className="flex items-start gap-3 min-w-0 max-w-3xl mx-auto w-full">
                  <span className={`text-[10px] font-mono mt-3 w-14 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{timeStr(entry.timestamp)}</span>
                  <div className="flex-1 min-w-0">
                    <ThinkingPanel
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
                            ? 'bg-gray-800/40 hover:bg-gray-700/60 border-gray-700/60 hover:border-blue-500/50'
                            : 'bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300 shadow-sm'
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
                      {locale === 'zh' ? '文件已生成 ↓' : 'File ready ↓'}
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
        <div className={`flex-shrink-0 border-t ${isDark ? 'border-gray-800/60 bg-[#0f0f17]' : 'border-gray-200 bg-white'} px-4 pt-3 pb-4`}>
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
                    <span>{getFileIcon(f.type)}</span>
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
              ? 'bg-gray-900 border-gray-700 focus-within:border-blue-600'
              : 'bg-white border-gray-200 shadow-sm focus-within:border-blue-400'
            }`}>
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                title={locale === 'zh' ? '上传文件' : 'Attach files'}
                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${isDark
                  ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-600/10'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
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
                placeholder={locale === 'zh' ? '输入指令... (合并 PDF / 数据分析 / 格式转换)' : 'Enter command... (merge PDF / analyze / convert)'}
                disabled={isProcessing}
                className={`flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50 py-1 px-1 ${isDark ? 'text-gray-100 placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`}
              />

              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={!userInput.trim() || isProcessing}
                className={`flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-xl transition-all disabled:opacity-40 ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-blue-500 hover:bg-blue-400 text-white shadow-md shadow-blue-200'}`}>
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json,.xml,.html"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
