import React, { useState } from 'react';
import { XIcon } from './icons/XIcon';

interface DeleteChartModalProps {
  chartName: string;
  isPrimaryChart: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteChartModal: React.FC<DeleteChartModalProps> = ({ chartName, isPrimaryChart, onConfirm, onCancel }) => {
  const [inputValue, setInputValue] = useState('');
  const isMatch = inputValue === chartName;

  return (
    <div
      onClick={onCancel}
      className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md relative"
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Delete chart?</h2>
          <button onClick={onCancel} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 ml-4 flex-shrink-0">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {isPrimaryChart && (
          <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">This is the primary chart.</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
              Deleting it is permanent and will remove all of its data for every user. This action cannot be undone.
            </p>
          </div>
        )}

        {!isPrimaryChart && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            This will permanently delete <span className="font-semibold text-slate-800 dark:text-slate-200">{chartName}</span> and all of its data. This action cannot be undone.
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Type <span className="font-bold text-slate-900 dark:text-slate-100">{chartName}</span> to confirm:
        </label>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          autoFocus
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 mb-4"
          placeholder={chartName}
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isMatch}
            className="px-4 py-2 text-sm rounded-md font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Delete chart
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteChartModal;
