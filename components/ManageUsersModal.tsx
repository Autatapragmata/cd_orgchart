import React, { useState } from 'react';
import { XIcon } from './icons/XIcon';
import { UserRole } from '../App';
import { db } from '../firebase';

const ROLES_DOC_REF = db.collection('app_config').doc('user_roles');

interface Props {
    roles: Record<string, UserRole>;
    currentUserEmail: string;
    superAdminEmail: string;
    onClose: () => void;
    onRolesChange: (newRoles: Record<string, UserRole>) => void;
}

const ManageUsersModal: React.FC<Props> = ({ roles, currentUserEmail, superAdminEmail, onClose, onRolesChange }) => {
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<Exclude<UserRole, 'viewer'>>('contributor');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const saveRoles = async (updatedRoles: Record<string, UserRole>) => {
        setSaving(true);
        setError('');
        try {
            await ROLES_DOC_REF.set({ roles: updatedRoles });
            onRolesChange(updatedRoles);
        } catch (e) {
            console.error(e);
            setError('Failed to save changes. You may not have permission.');
        }
        setSaving(false);
    };

    const handleRoleChange = (email: string, role: UserRole) => {
        saveRoles({ ...roles, [email]: role });
    };

    const handleRemove = (email: string) => {
        const updated = { ...roles };
        delete updated[email];
        saveRoles(updated);
    };

    const handleAdd = () => {
        const trimmed = newEmail.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }
        if (roles[trimmed]) {
            setError('This user already has a role assigned.');
            return;
        }
        setError('');
        saveRoles({ ...roles, [trimmed]: newRole });
        setNewEmail('');
    };

    const sortedEntries = Object.entries(roles).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div onClick={onClose} className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg relative">
                <div className="flex justify-between items-center mb-1">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Manage User Permissions</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Users not listed here are automatically assigned the <strong>Viewer</strong> (read-only) role.
                </p>

                {/* Super admin row */}
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-2">
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{superAdminEmail}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-medium">Owner</span>
                </div>

                {/* Existing users */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 mb-4">
                    {sortedEntries.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No additional users assigned yet.</p>
                    )}
                    {sortedEntries.map(([email, role]) => (
                        <div key={email} className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-700/50">
                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{email}</span>
                            <select
                                value={role}
                                onChange={(e) => handleRoleChange(email, e.target.value as UserRole)}
                                disabled={saving}
                                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 disabled:opacity-50"
                            >
                                <option value="admin">Admin</option>
                                <option value="contributor">Contributor</option>
                                <option value="viewer">Viewer</option>
                            </select>
                            <button
                                onClick={() => handleRemove(email)}
                                disabled={saving || email === currentUserEmail}
                                title={email === currentUserEmail ? "You can't remove yourself" : 'Remove user'}
                                className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add new user */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Add User</p>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => { setNewEmail(e.target.value); setError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder="user@example.com"
                            className="flex-1 border border-slate-300 dark:border-slate-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                        />
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as Exclude<UserRole, 'viewer'>)}
                            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                        >
                            <option value="admin">Admin</option>
                            <option value="contributor">Contributor</option>
                        </select>
                        <button
                            onClick={handleAdd}
                            disabled={saving}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                </div>

                {saving && <p className="text-xs text-slate-400 mt-3 text-right">Saving...</p>}
            </div>
        </div>
    );
};

export default ManageUsersModal;
