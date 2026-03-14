import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Person } from '../types';
import { XIcon } from './icons/XIcon';
import { layoutTree, flattenTrees } from '../utils/treeUtils';
import { DownloadIcon } from './icons/DownloadIcon';
import html2canvas from 'html2canvas';
import { SpinnerIcon } from './icons/SpinnerIcon';
import Connectors from './Connectors';
import { SearchIcon } from './icons/SearchIcon';

// --- Sub-components for the Export Preview ---

const ExportTag: React.FC<{ label: string; fontSize: number; }> = ({ label, fontSize }) => (
    <span className="font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300" style={{ fontSize: `${fontSize}px` }}>
      {label}
    </span>
);

type FontFamily = 'font-sans' | 'font-serif' | 'font-mono';

const ExportNode: React.FC<{ person: Person & { x: number, y: number, height: number, propagatedColor?: string }, includeSkills: boolean, includeProjects: boolean, fontSize: number }> = ({ person, includeSkills, includeProjects, fontSize }) => {
  const accentColor = person.color || person.propagatedColor;
  
  const nameFontSize = fontSize;
  const titleFontSize = Math.max(8, fontSize * 0.85);
  const headerFontSize = Math.max(8, fontSize * 0.8);
  const tagFontSize = Math.max(8, fontSize * 0.75);


  return (
    <div
      className="absolute bg-white dark:bg-slate-800 p-3 rounded-md shadow-md border dark:border-slate-700/50 flex flex-col justify-center"
      style={{
        width: 200,
        left: person.x,
        top: person.y,
        height: person.height,
        borderTop: `3px solid ${accentColor || '#a5b4fc'}`, // A default light indigo color
      }}
    >
      <div>
        <div className="text-center mb-2">
            <p className={`font-bold text-slate-800 dark:text-slate-100 break-words`} style={{ fontSize: `${nameFontSize}px`, lineHeight: 1.2 }}>{person.name}</p>
            <p className={`break-words`} style={{ fontSize: `${titleFontSize}px`, lineHeight: 1.2, color: accentColor || '#6366f1' }}>{person.title}</p>
        </div>

        {(includeProjects && person.projects && person.projects.length > 0) || (includeSkills && person.skills && person.skills.length > 0) ? (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {includeProjects && person.projects && person.projects.length > 0 && (
                    <div className="space-y-1">
                        <h4 className="font-semibold text-slate-500 dark:text-slate-400" style={{ fontSize: `${headerFontSize}px`}}>Projects</h4>
                        <div className="flex flex-wrap gap-1">
                            {person.projects.map(p => <ExportTag key={p} label={p} fontSize={tagFontSize} />)}
                        </div>
                    </div>
                )}
                {includeSkills && person.skills && person.skills.length > 0 && (
                    <div className="mt-2 space-y-1">
                        <h4 className="font-semibold text-slate-500 dark:text-slate-400" style={{ fontSize: `${headerFontSize}px`}}>Skills</h4>
                        <div className="flex flex-wrap gap-1">
                            {person.skills.map(s => <ExportTag key={s} label={s} fontSize={tagFontSize} />)}
                        </div>
                    </div>
                )}
            </div>
        ) : null}
      </div>
    </div>
  );
};

// Find a node by its ID from the original nested data structure
const findNodeById = (nodes: Person[], id: string): Person | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

