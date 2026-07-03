'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type Locale = 'zh' | 'en';

export const translations = {
  zh: {
    title: '智能文档处理',
    description: 'AI Agent 驱动的文档处理：PDF 合并、Word 转 PDF、Excel 转表格、图片分析、视频解析',
    dropFiles: '拖放文件或点击上传',
    process: '处理',
    clear: '清除',
    summary: '摘要',
    processing: '处理中...',
    processingResults: '处理结果',
    processingLog: '处理日志',
    fileQueue: '文件队列',
    dropHere: '拖放文件到此处或点击浏览',
    orDescribeBelow: '或在下方描述文件',
    typePlaceholder: '输入文件名（如 report.pdf）然后按回车',
    add: '添加',
    processSampleFiles: '处理示例文件',
    noFilesInQueue: '队列中没有文件。添加文件以开始。',
    processAll: '处理全部',
    showLess: '收起',
    viewFull: '查看全部',
    noContent: '无可用内容。',
    crossFileSummary: '跨文件摘要',
    queued: '排队中',
    done: '完成',
    error: '错误',
    toolCalled: '工具调用',
    supportedTypes: '支持 PDF、Word、Excel、图片、CSV、文本',
    video: '视频',
    word: 'Word',
    excel: 'Excel',
    quotaExhausted: 'AI 模型调用额度已用尽，请稍后再试或升级套餐。',
    startProcessing: '🚀 开始处理...',
    analyzingFiles: '正在分析文件...',
    suggestPrompt: '我上传了这些文件，请分析它们的基本信息并给我推荐几个处理方案',
    emptyHint: '还不知道做什么？试试上传几个文件体验一下',
    importSample: '📊 导入示例文件',
    taskComplete: '✅ 处理完成',
    preparingEnv: '准备处理环境...',
  },
  en: {
    title: 'Smart Document Processor',
    description: 'AI Agent-powered: PDF merge, Word→PDF, Excel→Markdown, image analysis, video parsing',
    dropFiles: 'Drop files or click to upload',
    process: 'Process',
    clear: 'Clear',
    summary: 'Summary',
    processing: 'Processing...',
    processingResults: 'Processing Results',
    processingLog: 'Processing Log',
    fileQueue: 'File Queue',
    dropHere: 'Drop files here or click to browse',
    orDescribeBelow: 'Or describe files below',
    typePlaceholder: 'Type filename (e.g., report.pdf) and press Enter',
    add: 'Add',
    processSampleFiles: 'Process sample files',
    noFilesInQueue: 'No files in queue. Add files to get started.',
    processAll: 'Process All',
    showLess: 'Show Less',
    viewFull: 'View Full',
    noContent: 'No content available.',
    crossFileSummary: 'Cross-File Summary',
    queued: 'Queued',
    done: 'Done',
    error: 'Error',
    toolCalled: 'Tool Called',
    supportedTypes: 'Supports PDF, Word, Excel, Images, CSV, Text',
    video: 'Video',
    word: 'Word',
    excel: 'Excel',
    quotaExhausted: 'AI model quota exhausted. Please try again later or upgrade your plan.',
    startProcessing: '🚀 Processing...',
    analyzingFiles: 'Analyzing files...',
    suggestPrompt: 'I uploaded these files. Please analyze them and suggest processing options.',
    emptyHint: 'Not sure what to do? Try uploading some files to get started',
    importSample: '📊 Import samples',
    taskComplete: '✅ Task completed',
    preparingEnv: 'Preparing environment...',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: typeof translations.zh;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: translations.en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Default to English for first-time visitors.
  const [locale, setLocale] = useState<Locale>('en');
  const t = translations[locale];
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
