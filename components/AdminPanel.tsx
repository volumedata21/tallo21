import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { dataService } from '../services/dataService';
import { X, Trash2, RotateCcw, Plus, Users, HardDrive, Settings } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onUpdate: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, users, onUpdate }) => {
  const [newUser, setNewUser] = useState({ username: '', email: '', role: 'user' as const, quota: '20GB' });
  
  // FIX: Initialize with default/empty, not dataService call
  const [settings, setSettings] = useState<SystemSettings>({ maxUploadSize: 'Loading...' });

  // FIX: Load settings asynchronously when panel opens
  useEffect(() => {
    if (isOpen) {
        dataService.getSystemSettings().then(setSettings).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await dataService.addUser({
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      quota: newUser.quota,
      avatarSeed: newUser.username,
      inviteCode: Math.random().toString(36).substring(7).toUpperCase()
    });
    setNewUser({ username: '', email: '', role: 'user', quota: '20GB' });
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await dataService.deleteUser(id);
      onUpdate();
    }
  };

  const handleSettingsSave = async () => {
    await dataService.updateSystemSettings(settings);
    alert('System settings saved.');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      {/* ... The rest of your JSX is fine, no changes needed ... */}
      <div className="bg-slate-900 w-full max-w-5xl rounded-2xl border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-teal-500/10 rounded-lg text-teal-500">
                <Users size={24} />
             </div>
             <h2 className="text-xl font-bold text-white">Admin Dashboard</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* System Settings */}
          <section className="bg-slate-800/30 p-6 rounded-xl border border-slate-800">
             <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
               <Settings size={16} /> System Config
             </h3>
             <div className="flex items-end gap-4">
                <div className="flex-1">
                   <label className="block text-xs text-slate-500 mb-1">Max Upload Size (per file)</label>
                   <input 
                      value={settings.maxUploadSize}
                      onChange={e => setSettings({...settings, maxUploadSize: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none"
                   />
                </div>
                <button onClick={handleSettingsSave} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition">
                  Save Config
                </button>
             </div>
          </section>

          {/* User Management */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Users size={16} /> User Management
            </h3>
            
            {/* Create User Form */}
            <form onSubmit={handleCreate} className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input 
                  placeholder="Username" 
                  required
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none" 
                />
                <input 
                  placeholder="Email" 
                  required
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none" 
                />
                 <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                </select>
                <input 
                  placeholder="Quota (e.g. 20GB)" 
                  value={newUser.quota}
                  onChange={e => setNewUser({...newUser, quota: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none" 
                />
                <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors">
                  <Plus size={18} /> Add
                </button>
              </div>
            </form>

            {/* User List Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-800 text-slate-400 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Data Usage</th>
                    <th className="px-6 py-4">Invite Code</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${user.avatarSeed}`} className="w-8 h-8 rounded-full bg-slate-700" />
                           <div>
                             <div className="font-medium text-white">{user.username}</div>
                             <div className="text-xs text-slate-500">{user.email}</div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-700 text-slate-300'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 flex items-center gap-2">
                        <HardDrive size={14} className="text-slate-500" />
                        {user.usedQuota} / {user.quota}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-teal-400">
                        {user.inviteCode || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <button onClick={() => dataService.resetPassword(user.id)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full" title="Reset Password">
                              <RotateCcw size={16} />
                           </button>
                           <button onClick={() => handleDelete(user.id)} className="p-2 text-slate-400 hover:text-teal-500 hover:bg-teal-500/10 rounded-full" title="Delete User">
                              <Trash2 size={16} />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};