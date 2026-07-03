'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type Locale = 'zh' | 'en';

export const translations = {
  zh: {
    title: 'FaultPack AI',
    tagline: '3 份 PDF，3 分钟生成可追溯的排障简报',
    description: '面向工业电工的可追溯故障排查简报生成器：图纸 + 手册 + 安全规程 → 现场简报',
    processing: '处理中...',
    queued: '排队中',
    done: '完成',
    error: '错误',
    quotaExhausted: 'AI 模型调用额度已用尽，请稍后再试或升级套餐。',
    suggestPrompt: '我已上传现场文件。请识别每份文件的内容，然后等待我描述故障。',
    emptyHint: '上传三份现场文件：电气图纸、设备手册、安全规程',
    importSample: '📊 加载演示文件（CV-104 输送机）',
    taskComplete: '✅ 处理完成',
    slotDrawing: '电气图纸',
    slotManual: '设备手册',
    slotProcedure: '安全规程',
    slotEmpty: '点击上传 PDF',
    inputPlaceholder: '描述故障... 例如：“CV-104 停机，变频器过流，需要打开 MCC 抽屉”',
    disclaimer:
      'FaultPack AI 不能替代专业电气判断。它汇总相关文件、标记缺失的安全证据，并生成可追溯的排障简报供审核。',
    traceTitle: '追溯时间线',
    traceLive: '分析中...',
    traceWaiting: '等待下一步操作...',
    statusBlocked: '⛔ 安全检查未通过，暂缓作业',
    statusReady: '✅ 可以开展作业',
    statusNeedsInfo: '⚠️ 需要更多信息',
    missingEvidence: '所需证据：',
    edgeoneTitle: '⚡ 基于 Tencent EdgeOne Makers 构建',
    edgeoneLines: [
      'Agent 运行时：驱动工业排障智能体',
      '沙箱工具：安全地解析和检索 PDF',
      'Serverless 执行：生成排障简报 PDF',
      '会话缓存：跨轮次保留上传文件',
      '可观测追溯：让每条建议可审计',
      '一键部署：全组织快速共享',
    ],
    supportedTypes: '支持 PDF 与 TXT（非扫描件）',
  },
  en: {
    title: 'FaultPack AI',
    tagline: '3 PDFs to a 3-minute troubleshooting brief',
    description:
      'Traceable troubleshooting briefs for industrial electricians: drawing + manual + procedure → field brief',
    processing: 'Processing...',
    queued: 'Queued',
    done: 'Done',
    error: 'Error',
    quotaExhausted: 'AI model quota exhausted. Please try again later or upgrade your plan.',
    suggestPrompt:
      "I've uploaded the site documents. Identify what each one covers and wait for my fault description.",
    emptyHint: 'Upload the three site documents: electrical drawing, OEM manual, safety procedure',
    importSample: '📊 Load demo documents (Conveyor CV-104)',
    taskComplete: '✅ Task completed',
    slotDrawing: 'Electrical Drawing',
    slotManual: 'OEM Manual',
    slotProcedure: 'Site Safety Procedure',
    slotEmpty: 'Click to upload PDF',
    inputPlaceholder:
      'Describe the fault... e.g. "CV-104 down, VFD overcurrent, need to open MCC bucket"',
    disclaimer:
      'FaultPack AI does not replace qualified electrical judgment. It summarizes relevant documents, flags missing safety evidence, and prepares a traceable troubleshooting brief for review.',
    traceTitle: 'Trace',
    traceLive: 'Analyzing...',
    traceWaiting: 'Waiting for next step...',
    statusBlocked: '⛔ BLOCKED UNTIL SAFETY CHECK',
    statusReady: '✅ READY',
    statusNeedsInfo: '⚠️ NEEDS MORE INFO',
    missingEvidence: 'Required evidence:',
    edgeoneTitle: '⚡ Powered by Tencent EdgeOne Makers',
    edgeoneLines: [
      'Agent runtime: runs the industrial troubleshooting agent',
      'Sandboxed tools: searches PDFs safely',
      'Serverless execution: generates the troubleshooting brief',
      'Session cache: keeps uploaded documents alive across turns',
      'Observability/tracing: turns every recommendation into an audit trail',
      'One-click deployment: shareable across an organization',
    ],
    supportedTypes: 'Supports PDF and TXT (non-scanned)',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: typeof translations.en;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: translations.en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Default to English for first-time visitors (industrial audience).
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
