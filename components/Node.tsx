import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Person } from '../types';
import EditableText from './EditableText';
import Tag from './Tag';
import ColorPicker from './ColorPicker';
import { PlusIcon } from './icons/PlusIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { PaletteIcon } from './icons/PaletteIcon';
import { TagIcon } from './icons/TagIcon';
import { BuildingIcon } from './icons/BuildingIcon';
import { useTransformContext } from 'react-zoom-pan-pinch';
import { TrashIcon } from './icons/TrashIcon';

interface NodeProps {
  person: Person & { propagatedColor?: string };
  isSelected: boolean;
  highlightStatus: 'normal' | 'highlight' | 'descendant' | 'faded' | 'child-of-selected';
  canEditContent: boolean;
  canEditStructure: boolean;
  onUpdate: (nodeId: string, updates: Partial<Omit<Person, 'id' | 'children'>>) => void;
  onAddChild: (parentId: string, type?: 'person' | 'division') => void;
  onAddSkill: (nodeId: string, skill: string) => void;
  onRemoveSkill: (nodeId: string, skillToRemove: string) => void;
  onAddProject: (nodeId: string, project: string) => void;
  onRemoveProject: (nodeId: string, projectToRemove: string) => void;
  onMoveNode: (draggedId: string, targetId: string) => void;
  onNodeDragEnd: (nodeId: string, delta: { dx: number, dy: number }) => void;
  onToggleSelection: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const Node: React.FC<NodeProps> = ({
    person,
    isSelected,
    highlightStatus,
    canEditContent,
    canEditStructure,
    onUpdate,
    onAddChild,
    onAddSkill,
    onRemoveSkill,
    onAddProject,
    onRemoveProject,
    onMoveNode,
    onNodeDragEnd,
    onToggleSelection,
    onRemove,
    onMouseEnter,
    onMouseLeave
}) => {
  const [newSkill, setNewSkill] = useState('');
  const [newProject, setNewProject] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(person.notes || '');

  const nodeRef = useRef<HTMLDivElement>(null);
  const { transformState } = useTransformContext();
  const isReadOnly = !canEditContent && !canEditStructure;
  const isDivision = person.type === 'division';

  // Sync local notes if the prop changes from outside (e.g. remote update)
  useEffect(() => {
    setLocalNotes(person.notes || '');
  }, [person.notes]);

  useLayoutEffect(() => {
    if (nodeRef.current) {
        nodeRef.current.style.transform = `translate(${person.x || 0}px, ${person.y || 0}px)`;
    }
  }, [person.x, person.y]);

  useEffect(() => {
    if (!canEditStructure) return;

    const node = nodeRef.current;
    if (!node) return;

    let dragStartPos: { x: number; y: number } | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || (e.target instanceof Element && e.target.closest('.nodrag-area, input, button, a, textarea')) || e.ctrlKey || e.metaKey) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      dragStartPos = { x: e.clientX, y: e.clientY };
      const initialNodePos = { x: person.x || 0, y: person.y || 0 };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragStartPos) return;
        const scale = transformState.scale;
        const dx = (e.clientX - dragStartPos.x) / scale;
        const dy = (e.clientY - dragStartPos.y) / scale;
        node.style.transform = `translate(${initialNodePos.x + dx}px, ${initialNodePos.y + dy}px)`;
      };

      const handleMouseUp = (e: MouseEvent) => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        if (!dragStartPos) return;

        const scale = transformState.scale;
        const dx = (e.clientX - dragStartPos.x) / scale;
        const dy = (e.clientY - dragStartPos.y) / scale;

        if (dx !== 0 || dy !== 0) {
          onNodeDragEnd(person.id, { dx, dy });
        }

