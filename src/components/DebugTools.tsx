import React, { useState } from 'react';
import { Bug, Check, Copy, X } from 'lucide-react';

const LOG_HISTORY_SIZE = 100;
const logHistory: string[] = [];

// 1. Monkey-patch console to capture logs in memory
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const formatArgs = (args: any[]) => {
  return args.map(arg => {
    if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
    if (typeof arg === 'object') return JSON.stringify(arg);
    return String(arg);
  }).join(' ');
};

console.log = (...args) => {
  logHistory.push(`[LOG] ${formatArgs(args)}`);
  if (logHistory.length > LOG_HISTORY_SIZE) logHistory.shift();
  originalLog(...args);
};

console.error = (...args) => {
  logHistory.push(`[ERR] ${formatArgs(args)}`);
  if (logHistory.length > LOG_HISTORY_SIZE) logHistory.shift();
  originalError(...args);
};

console.warn = (...args) => {
  logHistory.push(`[WRN] ${formatArgs(args)}`);
  if (logHistory.length > LOG_HISTORY_SIZE) logHistory.shift();
  originalWarn(...args);
};

// 2. The Floating Button Component
export const DebugTools: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLogs = () => {
    const dump = [
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `Time: ${new Date().toISOString()}`,
      '--- LOGS ---',
      ...logHistory
    ].join('\n');
    
    navigator.clipboard.writeText(dump);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-sans">
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="p-3 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-full shadow-xl transition-all hover:scale-110"
          title="Open Debug Tools"
        >
          <Bug className="w-5 h-5" />
        </button>
      )}

      {isOpen && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 w-64 animate-in slide-in-from-bottom-5 fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Debug Tools</h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          
          <button 
            onClick={copyLogs}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all ${
              copied 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Logs'}
          </button>
        </div>
      )}
    </div>
  );
};