import React, { useState } from 'react';
import { XIcon } from './icons/XIcon';
import { UserRole } from '../App';
import { ChartMeta } from '../types';
import { db } from '../firebase';

const ROLES_DOC_REF = db.collection('app_config').doc('user_roles');

const AccessEmailInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    onAdd: () => void;
    disabled: boolean;
    suggestions: string[];
}> = ({ value, onChange, onAdd, disabled, suggestions }) => {
    const [open, setOpen] = useState(false);
    const showSuggestions = open && value.length > 0 && suggestions.length > 0;

    return (
        <div className="relative flex gap-2 mt-2">
            <div className="relative flex-1">
                <input
                    type="email"
                    value={value}
                    onChange={(e) => { onChange(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setOpen(false); onAdd(); } if (e.key === 'Escape') setOpen(false); }}
                    placeholder="user@example.com"
                    disabled={disabled}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 disabled:opacity-50"
                />
                {showSuggestions && (
                    <ul className="absolute z-10 left-0 right-0 top-full mt-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-lg max-h-36 overflow-y-auto">
                        {suggestions.map(email => (
                            <li
                                key={email}
                                onMouseDown={() => { onChange(email); setOpen(false); }}
                                className="px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer truncate"
                            >
                                {email}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <button
                onClick={() => { setOpen(false); onAdd(); }}
                disabled={disabled}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
            >
                Add
            </button>
        </div>
    );
};

interface Props {
    roles: Record<string, UserRole>;
    currentUserEmail: string;
    superAdminEmail: string;
    charts: ChartMeta[];
    onClose: () => void;
    onRolesChange: (newRoles: Record<string, UserRole>) => void;
    onChartAccessChange: (updatedCharts: ChartMeta[]) => void;
}

const ManageUsersModal: React.FC<Props> = ({ roles, currentUserEmail, superAdminEmail, charts, onClose, onRolesChange, onChartAccessChange }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'access'>('users');

    // Users tab state
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<Exclude<UserRole, 'viewer'>>('contributor');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Chart access tab state
    const [accessEmail, setAccessEmail] = useState('');
    const [accessError, setAccessError] = useState('');
    const [savingAccess, setSavingAccess] = useState(false);

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

    // --- Chart access helpers ---

    const saveChartAccess = async (updatedCharts: ChartMeta[]) => {
        setSavingAccess(true);
        setAccessError('');
        try {
            await onChartAccessChange(updatedCharts);
        } catch (e) {
            setAccessError('Failed to save. Please try again.');
        }
        setSavingAccess(false);
    };

    const toggleChartRestricted = (chartId: string, restricted: boolean) => {
        const updated = charts.map(c =>
            c.id === chartId
                ? { ...c, allowedEmails: restricted ? [] : undefined }
                : c
        );
        saveChartAccess(updated);
    };

    const addAllowedEmail = (chartId: string) => {
        const trimmed = accessEmail.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@')) {
            setAccessError('Please enter a valid email address.');
            return;
        }
        const chart = charts.find(c => c.id === chartId);
        if (!chart) return;
        const current = chart.allowedEmails || [];
        if (current.includes(trimmed)) {
            setAccessError('This email is already on the list.');
            return;
        }
        setAccessError('');
        setAccessEmail('');
        const updated = charts.map(c =>
            c.id === chartId ? { ...c, allowedEmails: [...current, trimmed] } : c
        );
        saveChartAccess(updated);
    };

    const removeAllowedEmail = (chartId: string, email: string) => {
        const updated = charts.map(c =>
            c.id === chartId
                ? { ...c, allowedEmails: (c.allowedEmails || []).filter(e => e !== email) }
                : c
        );
        saveChartAccess(updated);
    };

    const sortedEntries = Object.entries(roles).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div onClick={onClose} className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg relative">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Manage Users</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${activeTab === 'users' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Users &amp; Roles
                    </button>
                    <button
                        onClick={() => { setActiveTab('access'); setAccessError(''); setAccessEmail(''); }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${activeTab === 'access' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Chart Access
                    </button>
                </div>

                {activeTab === 'users' && (
                    <>
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
                    </>
                )}

                {activeTab === 'access' && (
                    <>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            By default all authenticated users can see every chart. Restrict a chart to limit it to specific email addresses. Administrators always see all charts.
                        </p>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {charts.map((chart) => {
                                const isRestricted = Array.isArray(chart.allowedEmails);
                                return (
                                    <div key={chart.id} className="border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate mr-2">{chart.name}</span>
                                            <select
                                                value={isRestricted ? 'restricted' : 'everyone'}
                                                onChange={(e) => toggleChartRestricted(chart.id, e.target.value === 'restricted')}
                                                disabled={savingAccess}
                                                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 disabled:opacity-50 flex-shrink-0"
                                            >
                                                <option value="everyone">Everyone</option>
                                                <option value="restricted">Specific users only</option>
                                            </select>
                                        </div>
                                        {isRestricted && (
                                            <div className="mt-2 space-y-1">
                                                {(chart.allowedEmails || []).length === 0 && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 italic">No users added yet — only admins can see this chart.</p>
                                                )}
                                                {(chart.allowedEmails || []).map(email => (
                                                    <div key={email} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded px-2 py-1">
                                                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{email}</span>
                                                        <button
                                                            onClick={() => removeAllowedEmail(chart.id, email)}
                                                            disabled={savingAccess}
                                                            className="text-slate-400 hover:text-red-500 disabled:opacity-30 ml-2 flex-shrink-0"
                                                        >
                                                            <XIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <AccessEmailInput
                                                    value={accessEmail}
                                                    onChange={(v) => { setAccessEmail(v); setAccessError(''); }}
                                                    onAdd={() => addAllowedEmail(chart.id)}
                                                    disabled={savingAccess}
                                                    suggestions={[superAdminEmail, ...Object.keys(roles)].filter(e =>
                                                        e.toLowerCase().includes(accessEmail.toLowerCase()) &&
                                                        !(chart.allowedEmails || []).includes(e)
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {accessError && <p className="text-red-500 text-xs mt-2">{accessError}</p>}
                        {savingAccess && <p className="text-xs text-slate-400 mt-3 text-right">Saving...</p>}
                    </>
                )}
            </div>
        </div>
    );
};

export default ManageUsersModal;
