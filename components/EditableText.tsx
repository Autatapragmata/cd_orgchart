import React, { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  initialValue: string;
  onSave: (value: string) => void;
  textClasses?: string;
  inputClasses?: string;
  style?: React.CSSProperties;
  isReadOnly?: boolean;
}

const EditableText: React.FC<EditableTextProps> = ({ initialValue, onSave, textClasses, inputClasses, style, isReadOnly = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim());
    } else {
      setValue(initialValue); // Revert if empty
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setValue(initialValue);
      setIsEditing(false);
    }
  };
  
  const handleClick = (e: React.MouseEvent) => {
    // Do not enter edit mode if read-only or if Ctrl/Cmd is pressed.
    if (isReadOnly || e.ctrlKey || e.metaKey) {
        return;
    }
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`bg-slate-100 dark:bg-slate-700 rounded-md p-1 -m-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 ${inputClasses}`}
        style={style}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`p-1 -m-1 ${!isReadOnly ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-md transition-colors' : ''} ${textClasses}`}
      style={style}
    >
      {initialValue}
    </div>
  );
};

export default EditableText;