// Recursive component to render the searchable, selectable list of nodes.
const SelectableNode: React.FC<{ 
    node: Person; 
    depth?: number; 
    selectedId: string;
    onSelect: (id: string) => void;
}> = ({ node, depth = 0, selectedId, onSelect }) => {
    const isSelected = selectedId === node.id;
    return (
        <>
            <button
                onClick={() => onSelect(node.id)}
                className={`w-full text-left p-2 rounded-md text-sm transition-colors ${isSelected ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
            >
                {node.name}
            </button>
            {node.children && node.children.length > 0 && (
                node.children.map(child => <SelectableNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />)
            )}
        </>
    );
};

// --- Main Export Modal Component ---

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartData: Person[];
  chartName: string;
  initialSelectedNodeId: string | null;
}

// Accurately calculates the required height of a node by rendering it off-screen.
const calculateNodeHeight = (node: Person, options: { includeSkills: boolean, includeProjects: boolean, fontSize: number, fontFamily: FontFamily }): number => {
    const measurer = document.createElement('div');
    measurer.style.position = 'absolute';
    measurer.style.left = '-9999px';
    measurer.style.top = '0';
    measurer.style.width = `${200 - 24}px`; // 200px node width minus horizontal padding (p-3 = 12px * 2)
    measurer.style.visibility = 'hidden';
    measurer.classList.add(options.fontFamily);
    document.body.appendChild(measurer);

    let innerHTML = '';
    const { includeSkills, includeProjects, fontSize } = options;
    const nameFontSize = fontSize;
    const titleFontSize = Math.max(8, fontSize * 0.85);
    const headerFontSize = Math.max(8, fontSize * 0.8);
    const tagFontSize = Math.max(8, fontSize * 0.75);

    // Name and Title
    innerHTML += `<div class="text-center mb-2">
        <p class="font-bold break-words" style="font-size: ${nameFontSize}px; line-height: 1.2;">${node.name}</p>
        <p class="break-words" style="font-size: ${titleFontSize}px; line-height: 1.2;">${node.title}</p>
    </div>`;

    const projects = includeProjects ? (node.projects || []) : [];
    const skills = includeSkills ? (node.skills || []) : [];
    const hasContent = projects.length > 0 || skills.length > 0;

    if (hasContent) {
        innerHTML += `<div class="mt-2 pt-2 border-t" style="border-color: #e2e8f0;">`;
        if (projects.length > 0) {
            innerHTML += `<div class="space-y-1">
                <h4 class="font-semibold" style="font-size: ${headerFontSize}px;">Projects</h4>
                <div class="flex flex-wrap gap-1">${projects.map(p => `<span class="font-medium px-2 py-0.5 rounded-full" style="font-size: ${tagFontSize}px; display: inline-block;">${p}</span>`).join('')}</div>
            </div>`;
        }
        if (skills.length > 0) {
            innerHTML += `<div class="mt-2 space-y-1">
                <h4 class="font-semibold" style="font-size: ${headerFontSize}px;">Skills</h4>
                <div class="flex flex-wrap gap-1">${skills.map(s => `<span class="font-medium px-2 py-0.5 rounded-full" style="font-size: ${tagFontSize}px; display: inline-block;">${s}</span>`).join('')}</div>
            </div>`;
        }
        innerHTML += `</div>`;
    }

    measurer.innerHTML = innerHTML;
    const contentHeight = measurer.scrollHeight;
    document.body.removeChild(measurer);

    const PADDING_Y = 24; // p-3 top and bottom
    const BORDER_TOP = 3;
    const EXTRA_BUFFER = 8; // A little extra space for aesthetics

    return contentHeight + PADDING_Y + BORDER_TOP + EXTRA_BUFFER;
};


const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, chartData, chartName, initialSelectedNodeId }) => {
  const [selectedRootNodeId, setSelectedRootNodeId] = useState('all');
  const [branchSearch, setBranchSearch] = useState('');
  const [includeSkills, setIncludeSkills] = useState(false);
  const [includeProjects, setIncludeProjects] = useState(false);
  const [isTransparent, setIsTransparent] = useState(true);
  const [fontSize, setFontSize] = useState<number>(12);
  const [fontFamily, setFontFamily] = useState<FontFamily>('font-sans');
  const [exportTheme, setExportTheme] = useState<'light' | 'dark'>(
    () => document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const [isExporting, setIsExporting] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const renderTargetRef = useRef<HTMLDivElement>(null);
  const [previewTransform, setPreviewTransform] = useState('translate(0px, 0px) scale(1)');
  
  // Set initial selection when modal opens
  useEffect(() => {
    if (isOpen) {
        if (initialSelectedNodeId) {
            const allNodes = flattenTrees(chartData).nodes;
            const isValidId = allNodes.some(node => node.id === initialSelectedNodeId);
            if (isValidId) {
                setSelectedRootNodeId(initialSelectedNodeId);
            } else {
                setSelectedRootNodeId('all');
            }
        } else {
            setSelectedRootNodeId('all');
        }
        setBranchSearch('');
    }
  }, [isOpen, initialSelectedNodeId, chartData]);

  // Filter nodes for the selector based on the search query, preserving hierarchy.
  const filteredHierarchicalNodes = useMemo(() => {
    const lowerCaseQuery = branchSearch.toLowerCase();
    if (!lowerCaseQuery) {
        return chartData;
    }
    const filterNodes = (nodes: Person[]): Person[] => {
        const results: Person[] = [];
        for (const node of nodes) {
            const isMatch = node.name.toLowerCase().includes(lowerCaseQuery);
            const filteredChildren = node.children ? filterNodes(node.children) : [];
            if (isMatch || filteredChildren.length > 0) {
                results.push({ ...node, children: filteredChildren });
            }
        }
        return results;
    };
    return filterNodes(chartData);
  }, [branchSearch, chartData]);


  const { nodes, connections, width, height } = useMemo(() => {
    let rootNodes: Person[];
    if (selectedRootNodeId === 'all') {
      rootNodes = chartData;
    } else {
      const foundNode = findNodeById(chartData, selectedRootNodeId);
      rootNodes = foundNode ? [foundNode] : chartData;
    }
    
    // Deep clone and sort children by their 'x' position to mirror the main chart's layout.
    const sortChildrenByX = (node: Person): Person => {
      const newNode = { ...node };
      if (newNode.children && newNode.children.length > 0) {
        const sortedChildren = [...newNode.children].sort((a, b) => (a.x || 0) - (b.x || 0));
        newNode.children = sortedChildren.map(sortChildrenByX);
      }
      return newNode;
    };

    const horizontallySortedRoots = rootNodes.map(sortChildrenByX);

    // Node height is now dynamically calculated for layout purposes.
    const getNodeHeight = (node: Person) => calculateNodeHeight(node, {
        includeSkills,
        includeProjects,
        fontSize,
        fontFamily
    });

    const laidOutRoots = horizontallySortedRoots.map(root => layoutTree(root, 0, 50, { 
      nodeWidth: 200, 
      horizontalGap: 50, 
      verticalGap: 100, // Reduced gap for tighter vertical layout
      mode: 'rigid', 
      getNodeHeight: getNodeHeight 
    }));
    
    const { nodes: flatNodes, connections: flatConnections } = flattenTrees(laidOutRoots);

    if (flatNodes.length === 0) {
      return { nodes: [], connections: [], width: 0, height: 0 };
    }
    
    // The `layoutTree` function now handles consistent node heights, so no extra logic is needed here.

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const NODE_WIDTH = 200; // Width of ExportNode
    
    flatNodes.forEach(node => {
      const x = node.x || 0;
      const y = node.y || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + NODE_WIDTH);
      maxY = Math.max(maxY, y + node.height);
    });

    const PADDING = 60;
    const offsetX = -minX + PADDING;
    const offsetY = -minY + PADDING;
    
    const offsetNodes = flatNodes.map(node => ({
      ...node,
      x: (node.x || 0) + offsetX,
      y: (node.y || 0) + offsetY,
    }));
    
    const chartWidth = maxX - minX + PADDING * 2;
    const chartHeight = maxY - minY + PADDING * 2;

    return { nodes: offsetNodes, connections: flatConnections, width: chartWidth, height: chartHeight };
  }, [selectedRootNodeId, chartData, includeSkills, includeProjects, fontSize, fontFamily]);
  
  // Effect to calculate and apply the correct transform to center the preview.
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    // Use a ResizeObserver to react to container size changes, which is more robust
    // than trying to measure on render, which can be subject to timing issues.
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries[0] || !entries[0].contentRect) return;

      const { width: containerWidth, height: containerHeight } = entries[0].contentRect;
      
      if (width > 0 && height > 0 && containerWidth > 0 && containerHeight > 0) {
        const PADDING = 40;
        
        const scale = Math.min(
            (containerWidth - PADDING) / width, 
            (containerHeight - PADDING) / height,
            1
        );
        
        const effectiveScale = scale > 0 ? scale : 1;

        const scaledWidth = width * effectiveScale;
        const scaledHeight = height * effectiveScale;

        const translateX = (containerWidth - scaledWidth) / 2;
        const translateY = (containerHeight - scaledHeight) / 2;
        
        setPreviewTransform(`translate(${translateX}px, ${translateY}px) scale(${effectiveScale})`);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [width, height]);


  const handleExport = async () => {
    const renderElement = renderTargetRef.current;
    if (!renderElement) return;
    setIsExporting(true);

    const clone = renderElement.cloneNode(true) as HTMLElement;
    
    clone.style.transform = '';
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0px';
    document.body.appendChild(clone);
    
    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: isTransparent 
            ? null 
            : (exportTheme === 'dark' ? '#0f172a' : '#f1f5f9'),
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      const fileName = `${chartName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'org_chart'}.png`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onClose();
    } catch (error) {
      console.error("Failed to export chart:", error);
      alert("Sorry, there was an issue exporting the chart.");
    } finally {
      document.body.removeChild(clone);
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;
  
  const backgroundClass = isTransparent
    ? 'bg-transparent'
    : exportTheme === 'dark' ? 'bg-slate-900' : 'bg-slate-100';

  const themeClass = exportTheme === 'dark' ? 'dark' : '';

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 nodrag p-8" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full h-full max-w-7xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Export Chart</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-grow overflow-hidden">
          {/* Controls */}
          <div className="w-80 p-6 border-r border-slate-200 dark:border-slate-700 flex-shrink-0 flex flex-col gap-6 overflow-y-auto">
            <div className="flex flex-col">
              <label htmlFor="export-root-search" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Branch to Export
              </label>
              <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="export-root-search"
                    type="search"
                    placeholder="Search for a person..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
              </div>
              <div className="w-full h-48 mt-2 border border-slate-300 dark:border-slate-600 rounded-md overflow-y-auto p-2 space-y-1">
                  <button
                      onClick={() => setSelectedRootNodeId('all')}
                      className={`w-full text-left p-2 rounded-md text-sm font-semibold transition-colors ${selectedRootNodeId === 'all' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  >
                      Entire Chart
                  </button>
                  {filteredHierarchicalNodes.map(rootNode => (
                      <SelectableNode 
                          key={rootNode.id} 
                          node={rootNode} 
                          selectedId={selectedRootNodeId} 
                          onSelect={setSelectedRootNodeId} 
                      />
                  ))}
                  {filteredHierarchicalNodes.length === 0 && branchSearch && (
                      <p className="text-center text-sm text-slate-500 dark:text-slate-400 p-4">No results found.</p>
                  )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Content Options</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeProjects}
                    onChange={(e) => setIncludeProjects(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Include Projects</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSkills}
                    onChange={(e) => setIncludeSkills(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Include Skills</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTransparent}
                    onChange={(e) => setIsTransparent(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Transparent Background</span>
                </label>
              </div>
            </div>
             
             <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Font Style</h3>
                <div className="flex gap-2">
                    {(['font-sans', 'font-serif', 'font-mono'] as FontFamily[]).map(font => (
                        <label key={font} className={`flex-1 text-center text-sm py-2 px-3 rounded-md cursor-pointer border-2 transition-colors capitalize ${fontFamily === font ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500' : 'border-transparent bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}>
                            <input type="radio" name="font-family" value={font} checked={fontFamily === font} onChange={() => setFontFamily(font)} className="sr-only" />
                            {font.replace('font-', '')}
                        </label>
                    ))}
                </div>
            </div>

            <div>
              <label htmlFor="font-size-slider" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex justify-between items-center">
                <span>Font Size</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700">{fontSize}px</span>
              </label>
              <input
                id="font-size-slider"
                type="range"
                min="8"
                max="20"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Theme</h3>
                <div className="flex gap-2">
                    <label className={`flex-1 text-center text-sm py-2 px-3 rounded-md cursor-pointer border-2 transition-colors ${exportTheme === 'light' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500' : 'border-transparent bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}>
                        <input type="radio" name="theme" value="light" checked={exportTheme === 'light'} onChange={() => setExportTheme('light')} className="sr-only" />
                        Light
                    </label>
                    <label className={`flex-1 text-center text-sm py-2 px-3 rounded-md cursor-pointer border-2 transition-colors ${exportTheme === 'dark' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500' : 'border-transparent bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}>
                        <input type="radio" name="theme" value="dark" checked={exportTheme === 'dark'} onChange={() => setExportTheme('dark')} className="sr-only" />
                        Dark
                    </label>
                </div>
            </div>
          </div>
          
          {/* Preview */}
          <div className="flex-grow flex flex-col p-6 bg-slate-100 dark:bg-slate-900/70 overflow-hidden">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex-shrink-0">Live Preview</h3>
            <div 
                ref={previewContainerRef}
                className="flex-grow min-h-0 w-full h-full relative overflow-hidden"
            >
                <div 
                  ref={renderTargetRef}
                  className={`absolute shadow-lg ${fontFamily} ${backgroundClass} ${themeClass}`}
                  style={{
                      width, 
                      height,
                      transform: previewTransform,
                      transformOrigin: 'top left',
                  }}
                >
                    <Connectors nodes={nodes} connections={connections} connectorType="elbow" />
                    {nodes.map(person => (
                        <ExportNode key={person.id} person={person} includeSkills={includeSkills} includeProjects={includeProjects} fontSize={fontSize} />
                    ))}
                </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 gap-3">
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
                Cancel
            </button>
            <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center gap-2"
            >
                {isExporting ? <SpinnerIcon className="w-5 h-5" /> : <DownloadIcon className="w-5 h-5" />}
                {isExporting ? 'Exporting...' : 'Download PNG'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
