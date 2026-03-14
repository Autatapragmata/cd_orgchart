import React from 'react';

interface ColorPickerProps {
    onSelectColor: (color: string | null) => void;
    activeColor: string | null;
}

// An expanded color palette for more user choice.
const colors = [
    { name: 'rose', value: '#f43f5e' },
    { name: 'orange', value: '#f97316' },
    { name: 'amber', value: '#f59e0b' },
    { name: 'lime', value: '#84cc16' },
    { name: 'emerald', value: '#10b981' },
    { name: 'teal', value: '#14b8a6' },
    { name: 'cyan', value: '#06b6d4' },
    { name: 'sky', value: '#3b82f6' },
    { name: 'violet', value: '#8b5cf6' },
    { name: 'fuchsia', value: '#d946ef' },
    { name: 'pink', value: '#ec4899' },
    { name: 'slate', value: '#64748b' },
];

const ColorPicker: React.FC<ColorPickerProps> = ({ onSelectColor, activeColor }) => {
    return (
        <div 
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-3"
            // Prevent clicks inside the picker from propagating to the chart background
            onClick={(e) => e.stopPropagation()}
        >
            <div className="grid grid-cols-6 gap-2">
                {colors.map(color => (
                    <button
                        key={color.name}
                        title={color.name}
                        onClick={() => onSelectColor(color.value)}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none ${activeColor === color.value ? 'ring-2 ring-offset-2 dark:ring-offset-slate-800 ring-indigo-500' : ''}`}
                        style={{ backgroundColor: color.value }}
                    />
                ))}
            </div>
            <button
                onClick={() => onSelectColor(null)}
                className="w-full text-sm py-1 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
                Clear Color
            </button>
        </div>
    );
};

export default ColorPicker;
