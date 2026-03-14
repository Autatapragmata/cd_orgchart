import React from 'react';
import { UserRole } from '../App';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { PencilIcon } from './icons/PencilIcon';
import { EyeIcon } from './icons/EyeIcon';

interface PermissionLozengeProps {
  role: UserRole;
}

const roleConfig = {
  admin: {
    label: 'Administrator',
    Icon: ShieldCheckIcon,
    colorClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    description: 'You have full access to edit the chart structure and all content.',
  },
  contributor: {
    label: 'Contributor',
    Icon: PencilIcon,
    colorClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    description: 'You can edit content like names, titles, and skills, but you cannot change the chart structure.',
  },
  viewer: {
    label: 'Viewer',
    Icon: EyeIcon,
    colorClasses: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    description: 'You have read-only access to this chart.',
  },
};

const PermissionLozenge: React.FC<PermissionLozengeProps> = ({ role }) => {
  const { label, Icon, colorClasses, description } = roleConfig[role];

  return (
    <div className="group relative">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md text-xs font-semibold ${colorClasses}`}>
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-30">
        <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{label} Role</p>
        <p>{description}</p>
        <p className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          To request a change to your access level, please contact Michael Kavalar.
        </p>
      </div>
    </div>
  );
};

export default PermissionLozenge;