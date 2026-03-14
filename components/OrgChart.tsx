import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Person } from '../types';
import Node from './Node';
import Connectors from './Connectors';
import { flattenTrees, getDescendantIds } from '../utils/treeUtils';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { SearchIcon } from './icons/SearchIcon';
import { TrashIcon } from './icons/TrashIcon';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import EditableText from './EditableText';
import { SpinnerIcon } from './icons/SpinnerIcon';
import Minimap from './Minimap';
import { MapPinIcon } from './icons/MapPinIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import SearchResultsList, { SearchResultItem } from './SearchResultsList';
import { useDebounce } from '../hooks/useDebounce';
import { GoogleGenAI, Type } from '@google/genai';
import { SparklesIcon } from './icons/SparklesIcon';
import ExportModal from './ExportModal';
import { UserRole } from '../App';
import { BuildingIcon } from './icons/BuildingIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';


interface OrgChartProps {
  data: Person[];
  chartName: string;
  userRole: UserRole;
  onChartNameChange: (newName: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<Omit<Person, 'id' | 'children'>>) => void;
  onAddChild: (parentId: string, type?: 'person' | 'division') => void;
  onAddSkill: (nodeId: string, skill: string) => void;
  onRemoveSkill: (nodeId: string, skillToRemove: string) => void;
  onAddProject: (nodeId: string, project: string) => void;
  onRemoveProject: (nodeId: string, projectToRemove: string) => void;
  onMoveNode: (draggedId: string, targetId: string) => void;
  onNodeDragEnd: (nodeId: string, delta: { dx: number, dy: number }) => void;
  onRemoveNodes: (nodeIds: string[]) => void;
  onAddFloatingNode: (coords: { x: number, y: number }, type?: 'person' | 'division') => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const OrgChart: React.FC<OrgChartProps> = ({
  data,
  chartName,
  userRole,
  onChartNameChange,
  onUpdateNode,
  onAddChild,
  onAddSkill,
  onRemoveSkill,
  onAddProject,
  onRemoveProject,
  onMoveNode,
  onNodeDragEnd,
  onRemoveNodes,
  onAddFloatingNode,
  undo,
  redo,
  canUndo,
  canRedo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [isAiSearchActive, setIsAiSearchActive] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRankedResults, setAiRankedResults] = useState<{ [key: string]: string[] } | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [initialExportNodeId, setInitialExportNodeId] = useState<string | null>(null);
  const initialZoomDone = useRef(false);
  type NodePickerState = { screenX: number; screenY: number; canvasX: number; canvasY: number };
  const [nodePicker, setNodePicker] = useState<NodePickerState | null>(null);

  const canEditContent = userRole !== 'viewer';
  const canEditStructure = userRole === 'admin';


  // State for minimap
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);
  const [viewTransform, setViewTransform] = useState({ positionX: 0, positionY: 0, scale: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const { nodes: originalNodes, connections } = useMemo(() => flattenTrees(data), [data]);
  const parentMap = useMemo(() => new Map(connections.map(c => [c.to, c.from])), [connections]);

  const { width, height, nodes } = useMemo(() => {
    if (originalNodes.length === 0) {
      return { width: 0, height: 0, nodes: [] };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const NODE_WIDTH = 256;
    const NODE_HEIGHT = 220; // An approximation of node height including buttons
    const PADDING = 100;

    originalNodes.forEach(node => {
      const x = node.x || 0;
      const y = node.y || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + NODE_WIDTH);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    });

    const offsetX = -minX + PADDING;
    const offsetY = -minY + PADDING;

    const offsetNodes = originalNodes.map(node => ({
      ...node,
      x: (node.x || 0) + offsetX,
      y: (node.y || 0) + offsetY,
    }));

    return {
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 2,
      nodes: offsetNodes,
    };
  }, [originalNodes]);

  // Effect to perform initial zoom-to-fit
  useEffect(() => {
    if (initialZoomDone.current || nodes.length === 0 || width === 0 || height === 0) {
      return;
    }

    const { current: transformComponent } = transformRef;
    if (!transformComponent || !transformComponent.instance.wrapperComponent) {
      return;
    }

    const { setTransform } = transformComponent;
    const wrapper = transformComponent.instance.wrapperComponent;
    const containerWidth = wrapper.clientWidth;
    const containerHeight = wrapper.clientHeight;
    
    if (containerWidth <= 0 || containerHeight <= 0) {
      return;
    }

    const PADDING = 100;
    const scaleX = containerWidth / (width + PADDING);
    const scaleY = containerHeight / (height + PADDING);
    const newScale = Math.min(scaleX, scaleY, 1.5);

    const newPositionX = (containerWidth - width * newScale) / 2;
    const newPositionY = (containerHeight - height * newScale) / 2;
    
    setTimeout(() => {
      setTransform(newPositionX, newPositionY, newScale, 100, 'easeOut');
      initialZoomDone.current = true;
    }, 100);
    
  }, [nodes, width, height]);
  
  // Effect to measure the viewport size for the minimap
  useEffect(() => {
    const currentWrapper = wrapperRef.current;
    if (!currentWrapper) return;

    const resizeObserver = new ResizeObserver(() => {
        if (currentWrapper) {
            setViewportSize({
                width: currentWrapper.clientWidth,
                height: currentWrapper.clientHeight,
            });
        }
    });
    resizeObserver.observe(currentWrapper);
    
    return () => resizeObserver.disconnect();
  }, []);

  const runAiSearch = React.useCallback(async (query: string) => {
    setIsAiLoading(true);
    setAiRankedResults(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const employeeData = originalNodes
            .filter(n => !n.type || n.type === 'person')
            .map(({ id, name, title, skills, projects, team }) => ({
                id,
                name,
                title,
                team: team || 'N/A',
                skills: skills || [],
                projects: projects || [],
            }));

        const systemInstruction = `You are an expert HR assistant. Your task is to find the best-suited person from a provided JSON list of employees based on a user's natural language request. Analyze the user's query and the employee data (skills, projects, title, team).

**Crucially, you must understand the user's intent.**
- If the query is **task-oriented** (e.g., "who can build...", "I need someone to design...", "find a person with experience in..."), you MUST prioritize hands-on skills and relevant project experience. A person with the specific skill (e.g., 'Illustrator') is a much better match than a manager (e.g., 'Design Director') who may not have recent, direct experience.
- If the query is **leadership-oriented** (e.g., "who leads the design team?", "find a manager for..."), then you should prioritize job titles that indicate leadership ('Director', 'Manager', 'Lead').

For your response, you MUST return a JSON object with one or more of the following keys: "bestMatches", "likelyMatches", "possibleMatches". Each key must have a value of a JSON array of employee "id" strings, ordered from most to least relevant within that category.
- "bestMatches": Employees who are a very strong fit, matching multiple key criteria based on the user's intent.
- "likelyMatches": Good candidates who may miss a criterion but are still relevant.
- "possibleMatches": More speculative fits.
If a category has no matches, omit the key or provide an empty array. If no one is a good fit, return an empty JSON object.`;
        
        const contents = `User Query: "${query}"\n\nEmployee Data: ${JSON.stringify(employeeData)}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        bestMatches: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: 'IDs of employees who are an excellent fit.'
                        },
                        likelyMatches: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: 'IDs of employees who are a good fit.'
                        },
                        possibleMatches: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: 'IDs of employees who might be a potential fit.'
                        }
                    },
                },
            },
        });
        
        const resultText = response.text.trim();
        const rankedResults = JSON.parse(resultText) as { [key: string]: string[] };
        setAiRankedResults(rankedResults);

    } catch (error) {
        console.error("AI Search failed:", error);
        setAiRankedResults({});
    } finally {
        setIsAiLoading(false);
    }
  }, [originalNodes]);

  useEffect(() => {
    if (isAiSearchActive && debouncedSearchQuery.length > 2) {
        runAiSearch(debouncedSearchQuery);
    } else if (!isAiSearchActive) {
        setAiRankedResults(null);
    }
  }, [isAiSearchActive, debouncedSearchQuery, runAiSearch]);

  const handleToggleAiSearch = () => {
    // Clear search query whenever the mode is switched.
    setSearchQuery('');
    setIsAiSearchActive(prevIsAiActive => !prevIsAiActive);
  };

  const textSearchResults = useMemo(() => {
    if (!searchQuery || isAiSearchActive) return { all: [], nameMatches: [] };
    
    const lowerCaseQuery = searchQuery.toLowerCase();
    const allIds = new Set<string>();
    const nameMatchIds = new Set<string>();
    const nodeMapWithChildren = new Map<string, Person>(originalNodes.map(n => [n.id, n]));

    nodes.forEach(node => {
        let isMatch = false;
        const isNameMatch = node.name.toLowerCase().includes(lowerCaseQuery);

        switch (searchFilter) {
            case 'name':
                isMatch = isNameMatch;
                break;
            case 'title':
                isMatch = node.title.toLowerCase().includes(lowerCaseQuery);
                break;
            case 'team':
                isMatch = node.team ? node.team.toLowerCase().includes(lowerCaseQuery) : false;
                break;
            case 'skills':
                isMatch = node.skills ? node.skills.some(s => s.toLowerCase().includes(lowerCaseQuery)) : false;
                break;
            case 'projects':
                isMatch = node.projects ? node.projects.some(p => p.toLowerCase().includes(lowerCaseQuery)) : false;
                break;
            default: // 'all'
                isMatch = isNameMatch ||
                    node.title.toLowerCase().includes(lowerCaseQuery) ||
                    (node.team ? node.team.toLowerCase().includes(lowerCaseQuery) : false) ||
                    (node.skills ? node.skills.some(s => s.toLowerCase().includes(lowerCaseQuery)) : false) ||
                    (node.projects ? node.projects.some(p => p.toLowerCase().includes(lowerCaseQuery)) : false) ||
                    (node.notes ? node.notes.toLowerCase().includes(lowerCaseQuery) : false);
                break;
        }

        if (isMatch) {
            allIds.add(node.id);
            if (isNameMatch && (searchFilter === 'all' || 'name')) {
                nameMatchIds.add(node.id);
                const fullNode = nodeMapWithChildren.get(node.id);
                if (fullNode) {
                    const descendantIds = getDescendantIds(fullNode);
                    descendantIds.forEach(id => allIds.add(id));
                }
            }
        }
    });

    return {
        all: Array.from(allIds),
        nameMatches: Array.from(nameMatchIds)
    };
  }, [searchQuery, searchFilter, nodes, originalNodes, isAiSearchActive]);

    const textSearchResultNodes = useMemo(() => {
        if (!searchQuery || isAiSearchActive) return [];
        
        const resultMap = new Map(nodes.map(n => [n.id, n]));
        
        return textSearchResults.all
            .map(id => resultMap.get(id))
            .filter((p): p is (Person & { x: number; y: number; height: number; propagatedColor?: string; }) => !!p)
            .sort((a, b) => a.y - b.y || a.x - b.x);

    }, [searchQuery, isAiSearchActive, textSearchResults.all, nodes]);

    const processedTextSearchResults = useMemo((): SearchResultItem[] => {
        if (isAiSearchActive || !searchQuery || textSearchResultNodes.length === 0) return [];

        type HierarchyNode = (typeof textSearchResultNodes)[0] & { childrenInResults: HierarchyNode[] };

        const resultNodeMap = new Map<string, HierarchyNode>(
            textSearchResultNodes.map(n => [n.id, { ...n, childrenInResults: [] }])
        );
        const resultNodeIds = new Set(textSearchResultNodes.map(n => n.id));

        const findClosestAncestorInResults = (startNodeId: string): string | null => {
            let currentId = startNodeId;
            while (parentMap.has(currentId)) {
                const parentId = parentMap.get(currentId)!;
                if (resultNodeIds.has(parentId)) {
                    return parentId;
                }
                currentId = parentId;
            }
            return null;
        };
        
        const roots: HierarchyNode[] = [];

        for (const node of textSearchResultNodes) {
            const nodeInMap = resultNodeMap.get(node.id)!;
            const closestAncestorId = findClosestAncestorInResults(node.id);
            
            if (closestAncestorId) {
                const ancestorNode = resultNodeMap.get(closestAncestorId);
                if (ancestorNode) {
                    ancestorNode.childrenInResults.push(nodeInMap);
                }
            } else {
                roots.push(nodeInMap);
            }
        }
        
        roots.sort((a, b) => {
            if (a.y < b.y) return -1;
            if (a.y > b.y) return 1;
            return a.x - b.x;
        });

        const finalOrderedList: SearchResultItem[] = [];
        const flatten = (node: HierarchyNode, depth: number) => {
            finalOrderedList.push({ ...node, depth });
            node.childrenInResults.sort((a,b) => a.y - b.y || a.x - b.x);
            for (const child of node.childrenInResults) {
                flatten(child, depth + 1);
            }
        };

        roots.forEach(root => flatten(root, 0));

        return finalOrderedList;

    }, [searchQuery, textSearchResultNodes, parentMap, isAiSearchActive]);

    const aiSearchResultItems = useMemo(() => {
        if (!isAiSearchActive || !aiRankedResults) return null;
        const resultMap = new Map(nodes.map(n => [n.id, n]));
        const categorizedResults: { [key: string]: SearchResultItem[] } = {};

        const categories = ['bestMatches', 'likelyMatches', 'possibleMatches'];

        for (const category of categories) {
            if (aiRankedResults[category] && aiRankedResults[category].length > 0) {
                categorizedResults[category] = aiRankedResults[category]
                    .map(id => resultMap.get(id))
                    .filter((p): p is Person & { x: number; y: number; height: number; propagatedColor?: string; } => !!p)
                    .map(p => ({ ...p, depth: 0 }));
            }
        }
        return categorizedResults;
    }, [isAiSearchActive, aiRankedResults, nodes]);


    const handleResultClick = (person: SearchResultItem) => {
        const { current: transformComponent } = transformRef;
        if (!transformComponent || !transformComponent.instance.wrapperComponent) return;
    
        const { setTransform } = transformComponent;
        const NODE_WIDTH = 256;
        const NODE_HEIGHT = 220;
    
        const wrapper = transformComponent.instance.wrapperComponent;
        const containerWidth = wrapper.clientWidth;
        const containerHeight = wrapper.clientHeight;
        
        const newScale = 1.2;
    
        const newPositionX = (containerWidth / 2) - ((person.x + NODE_WIDTH / 2) * newScale);
        const newPositionY = (containerHeight / 2) - ((person.y + NODE_HEIGHT / 2) * newScale);
    
        setTransform(newPositionX, newPositionY, newScale, 400, 'easeOut');
        
        setFocusedNodeId(person.id);
        setTimeout(() => setFocusedNodeId(null), 2000);
    };

  const textNodesToFrame = useMemo(() => {
    if (!searchQuery || isAiSearchActive) return [];
    
    const lowerCaseQuery = searchQuery.toLowerCase();
    const idsToFrame = new Set<string>();
    const nodeMapWithChildren = new Map<string, Person>(originalNodes.map(n => [n.id, n]));

    nodes.forEach(node => {
        let isMatch = false;
        const isNameMatch = node.name.toLowerCase().includes(lowerCaseQuery);

        switch (searchFilter) {
            case 'name':
                isMatch = isNameMatch;
                break;
            case 'title':
                isMatch = node.title.toLowerCase().includes(lowerCaseQuery);
                break;
            case 'team':
                isMatch = node.team ? node.team.toLowerCase().includes(lowerCaseQuery) : false;
                break;
            case 'skills':
                isMatch = node.skills ? node.skills.some(s => s.toLowerCase().includes(lowerCaseQuery)) : false;
                break;
            case 'projects':
                isMatch = node.projects ? node.projects.some(p => p.toLowerCase().includes(lowerCaseQuery)) : false;
                break;
            default: // 'all'
                isMatch = isNameMatch ||
                    node.title.toLowerCase().includes(lowerCaseQuery) ||
                    (node.team ? node.team.toLowerCase().includes(lowerCaseQuery) : false) ||
                    (node.skills ? node.skills.some(s => s.toLowerCase().includes(lowerCaseQuery)) : false) ||
                    (node.projects ? node.projects.some(p => p.toLowerCase().includes(lowerCaseQuery)) : false);
                break;
        }
        
        if (isMatch) {
            idsToFrame.add(node.id);
        }
        
        if (isNameMatch && (searchFilter === 'all' || searchFilter === 'name')) {
            const fullNode = nodeMapWithChildren.get(node.id);
            if (fullNode && fullNode.children) {
                fullNode.children.forEach(child => idsToFrame.add(child.id));
            }
        }
    });

    return nodes.filter(n => idsToFrame.has(n.id));
  }, [searchQuery, searchFilter, nodes, originalNodes, isAiSearchActive]);
  
  const aiNodesToFrame = useMemo(() => {
    if (!aiRankedResults) return [];
    
    // Prioritize "Best Matches", then "Likely", then "Possible" for framing.
    const idsToFrame = 
        (aiRankedResults.bestMatches && aiRankedResults.bestMatches.length > 0) ? aiRankedResults.bestMatches :
        (aiRankedResults.likelyMatches && aiRankedResults.likelyMatches.length > 0) ? aiRankedResults.likelyMatches :
        (aiRankedResults.possibleMatches && aiRankedResults.possibleMatches.length > 0) ? aiRankedResults.possibleMatches :
        [];

    if (idsToFrame.length === 0) return [];

    const idSet = new Set(idsToFrame);
    return nodes.filter(n => idSet.has(n.id));
  }, [aiRankedResults, nodes]);
  
    useEffect(() => {
        const { current: transformComponent } = transformRef;
        if (!transformComponent || !transformComponent.instance.wrapperComponent) return;

        const { setTransform } = transformComponent;
        
        const isTextSearchActive = searchQuery.length > 0 && !isAiSearchActive;
        const isAiSearchActiveAndComplete = isAiSearchActive && !isAiLoading && aiNodesToFrame.length > 0;

        let nodesForBounds;

        if (isTextSearchActive) {
            nodesForBounds = textNodesToFrame;
        } else if (isAiSearchActiveAndComplete) {
            nodesForBounds = aiNodesToFrame;
        } else {
            return;
        }
        
        if (nodesForBounds.length === 0) {
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const PADDING = 100;
        const NODE_WIDTH = 256;
        const NODE_HEIGHT = 220;

        nodesForBounds.forEach(node => {
            minX = Math.min(minX, node.x || 0);
            minY = Math.min(minY, node.y || 0);
            maxX = Math.max(maxX, (node.x || 0) + NODE_WIDTH);
            maxY = Math.max(maxY, (node.y || 0) + NODE_HEIGHT);
        });

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;

        const wrapper = transformComponent.instance.wrapperComponent;
        const containerWidth = wrapper.clientWidth;
        const containerHeight = wrapper.clientHeight;

        const scaleX = containerWidth / (boundsWidth + PADDING);
        const scaleY = containerHeight / (boundsHeight + PADDING);
        const newScale = Math.min(scaleX, scaleY, 1.5);

        const newPositionX = (containerWidth / 2) - ((minX + boundsWidth / 2) * newScale);
        const newPositionY = (containerHeight / 2) - ((minY + boundsHeight / 2) * newScale);

        setTransform(newPositionX, newPositionY, newScale, 300, 'easeOut');

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, searchFilter, isAiSearchActive, isAiLoading, aiNodesToFrame, textNodesToFrame]);

  const handleMinimapPan = (targetChartX: number, targetChartY: number) => {
    const { current: transformComponent } = transformRef;
    if (!transformComponent || !viewportSize.width) return;

    const { scale } = viewTransform;

    const newPositionX = (viewportSize.width / 2) - (targetChartX * scale);
    const newPositionY = (viewportSize.height / 2) - (targetChartY * scale);
    
    transformComponent.setTransform(newPositionX, newPositionY, scale, 300, 'easeOut');
  };

  const handleToggleSelection = (nodeId: string) => {
    setSelectedNodeIds(prev =>
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };
  
  const handleDeleteSelected = () => {
    onRemoveNodes(selectedNodeIds);
    setSelectedNodeIds([]);
  }

  const handleRemoveSingleNode = (nodeId: string) => {
    if (confirm("Are you sure you want to delete this member?")) {
      onRemoveNodes([nodeId]);
    }
  };

  const getHighlightStatus = (node: Person): 'normal' | 'highlight' | 'descendant' | 'faded' | 'child-of-selected' => {
      if (node.id === focusedNodeId) {
        return 'highlight';
      }

      if (selectedNodeIds.length > 0) {
        if (selectedNodeIds.includes(node.id)) return 'normal';
        const parentId = parentMap.get(node.id);
        if (parentId && selectedNodeIds.includes(parentId)) {
            return 'child-of-selected';
        }
        return 'faded';
      }

      if (searchQuery) {
          if(isAiSearchActive) {
              const allAiIds = Object.values(aiRankedResults || {}).flat();
              return allAiIds.includes(node.id) ? 'normal' : 'faded';
          }

          const isSearchResult = textSearchResults.all.includes(node.id);
          if (!isSearchResult) {
              return 'faded';
          }
          if (textSearchResults.nameMatches.includes(node.id)) {
              return 'highlight';
          }
          return 'descendant';
      }

      if (hoveredNodeId) {
          if (node.id === hoveredNodeId) return 'highlight';
          
          const activeNode = nodes.find(n => n.id === hoveredNodeId);
          if (activeNode) {
              const descendantIds = getDescendantIds(activeNode);
              if (descendantIds.includes(node.id)) {
                  return 'descendant';
              }
          }
          return 'faded';
      }
      
      return 'normal';
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!canEditStructure) return;
    if ((e.target as HTMLElement).closest('.group, .nodrag, .nodrag-area')) return;

    const { current: transformComponent } = transformRef;
    if (!transformComponent || !transformComponent.instance.wrapperComponent) return;

    const { scale, positionX, positionY } = transformComponent.state;
    const rect = transformComponent.instance.wrapperComponent.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasX = (screenX - positionX) / scale;
    const canvasY = (screenY - positionY) / scale;

    setNodePicker({ screenX, screenY, canvasX, canvasY });
  };
  
  const handleOpenExportModal = () => {
    let topResultId: string | null = null;
    if (searchQuery) {
        if (isAiSearchActive && aiSearchResultItems) {
            const bestMatch = aiSearchResultItems.bestMatches && aiSearchResultItems.bestMatches[0];
            const likelyMatch = aiSearchResultItems.likelyMatches && aiSearchResultItems.likelyMatches[0];
            const possibleMatch = aiSearchResultItems.possibleMatches && aiSearchResultItems.possibleMatches[0];
            topResultId = bestMatch?.id || likelyMatch?.id || possibleMatch?.id || null;
        } else if (!isAiSearchActive && processedTextSearchResults.length > 0) {
            topResultId = processedTextSearchResults[0].id;
        }
    }
    setInitialExportNodeId(topResultId);
    setIsExportModalOpen(true);
  };


  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden bg-slate-100 dark:bg-slate-900">
        {isExportModalOpen && (
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => {
                    setIsExportModalOpen(false);
                    setInitialExportNodeId(null);
                }}
                chartData={data}
                chartName={chartName}
                initialSelectedNodeId={initialExportNodeId}
            />
        )}


        {searchQuery && (
            <div className={`absolute left-4 z-10 transition-all duration-300 ease-in-out ${isAiSearchActive ? 'top-60' : 'top-48'}`}>
                <SearchResultsList 
                    results={processedTextSearchResults}
                    aiResults={aiSearchResultItems}
                    onResultClick={handleResultClick}
                    isAiSearchActive={isAiSearchActive}
                    isLoading={isAiLoading}
                />
            </div>
        )}

        <TransformWrapper
            ref={transformRef}
            minScale={0.1}
            maxScale={2}
            initialScale={1}
            limitToBounds={false}
            panning={{ excluded: ['nodrag', 'nodrag-area'] }}
            wheel={{ step: 0.1 }}
            doubleClick={{ disabled: true }}
            onTransformed={(ref, state) => setViewTransform(state)}
        >
            {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                    <div className="absolute top-4 left-4 flex flex-col gap-4 z-10">
                        <div className="w-64 px-1 nodrag-area">
                           <EditableText
                                initialValue={chartName}
                                onSave={onChartNameChange}
                                textClasses="text-2xl font-bold text-slate-800 dark:text-slate-100 truncate"
                                inputClasses="w-full text-2xl font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none focus:ring-0"
                                isReadOnly={!canEditContent}
                            />
                        </div>
                        <div className="relative w-72 nodrag-area">
                             {isAiSearchActive ? (
                                <textarea
                                    placeholder="Ask AI to find someone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    rows={3}
                                    className="w-full pl-10 pr-12 py-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none nodrag"
                                />
                            ) : (
                                <input 
                                    type="text"
                                    placeholder={`Search by ${searchFilter}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-28 py-2 rounded-full bg-white dark:bg-slate-800 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag"
                                />
                            )}
                            {isAiLoading ? (
                                <SpinnerIcon className={`absolute left-3.5 w-5 h-5 transition-all duration-300 ${isAiSearchActive ? 'top-3' : 'top-1/2 -translate-y-1/2'}`} />
                            ) : (
                                <SearchIcon className={`absolute left-3 w-5 h-5 text-slate-400 transition-all duration-300 ${isAiSearchActive ? 'top-3' : 'top-1/2 -translate-y-1/2'}`} />
                            )}
                            <div className={`absolute right-2 flex transition-all duration-300 ${isAiSearchActive ? 'top-2 items-start' : 'inset-y-0 items-center'}`}>
                                {!isAiSearchActive && (
                                    <div className="relative">
                                        <select
                                            value={searchFilter}
                                            onChange={(e) => setSearchFilter(e.target.value)}
                                            className="h-full rounded-full border-transparent bg-transparent py-0 pl-2 pr-7 text-slate-500 dark:text-slate-400 focus:ring-0 focus:border-transparent text-sm capitalize appearance-none cursor-pointer"
                                            aria-label="Search filter"
                                        >
                                            <option value="all">All</option>
                                            <option value="name">Name</option>
                                            <option value="title">Title</option>
                                            <option value="team">Team</option>
                                            <option value="skills">Skills</option>
                                            <option value="projects">Projects</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-1 pointer-events-none" />
                                    </div>
                                )}
                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1.5"></div>
                                <button
                                    onClick={handleToggleAiSearch}
                                    className={`p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${isAiSearchActive ? 'text-indigo-500 bg-indigo-100 dark:bg-indigo-500/20' : 'text-slate-400'}`}
                                    title="Toggle AI Search"
                                >
                                    <SparklesIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        {selectedNodeIds.length > 0 && canEditStructure && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 shadow-md nodrag">
                            <span className="text-sm font-semibold">{selectedNodeIds.length} selected</span>
                            <button
                                onClick={handleDeleteSelected}
                                className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-red-500 dark:text-red-400"
                                title="Delete selected"
                            >
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                            <button
                                onClick={() => setSelectedNodeIds([])}
                                className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Deselect all"
                            >
                                <span className="text-sm font-medium">Clear</span>
                            </button>
                        </div>
                        )}
                    </div>

                    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
                        {isMinimapOpen && nodes.length > 0 && (
                            <Minimap
                                nodes={nodes}
                                chartWidth={width as number}
                                chartHeight={height as number}
                                viewTransform={viewTransform}
                                viewportSize={viewportSize}
                                onPan={handleMinimapPan}
                            />
                        )}
                        <div className="flex items-center bg-white dark:bg-slate-800 shadow-lg rounded-full">
                            <button onClick={() => setIsMinimapOpen(v => !v)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-l-full nodrag" title={isMinimapOpen ? 'Hide Minimap' : 'Show Minimap'}>
                               <MapPinIcon className={`w-5 h-5 transition-colors ${isMinimapOpen ? 'text-indigo-500' : ''}`} />
                            </button>
                            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700"></div>
                            <button onClick={() => zoomIn()} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 nodrag"><ZoomInIcon className="w-5 h-5" /></button>
                            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700"></div>
                            <button onClick={() => zoomOut()} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-r-full nodrag"><ZoomOutIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                    
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white dark:bg-slate-800 shadow-lg rounded-full p-1 z-10">
                        <button onClick={undo} disabled={!canUndo || !canEditContent} className="p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 nodrag"><UndoIcon className="w-5 h-5" /></button>
                        <button onClick={redo} disabled={!canRedo || !canEditContent} className="p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 nodrag"><RedoIcon className="w-5 h-5" /></button>
                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <button onClick={handleOpenExportModal} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 nodrag" title="Download as PNG">
                          <DownloadIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {nodePicker && (
                        <div
                            className="absolute z-30 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 flex gap-1 nodrag-area"
                            style={{ left: nodePicker.screenX, top: nodePicker.screenY }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => { onAddFloatingNode({ x: nodePicker.canvasX, y: nodePicker.canvasY }, 'person'); setNodePicker(null); }}
                                className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                <UserPlusIcon className="w-5 h-5 text-indigo-500" />
                                Person
                            </button>
                            <button
                                onClick={() => { onAddFloatingNode({ x: nodePicker.canvasX, y: nodePicker.canvasY }, 'division'); setNodePicker(null); }}
                                className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                <BuildingIcon className="w-5 h-5 text-violet-500" />
                                Division
                            </button>
                        </div>
                    )}

                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: width || '100%', height: height || '100%' }}>
                        <div 
                            ref={chartRef} 
                            className="relative"
                            style={{ width, height }}
                            onClick={() => { setSelectedNodeIds([]); setNodePicker(null); }}
                            onDoubleClick={handleDoubleClick}
                        >
                            <Connectors nodes={nodes} connections={connections} />
                            {nodes.map(person => (
                                <Node
                                    key={person.id}
                                    person={person}
                                    isSelected={selectedNodeIds.includes(person.id)}
                                    highlightStatus={getHighlightStatus(person)}
                                    canEditContent={canEditContent}
                                    canEditStructure={canEditStructure}
                                    onUpdate={onUpdateNode}
                                    onAddChild={onAddChild}
                                    onAddSkill={onAddSkill}
                                    onRemoveSkill={onRemoveSkill}
                                    onAddProject={onAddProject}
                                    onRemoveProject={onRemoveProject}
                                    onMoveNode={onMoveNode}
                                    onNodeDragEnd={onNodeDragEnd}
                                    onToggleSelection={handleToggleSelection}
                                    onRemove={handleRemoveSingleNode}
                                    onMouseEnter={() => setHoveredNodeId(person.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                />
                            ))}
                        </div>
                    </TransformComponent>
                </>
            )}
        </TransformWrapper>
    </div>
  );
};

export default OrgChart;