import React from 'react';
import { ChartMeta } from '../types';
import { UserRole } from '../App';
import { PlusIcon } from './icons/PlusIcon';
import { XIcon } from './icons/XIcon';

interface ChartTabsProps {
    charts: ChartMeta[];
    activeChartId: string | null;
    userRole: UserRole;
    onSwitch: (id: string) => void;
    onAdd: () => void;
    onDelete: (id: string) => void;
}

const ChartTabs: React.FC<ChartTabsProps> = ({ charts, activeChartId, userRole, onSwitch, onAdd, onDelete }) => {
    const isAdmin = userRole === 'admin';

    return (
        <div className="flex items-stretch h-9 bg-slate-200 dark:bg-slate-950 border-b border-slate-300 dark:border-slate-700 overflow-x-auto shrink-0 select-none">
            {charts.map((chart) => {
                const isActive = chart.id === activeChartId;
                return (
                    <div
                        key={chart.id}
                        onClick={() => onSwitch(chart.id)}
                        className={`group flex items-center gap-1.5 px-3 cursor-pointer whitespace-nowrap border-r border-slate-300 dark:border-slate-700 transition-colors ${
                            isActive
                                ? 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                        }`}
                    >
                        <span className={`text-sm truncate max-w-[140px] ${isActive ? 'font-medium' : ''}`}>
                            {chart.name || 'Untitled'}
                        </span>
                        {isAdmin && charts.length > 1 && chart.id !== charts[0].id && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(chart.id); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity"
                                title="Delete chart"
                            >
                                <XIcon className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                );
            })}
            {isAdmin && (
                <button
                    onClick={onAdd}
                    className="flex items-center px-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Add new chart"
                >
                    <PlusIcon className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default ChartTabs;
