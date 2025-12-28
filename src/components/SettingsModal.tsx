
import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Upload, Database, AlertTriangle, Check, Globe, Lock, Link as LinkIcon, Eye, Shield } from 'lucide-react';
import { storage } from '../services/storageService';
import { authService } from '../services/authService';
import { Visibility } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  onDataImported: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onDataImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({ type: null, message: '' });
  
  const currentUser = authService.getCurrentUser();
  const [defaultVisibility, setDefaultVisibility] = useState<Visibility>('private');
  const [maxFileSize, setMaxFileSize] = useState<number>(2); // in GB

  useEffect(() => {
    if (currentUser) {
      const stored = localStorage.getItem(`pinspire_default_visibility_${currentUser.id}`) as Visibility;
      if (stored) setDefaultVisibility(stored);
    }
    
    // Load Server Config
    const config = authService.getServerConfig();
    if (config.maxFileSize) {
      setMaxFileSize(config.maxFileSize / (1024 * 1024 * 1024));
    }
  }, [currentUser]);

  const handleVisibilityChange = (vis: Visibility) => {
    setDefaultVisibility(vis);
    if (currentUser) {
      localStorage.setItem(`pinspire_default_visibility_${currentUser.id}`, vis);
    }
  };

  const handleMaxFileSizeChange = (gb: number) => {
    setMaxFileSize(gb);
    const bytes = gb * 1024 * 1024 * 1024;
    authService.updateServerConfig({ maxFileSize: bytes });
  };

  const handleExport = async () => {
    try {
      setStatus({ type: 'loading', message: 'Generating backup...' });
      const data = await storage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pinspire-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Backup downloaded successfully.' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to export data.' });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Warning: Importing a backup will REPLACE all current data. This cannot be undone. Do you want to continue?")) {
      e.target.value = ''; // Reset input
      return;
    }

    setStatus({ type: 'loading', message: 'Importing data...' });
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        await storage.importData(json);
        setStatus({ type: 'success', message: 'Data imported successfully!' });
        setTimeout(() => {
          onDataImported();
          onClose();
        }, 1500);
      } catch (err) {
        console.error(err);
        setStatus({ type: 'error', message: 'Invalid backup file or corrupted data.' });
      }
    };
    reader.readAsText(file);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-rose-500" />
            Settings
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Default Visibility Settings */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/50">
            <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-400" />
              Default Pin Visibility
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Choose the default visibility for newly created pins.
            </p>
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              {(['private', 'public', 'unlisted'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => handleVisibilityChange(v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                    defaultVisibility === v 
                      ? 'bg-slate-800 text-rose-500 shadow-sm ring-1 ring-slate-700' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {v === 'private' && <Lock className="w-3 h-3" />}
                  {v === 'public' && <Globe className="w-3 h-3" />}
                  {v === 'unlisted' && <LinkIcon className="w-3 h-3" />}
                  <span className="capitalize">{v}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-px bg-slate-800/50 my-2"></div>

          {/* Admin Settings */}
          {currentUser?.isAdmin && (
            <>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-500" />
                  Admin Configuration
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Server-wide settings manageable by administrators.
                </p>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Max Upload Size (10GB Max)</label>
                  <input 
                    type="number" 
                    min="0.1" 
                    step="0.1"
                    value={maxFileSize}
                    onChange={(e) => handleMaxFileSizeChange(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm transition-colors"
                  />
                </div>
              </div>
              <div className="w-full h-px bg-slate-800/50 my-2"></div>
            </>
          )}

          {/* Data Management */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Data Management</h3>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/50">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Export Database</h3>
              <p className="text-xs text-slate-500 mb-4">
                Download a JSON backup of all your boards, pins, and images. Keep this file safe.
              </p>
              <button 
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors border border-slate-700"
              >
                <Download className="w-4 h-4" />
                Download Backup
              </button>
            </div>

            <div className="bg-rose-950/10 p-4 rounded-xl border border-rose-900/20">
              <h3 className="text-sm font-semibold text-rose-200 mb-1">Import Database</h3>
              <p className="text-xs text-rose-300/60 mb-4">
                Restore from a backup file. <span className="font-bold text-rose-400">This will overwrite all current data.</span>
              </p>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              <button 
                onClick={handleImportClick}
                className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-rose-900/20"
              >
                <Upload className="w-4 h-4" />
                Restore from Backup
              </button>
            </div>
          </div>

          {status.type && (
            <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
              status.type === 'error' ? 'bg-red-950/30 text-red-400 border border-red-900/30' : 
              status.type === 'success' ? 'bg-green-950/30 text-green-400 border border-green-900/30' : 
              'bg-slate-800 text-slate-300'
            }`}>
              {status.type === 'error' && <AlertTriangle className="w-4 h-4" />}
              {status.type === 'success' && <Check className="w-4 h-4" />}
              {status.type === 'loading' && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
              <span>{status.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
