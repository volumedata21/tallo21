import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { dataService } from '../services/dataService';
import { X, Trash2, Plus, Users, HardDrive, Settings, Ticket, Copy, Check } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onUpdate: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, users, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');
  const [settings, setSettings] = useState<SystemSettings>({ maxUploadSize: 'Loading...', maxUsers: 10 });
  const [invites, setInvites] = useState<any[]>([]);
  
  // Create Invite State
  const [inviteQuota, setInviteQuota] = useState('20GB');
  const [newInvite, setNewInvite] = useState<{code: string, quota: string} | null>(null);

  // Edit Quota State
  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null);
  const [tempQuota, setTempQuota] = useState('');

  useEffect(() => {
    if (isOpen) {
        loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
      try {
        const [settingsData, invitesData] = await Promise.all([
            dataService.getSystemSettings(),
            dataService.getInvites()
        ]);
        setSettings(settingsData);
        setInvites(invitesData);
      } catch (e) { console.error(e); }
  };

  const handleGenerateInvite = async () => {
      const res = await dataService.generateInvite(inviteQuota);
      setNewInvite({ code: res.code, quota: res.assignedQuota });
      loadData();
  };

  const handleDeleteInvite = async (id: string) => {
      await dataService.deleteInvite(id);
      loadData();
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await dataService.deleteUser(id);
      onUpdate();
    }
  };

  const handleSettingsSave = async () => {
    await dataService.updateSystemSettings(settings);
    alert('System settings saved.');
  };

  const saveQuota = async (id: string) => {
      await dataService.updateUserQuota(id, tempQuota);
      setEditingQuotaId(null);
      onUpdate();
  };

  if (!isOpen) return null;

  return (
    // FIX: Full screen on mobile (p-0, h-full), floating on desktop (sm:p-4, sm:h-auto)
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[90vh] sm:rounded-2xl border-0 sm:border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-800 shrink-0 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-teal-500/10 rounded-lg text-teal-500">
                <Users size={24} />
             </div>
             <h2 className="text-lg sm:text-xl font-bold text-white">Admin Dashboard</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-4 sm:px-6 shrink-0 bg-slate-900">
            <button onClick={() => setActiveTab('users')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-teal-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                Users & Settings
            </button>
            <button onClick={() => setActiveTab('invites')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'invites' ? 'border-teal-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                Invite Codes
            </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar bg-[#0B1120]">
          
          {activeTab === 'users' ? (
            <>
                {/* System Settings */}
                <section className="bg-slate-800/30 p-4 sm:p-6 rounded-xl border border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Settings size={16} /> System Config
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        {/* FIX: grid-cols-1 on mobile so inputs don't squash */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Max Upload Size</label>
                                <input 
                                    value={settings.maxUploadSize}
                                    onChange={e => setSettings({...settings, maxUploadSize: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Max User Limit</label>
                                <input 
                                    type="number"
                                    value={settings.maxUsers}
                                    onChange={e => setSettings({...settings, maxUsers: parseInt(e.target.value) || 0})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none"
                                />
                            </div>
                        </div>
                        <button onClick={handleSettingsSave} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition w-full sm:w-auto">
                            Save Config
                        </button>
                    </div>
                </section>

                {/* User List Table */}
                {/* FIX: overflow-x-auto allows table to scroll horizontally on small screens */}
                <div className="border border-slate-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-slate-800 text-slate-400 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Quota (Used / Max)</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                        <div className="w-full h-full bg-teal-900 flex items-center justify-center text-teal-400 text-xs font-bold">
                                            {user.username.substring(0,2).toUpperCase()}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">{user.username}</div>
                                        <div className="text-xs text-slate-500">{user.email || 'No email'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-700 text-slate-300'}`}>
                                {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300">
                                {editingQuotaId === user.id ? (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            autoFocus
                                            value={tempQuota}
                                            onChange={e => setTempQuota(e.target.value)}
                                            className="w-20 bg-slate-950 border border-teal-500 rounded px-2 py-1 text-xs text-white outline-none"
                                        />
                                        <button onClick={() => saveQuota(user.id)} className="p-1 bg-teal-500/20 text-teal-500 rounded hover:bg-teal-500 hover:text-white transition"><Check size={14}/></button>
                                        <button onClick={() => setEditingQuotaId(null)} className="p-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500 hover:text-white transition"><X size={14}/></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setEditingQuotaId(user.id); setTempQuota(user.maxQuota || '20GB'); }}>
                                        <HardDrive size={14} className="text-slate-500" />
                                        <span>{user.usedQuota} / <span className="text-white font-medium">{user.maxQuota}</span></span>
                                        <Settings size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-full" title="Delete User">
                                    <Trash2 size={16} />
                                </button>
                                </div>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </>
          ) : (
            <div className="space-y-6">
                
                {/* Generate Invite */}
                <div className="bg-gradient-to-br from-teal-900/20 to-slate-900 border border-teal-900/50 p-4 sm:p-6 rounded-xl flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="flex items-center gap-4 sm:block">
                        <div className="p-3 bg-teal-500/20 rounded-full text-teal-400 shrink-0">
                            <Ticket size={24} />
                        </div>
                        <div className="flex-1 sm:hidden">
                            <h3 className="text-lg font-bold text-white mb-1">Generate Invite</h3>
                            <p className="text-slate-400 text-xs">Create a one-time code.</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 hidden sm:block">
                        <h3 className="text-lg font-bold text-white mb-1">Generate Invite Code</h3>
                        <p className="text-slate-400 text-sm">Create a unique one-time code for a new user.</p>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <input 
                            placeholder="Quota (e.g. 30GB)" 
                            value={inviteQuota}
                            onChange={e => setInviteQuota(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white flex-1 sm:w-32 focus:border-teal-500 outline-none"
                        />
                        <button onClick={handleGenerateInvite} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-lg font-bold transition">
                            Generate
                        </button>
                    </div>
                </div>

                {/* New Invite Display */}
                {newInvite && (
                    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">New Code Created</span>
                            <div className="text-2xl font-mono text-white tracking-widest mt-1 select-all break-all">{newInvite.code}</div>
                            <div className="text-xs text-teal-400 mt-1">Quota: {newInvite.quota}</div>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(newInvite.code); alert('Copied!'); }} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-4 rounded-lg transition w-full sm:w-auto">
                            <Copy size={16} /> Copy Code
                        </button>
                    </div>
                )}

                {/* Invites List */}
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-8">Active Invites</h3>
                <div className="border border-slate-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3">Code</th>
                                <th className="px-6 py-3">Assigned Quota</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                            {invites.map(invite => (
                                <tr key={invite.id}>
                                    <td className="px-6 py-4 font-mono text-white tracking-widest">{invite.code}</td>
                                    <td className="px-6 py-4 text-slate-300">{invite.assignedQuota}</td>
                                    <td className="px-6 py-4">
                                        {invite.isUsed ? (
                                            <span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded">Used by {invite.usedBy}</span>
                                        ) : (
                                            <span className="text-xs bg-teal-500/10 text-teal-400 px-2 py-1 rounded">Available</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!invite.isUsed && (
                                            <button onClick={() => handleDeleteInvite(invite.id)} className="text-slate-500 hover:text-red-500 transition">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {invites.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">No active invite codes.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};