        dragStartPos = null;
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    node.addEventListener('mousedown', handleMouseDown);
    return () => node.removeEventListener('mousedown', handleMouseDown);
  }, [person.id, person.x, person.y, onNodeDragEnd, transformState.scale, canEditStructure]);

  const accentColor = person.color || person.propagatedColor;

  const highlightClasses = {
      normal: 'opacity-100',
      highlight: 'opacity-100 animate-pulse-highlight',
      descendant: 'opacity-100 ring-2 ring-amber-300 ring-offset-2 dark:ring-offset-slate-900',
      'child-of-selected': 'opacity-100 ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-900',
      faded: 'opacity-50',
  }[highlightStatus];

  const selectionClasses = isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : '';

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSkill.trim() && !(person.skills || []).includes(newSkill.trim())) {
      onAddSkill(person.id, newSkill.trim());
      setNewSkill('');
    }
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProject.trim() && !(person.projects || []).includes(newProject.trim())) {
      onAddProject(person.id, newProject.trim());
      setNewProject('');
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!canEditStructure) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/org-chart-node', person.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEditStructure) return;
    const draggedId = e.dataTransfer.getData('application/org-chart-node');
    if (draggedId && draggedId !== person.id) {
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    } else {
        e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEditStructure) return;
    setIsDragOver(false);
    const draggedId = e.dataTransfer.getData('application/org-chart-node');
    if (draggedId && draggedId !== person.id) onMoveNode(draggedId, person.id);
  };

  const handleSetColor = (color: string | null) => {
    onUpdate(person.id, { color: color === person.color ? undefined : color });
    setIsColorPickerOpen(false);
  };

  const handleNotesBlur = () => {
    if (localNotes !== (person.notes || '')) {
      onUpdate(person.id, { notes: localNotes });
    }
  };

  // Shared bottom action buttons
  const actionButtons = (
    <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isReadOnly ? 'hidden' : ''}`}>
        {canEditStructure && (
          <button
            onClick={() => onAddChild(person.id, 'person')}
            className="bg-indigo-500 text-white rounded-full p-2 shadow-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform hover:scale-110 nodrag-area"
            aria-label="Add person"
            title="Add person"
          >
            <UserPlusIcon className="w-4 h-4"/>
          </button>
        )}
        {canEditStructure && (
          <button
            onClick={() => onAddChild(person.id, 'division')}
            className="bg-violet-500 text-white rounded-full p-2 shadow-lg hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-transform hover:scale-110 nodrag-area"
            aria-label="Add division"
            title="Add division"
          >
            <BuildingIcon className="w-4 h-4"/>
          </button>
        )}
        {canEditContent && (
          <div className="relative nodrag-area">
              <button
              onClick={() => setIsColorPickerOpen(v => !v)}
              className="bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full p-2 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform hover:scale-110"
              aria-label="Set accent color"
              >
                  <PaletteIcon className="w-4 h-4"/>
              </button>
              {isColorPickerOpen && <ColorPicker onSelectColor={handleSetColor} activeColor={person.color || null} />}
          </div>
        )}
        {canEditStructure && (
          <button
            onClick={() => onRemove(person.id)}
            className="bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-transform hover:scale-110 nodrag-area"
            aria-label="Delete"
          >
            <TrashIcon className="w-4 h-4"/>
          </button>
        )}
    </div>
  );

  const sharedWrapperProps = {
    ref: nodeRef,
    draggable: canEditStructure,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: () => setIsDragOver(false),
    onDrop: handleDrop,
    onMouseEnter,
    onMouseLeave,
    className: "absolute w-64",
    style: { left: 0, top: 0, transform: `translate(${person.x || 0}px, ${person.y || 0}px)` },
  };

  const sharedInnerProps = {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if ((e.ctrlKey || e.metaKey) && canEditStructure) onToggleSelection(person.id);
    },
  };

  // --- Division card ---
  if (isDivision) {
    return (
      <div {...sharedWrapperProps}>
        <div
          {...sharedInnerProps}
          className={`group nodrag relative bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md dark:shadow-xl dark:shadow-black/25 border dark:border-transparent ${isDragOver ? 'ring-2 ring-violet-500 ring-offset-2' : ''} ${highlightClasses} ${selectionClasses}`}
          style={{
            borderTop: `4px solid ${accentColor || '#7c3aed'}`,
            transition: 'opacity 300ms, border-color 300ms, box-shadow 300ms',
          }}
        >
          <div className="flex items-start gap-2 mb-1">
            <BuildingIcon className="w-4 h-4 mt-1 shrink-0" style={{ color: accentColor || '#7c3aed' }} />
            <div className="flex-1 min-w-0">
              <EditableText
                initialValue={person.name}
                onSave={(value) => onUpdate(person.id, { name: value })}
                textClasses="font-bold text-lg text-slate-800 dark:text-slate-100 break-all leading-tight"
                inputClasses="font-bold text-lg"
                isReadOnly={!canEditContent}
              />
              {(person.title || canEditContent) && (
                <EditableText
                  initialValue={person.title}
                  onSave={(value) => onUpdate(person.id, { title: value })}
                  textClasses="text-sm text-slate-500 dark:text-slate-400 break-all leading-tight"
                  inputClasses="text-sm"
                  style={{ color: accentColor || undefined }}
                  isReadOnly={!canEditContent}
                />
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 nodrag-area">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Notes</h4>
            {canEditContent ? (
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes, description, responsibilities..."
                rows={3}
                className="w-full text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-1 focus:ring-violet-500 bg-transparent resize-none nodrag"
              />
            ) : (
              localNotes && <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{localNotes}</p>
            )}
          </div>

          {actionButtons}
        </div>
      </div>
    );
  }

  // --- Person card (existing layout) ---
  return (
    <div {...sharedWrapperProps}>
      <div
        {...sharedInnerProps}
        className={`group nodrag relative bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md dark:shadow-xl dark:shadow-black/25 border dark:border-transparent ${isDragOver ? 'ring-2 ring-indigo-500 ring-offset-2' : ''} ${highlightClasses} ${selectionClasses}`}
        style={{
            borderTop: `4px solid ${accentColor || 'transparent'}`,
            transition: 'opacity 300ms, border-color 300ms, box-shadow 300ms',
        }}
      >
        <div className="text-center">
            <EditableText
            initialValue={person.name}
            onSave={(value) => onUpdate(person.id, { name: value })}
            textClasses="font-bold text-lg text-slate-800 dark:text-slate-100 break-all leading-tight"
            inputClasses="font-bold text-lg text-center"
            isReadOnly={!canEditContent}
            />
            <EditableText
            initialValue={person.title}
            onSave={(value) => onUpdate(person.id, { title: value })}
            textClasses="text-sm break-all leading-tight"
            inputClasses="text-sm text-center"
            style={{color: accentColor || '#4f46e5'}}
            isReadOnly={!canEditContent}
            />
        </div>

        {person.team && (
            <div className="mt-3 text-center text-xs flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 nodrag-area">
                <TagIcon className="w-3.5 h-3.5" />
                <EditableText
                initialValue={person.team}
                onSave={(value) => onUpdate(person.id, { team: value })}
                textClasses="font-semibold"
                inputClasses="text-xs text-center font-semibold"
                isReadOnly={!canEditContent}
                />
            </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 nodrag-area">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Projects</h4>
            <div className="flex flex-wrap gap-1">
            {(person.projects || []).map(project => (
                <Tag key={project} skill={project} onRemove={() => onRemoveProject(person.id, project)} isReadOnly={!canEditContent} />
            ))}
            </div>
            {!isReadOnly && canEditContent && (
                <form onSubmit={handleAddProject} className="mt-2 flex items-center gap-2">
                <input
                    type="text"
                    placeholder="Add project..."
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    className="flex-grow text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-1 focus:ring-indigo-500 bg-transparent"
                />
                <button type="submit" className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                </button>
                </form>
            )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 nodrag-area">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Skills</h4>
            </div>
            <div className="flex flex-wrap gap-1">
            {(person.skills || []).map(skill => (
                <Tag key={skill} skill={skill} onRemove={() => onRemoveSkill(person.id, skill)} isReadOnly={!canEditContent} />
            ))}
            </div>
            {!isReadOnly && canEditContent && (
                <form onSubmit={handleAddSkill} className="mt-2 flex items-center gap-2">
                <input
                    type="text"
                    placeholder="Add skill..."
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    className="flex-grow text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-1 focus:ring-indigo-500 bg-transparent"
                />
                <button type="submit" className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                </button>
                </form>
            )}
        </div>

        {actionButtons}
      </div>
    </div>
  );
};

export default Node;
