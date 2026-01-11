import React, { useState, useEffect, useMemo } from 'react';
import { User, SystemSettings } from '../types';
import { dataService } from '../services/dataService';
import { X, Trash2, Users, HardDrive, Settings, Ticket, Copy, Check, Search, ArrowUpDown, Loader2, Save, Key, RefreshCw } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User | null; // <--- NEW: Added to prevent self-deletion
  onUpdate: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, users, currentUser, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');
  const [settings, setSettings] = useState<SystemSettings>({
    maxUploadSize: 'Loading...',
    maxUsers: 10,
    isServerOpen: true,
    ssrfWhitelist: '' // <--- Add default
  });
  const [invites, setInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByUsage, setSortByUsage] = useState(false);

  // Create Invite State
  const [inviteQuota, setInviteQuota] = useState('20GB');
  const [newInvite, setNewInvite] = useState<{ code: string, quota: string } | null>(null);

  // Edit Quota State
  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null);
  const [tempQuota, setTempQuota] = useState('');

  // Password Reset State
  const [resetLink, setResetLink] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, invitesData] = await Promise.all([
        dataService.getSystemSettings(),
        dataService.getInvites()
      ]);
      setSettings(settingsData);
      setInvites(invitesData);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const handleGenerateInvite = async () => {
    setIsSaving(true);
    const res = await dataService.generateInvite(inviteQuota);
    setNewInvite({ code: res.code, quota: res.assignedQuota });
    setIsSaving(false);
    loadData();
  };

  const handleGenerateResetLink = async (userId: string, username: string) => {
    try {
      const token = await dataService.generateResetToken(userId);
      const link = `${window.location.origin}/?token=${token}`;
      setResetLink(link);
    } catch (e) {
      alert("Failed to generate link");
    }
  };

  const handleDeleteInvite = async (id: string) => {
    await dataService.deleteInvite(id);
    loadData();
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
      await dataService.deleteUser(id);
      onUpdate();
    }
  };

  const handleSettingsSave = async () => {
    setIsSaving(true);
    await dataService.updateSystemSettings(settings);
    setIsSaving(false);
  };

  const saveQuota = async (id: string) => {
    await dataService.updateUserQuota(id, tempQuota);
    setEditingQuotaId(null);
    onUpdate();
  };

  const filteredUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    let result = users.filter(u =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (sortByUsage) {
      result.sort((a, b) => (b.usedQuota || '').localeCompare(a.usedQuota || ''));
    }
    return result;
  }, [users, searchTerm, sortByUsage]);

  if (!isOpen) return null;

  // Logic: "Require Login" is the opposite of "isServerOpen"
  const requireLogin = !settings.isServerOpen;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[85vh] sm:rounded-2xl border-0 sm:border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-800 shrink-0 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-lg text-teal-500">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Admin Dashboard</h2>
              <p className="text-xs text-slate-500">Manage users, settings, and invites</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-4 sm:px-6 shrink-0 bg-slate-900 gap-6">
          <button onClick={() => setActiveTab('users')} className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'border-teal-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
            <Users size={16} /> Users & Settings
          </button>
          <button onClick={() => setActiveTab('invites')} className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'invites' ? 'border-teal-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
            <Ticket size={16} /> Invite Codes
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#0B1120] custom-scrollbar relative">

          {activeTab === 'users' ? (
            <>
              {/* System Settings */}
              <section className="bg-slate-800/30 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-teal-500 uppercase tracking-wider flex items-center gap-2">
                    <Settings size={16} /> System Configuration
                  </h3>
                  {isSaving && <span className="text-xs text-slate-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving...</span>}
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Allowed Local Hosts (SSRF Whitelist)
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    By default, Tallo blocks connections to local IPs (like 192.168.x.x) for security.
                    Add specific IPs or domains here to allow scraping from them.
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.50, my-nas.local"
                    value={settings.ssrfWhitelist || ''}
                    onChange={e => setSettings({ ...settings, ssrfWhitelist: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {/* Max Upload Size */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Max Upload Size</label>
                      <div className="relative">
                        <input
                          value={settings.maxUploadSize}
                          onChange={e => setSettings({ ...settings, maxUploadSize: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-white focus:border-teal-500 outline-none transition-all"
                          placeholder="e.g. 50MB"
                        />
                        <div className="absolute right-3 top-2.5 text-slate-600 pointer-events-none">
                          <HardDrive size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Max User Limit */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Max User Limit</label>
                      <input
                        type="number"
                        value={settings.maxUsers}
                        onChange={e => setSettings({ ...settings, maxUsers: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none transition-all"
                      />
                    </div>

                    {/* Public Access / Require Login - UPDATED UI */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Public Access</label>
                      <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 h-[42px]">
                        <span className="text-sm text-slate-300">Require Login</span>
                        <button
                          onClick={() => setSettings({ ...settings, isServerOpen: !settings.isServerOpen })}
                          className={`w-10 h-5 rounded-full transition-colors relative ${requireLogin ? 'bg-teal-600' : 'bg-slate-700'}`}
                        >
                          <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${requireLogin ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>

                  </div>
                  <button onClick={handleSettingsSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 min-w-[120px] h-[42px]">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save</>}
                  </button>
                </div>
              </section>

              {/* Users Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-full pl-9 pr-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{filteredUsers.length} Users</span>
                  <button
                    onClick={() => setSortByUsage(!sortByUsage)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${sortByUsage ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    <ArrowUpDown size={12} /> Sort by Usage
                  </button>
                </div>
              </div>

              {/* User List Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[650px]">
                    <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase font-semibold backdrop-blur-sm">
                      <tr>
                        <th className="px-6 py-4">User Identity</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Storage (Used / Max)</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredUsers.length > 0 ? filteredUsers.map(user => {
                        // PREVENT SELF DELETION
                        const isSelf = currentUser && user.id === currentUser.id;
                        const isRoot = user.id === 'u1';
                        const canDelete = !isSelf && !isRoot;

                        return (
                          <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                                  <div className="w-full h-full bg-gradient-to-br from-teal-900 to-slate-900 flex items-center justify-center text-teal-400 text-xs font-bold">
                                    {user.username.substring(0, 2).toUpperCase()}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-medium text-white text-sm">
                                    {user.username}
                                    {isSelf && <span className="ml-2 text-[10px] bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded">YOU</span>}
                                  </div>
                                  <div className="text-xs text-slate-500">{user.email || 'No email'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300">
                              {editingQuotaId === user.id ? (
                                <div className="flex items-center gap-2 animate-in fade-in">
                                  <input
                                    autoFocus
                                    value={tempQuota}
                                    onChange={e => setTempQuota(e.target.value)}
                                    className="w-24 bg-slate-950 border border-teal-500 rounded px-2 py-1 text-xs text-white outline-none shadow-[0_0_10px_rgba(20,184,166,0.2)]"
                                  />
                                  <button onClick={() => saveQuota(user.id)} className="p-1 bg-teal-500/20 text-teal-500 rounded hover:bg-teal-500 hover:text-white transition"><Check size={14} /></button>
                                  <button onClick={() => setEditingQuotaId(null)} className="p-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500 hover:text-white transition"><X size={14} /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group/quota cursor-pointer" onClick={() => { setEditingQuotaId(user.id); setTempQuota(user.maxQuota || '20GB'); }}>
                                  <div className="w-full max-w-[100px] h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-500/50 w-1/2"></div>
                                  </div>
                                  <span className="text-xs font-mono">{user.usedQuota} <span className="text-slate-500">/</span> <span className="text-white">{user.maxQuota}</span></span>
                                  <Settings size={12} className="text-slate-600 opacity-0 group-hover/quota:opacity-100 transition-opacity" />
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleGenerateResetLink(user.id, user.username)}
                                  className="p-2 text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition-all"
                                  title="Generate Password Reset Link"
                                >
                                  <Key size={16} />
                                </button>

                                {canDelete ? (
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Delete User"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                ) : (
                                  <div className="w-8 h-8"></div> // Empty spacer
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                              <Search size={24} className="opacity-20" />
                              <p>No users found matching "{searchTerm}"</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {/* ... (INVITES TAB REMAINS UNCHANGED) ... */}
              {/* Generate Invite */}
              <div className="bg-gradient-to-br from-teal-900/20 to-slate-900 border border-teal-900/50 p-6 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-32 bg-teal-500/5 blur-[100px] rounded-full pointer-events-none"></div>

                <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-500/20 rounded-xl text-teal-400 shrink-0 border border-teal-500/20">
                      <Ticket size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Generate Invite</h3>
                      <p className="text-slate-400 text-sm">Create a secure one-time code for new user registration.</p>
                    </div>
                  </div>

                  <div className="flex-1"></div>

                  <div className="flex items-center gap-3 w-full sm:w-auto bg-slate-950/50 p-1.5 rounded-xl border border-slate-800">
                    <input
                      placeholder="Quota (e.g. 30GB)"
                      value={inviteQuota}
                      onChange={e => setInviteQuota(e.target.value)}
                      className="bg-transparent px-3 py-2 text-white w-full sm:w-32 focus:outline-none text-sm placeholder:text-slate-600"
                    />
                    <button onClick={handleGenerateInvite} disabled={isSaving} className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap">
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <><RefreshCw size={16} /> Generate Code</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* New Invite Display */}
              {newInvite && (
                <div className="bg-teal-950/30 border border-teal-500/30 p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-2 shadow-lg shadow-teal-900/10">
                  <div className="flex gap-4">
                    <div className="h-12 w-1 rounded-full bg-teal-500"></div>
                    <div>
                      <span className="text-xs text-teal-400 uppercase tracking-wider font-bold">New Code Created</span>
                      <div className="text-3xl font-mono text-white tracking-widest mt-1 select-all">{newInvite.code}</div>
                      <div className="text-xs text-slate-400 mt-1">Assigned Storage: <span className="text-white">{newInvite.quota}</span></div>
                    </div>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(newInvite.code); alert('Copied!'); }} className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 px-6 rounded-xl transition w-full sm:w-auto shadow-lg shadow-teal-900/20">
                    <Copy size={18} /> Copy to Clipboard
                  </button>
                </div>
              )}

              {/* Invites List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Active Invites</h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                      <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                        <tr>
                          <th className="px-6 py-3">Code</th>
                          <th className="px-6 py-3">Quota</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                        {invites.map(invite => (
                          <tr key={invite.id} className="hover:bg-slate-800/30">
                            <td className="px-6 py-4 font-mono text-white tracking-widest font-medium">{invite.code}</td>
                            <td className="px-6 py-4 text-slate-300">{invite.assignedQuota}</td>
                            <td className="px-6 py-4">
                              {invite.isUsed ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Used by {invite.usedBy}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span> Available
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {!invite.isUsed && (
                                <button onClick={() => handleDeleteInvite(invite.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {invites.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                              No active invite codes found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reset Link Modal/Overlay */}
        {resetLink && (
          <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-slate-950 border border-teal-500/50 p-6 rounded-2xl max-w-lg w-full shadow-2xl shadow-teal-900/20">
              <h3 className="text-xl font-bold text-white mb-2">Password Reset Link Generated</h3>
              <p className="text-slate-400 text-sm mb-6">
                Send this link to the user. It will allow them to set a new password immediately.
                <span className="block mt-2 text-red-400 text-xs font-medium">Warning: Do not share this link with anyone else.</span>
              </p>

              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-xs text-teal-400 break-all mb-4 select-all">
                {resetLink}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setResetLink(null)} className="flex-1 py-2.5 text-slate-400 hover:text-white font-medium transition">
                  Done
                </button>
                <button onClick={() => { navigator.clipboard.writeText(resetLink); alert('Copied!'); }} className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2">
                  <Copy size={16} /> Copy Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};