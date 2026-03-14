import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Person } from './types';
import { useHistoryState } from './hooks/useHistoryState';
import { layoutTree } from './utils/treeUtils';
import OrgChart from './components/OrgChart';
import { useDarkMode } from './hooks/useDarkMode';
import { SunIcon } from './components/icons/SunIcon';
import { MoonIcon } from './components/icons/MoonIcon';
import { auth, db, User } from './firebase';
import { InformationCircleIcon } from './components/icons/InformationCircleIcon';
import { XIcon } from './components/icons/XIcon';
import Login from './components/Login';
import { LogoutIcon } from './components/icons/LogoutIcon';
import PermissionLozenge from './components/PermissionLozenge';

// --- Permissions ---
// The app now supports a tiered permission system.
export type UserRole = 'admin' | 'contributor' | 'viewer';

// Admins have full edit rights: they can change structure and content.
const ADMINS = [
    'michael.kavalar@mtacd.org',
    'natalie.millstein@mtahq.org',
    'natalie.millstein@mtacd.org',
];

// Contributors can edit the content of nodes (names, skills, etc.) but cannot change the chart structure.
const CONTRIBUTORS: string[] = [
    // 'example.contributor@email.com',
    'eric.wilson@mtacd.org',
    'kiyoshi.yamazaki@mtacd.org',
];


// A minimal fallback chart for new users or if data loading fails.
const fallbackPerson: Person = {
  id: '1',
  name: 'New Org Chart',
  title: 'Edit me!',
  team: 'Team',
  skills: [],
  projects: [],
  children: [],
};

const fallbackData: Person[] = [layoutTree(fallbackPerson)];
// This ID now represents the single, shared, collaborative chart for all users.
const MASTER_CHART_ID = 'zzgWWOjrxUIHhC4FYkRj';
const MASTER_CHART_COLLECTION = 'shared_charts';


const processDataForLoad = (data: any): Person[] => {
    let dataToLoad = data || fallbackData;
    if (!Array.isArray(dataToLoad)) {
        dataToLoad = [dataToLoad];
    }
    if (dataToLoad.length > 0 && (dataToLoad[0].x === undefined || dataToLoad[0].y === undefined)) {
        dataToLoad[0] = layoutTree(dataToLoad[0]);
    }
    return dataToLoad;
}


const App: React.FC = () => {
  const [theme, toggleTheme] = useDarkMode();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('viewer');
  const [isLoading, setIsLoading] = useState(true);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  
  const hasUnsavedChanges = useRef(false);

  const [chartName, setChartName] = useState('My Organization Chart');
  const { state: data, set: setData, undo, redo, canUndo, canRedo, reset } = useHistoryState<Person[]>(fallbackData);
  
  const canEditContent = userRole === 'admin' || userRole === 'contributor';
  
  // Wrapper for setData to flag that local changes exist and need to be saved.
  const setLocalData = useCallback((updater: Person[] | ((current: Person[]) => Person[])) => {
      hasUnsavedChanges.current = true;
      setData(updater);
  }, [setData]);

  // Handles authentication and data loading from Firestore
  useEffect(() => {
    let chartListenerUnsubscribe = () => {};

    const authUnsubscribe = auth.onAuthStateChanged(async (currentUser) => {
        chartListenerUnsubscribe();
        setUser(currentUser);
        
        if (currentUser && currentUser.email) {
            if (ADMINS.includes(currentUser.email)) {
                setUserRole('admin');
            } else if (CONTRIBUTORS.includes(currentUser.email)) {
                setUserRole('contributor');
            } else {
                setUserRole('viewer');
            }
        } else {
            setUserRole('viewer');
        }

        if (!currentUser) {
            setIsLoading(false);
            return;
        }
      
        const chartDocRef = db.collection(MASTER_CHART_COLLECTION).doc(MASTER_CHART_ID);

        chartListenerUnsubscribe = chartDocRef.onSnapshot((docSnap) => {
            if (docSnap.metadata.hasPendingWrites) {
                return;
            }

            if (hasUnsavedChanges.current) {
                return;
            }

            if (docSnap.exists) {
                const chartData = docSnap.data();
                setChartName(chartData?.name || 'My Organization Chart');
                const processedData = processDataForLoad(chartData?.data);
                reset(processedData); 
            } else {
                console.warn(`Master chart '${MASTER_CHART_COLLECTION}/${MASTER_CHART_ID}' not found. Creating it with fallback data.`);
                const chartToCreate = { name: 'My Organization Chart', data: fallbackData };
                chartDocRef.set(chartToCreate);
                setChartName(chartToCreate.name);
                reset(chartToCreate.data);
            }
            if (isLoading) setIsLoading(false);
        }, (error) => {
            console.error("Error listening to chart updates:", error);
            setIsLoading(false);
        });
    });

    return () => {
        authUnsubscribe();
        chartListenerUnsubscribe();
    };
  // We only want this to run once on mount. All dependencies are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounces and saves data to Firestore.
  useEffect(() => {
    if (!canEditContent || !user) {
        return;
    }

    const handler = setTimeout(() => {
        if (hasUnsavedChanges.current) {
            const chartDocRef = db.collection(MASTER_CHART_COLLECTION).doc(MASTER_CHART_ID);
            chartDocRef.set({ name: chartName, data: data }, { merge: true })
                .then(() => {
                    hasUnsavedChanges.current = false;
                })
                .catch(error => {
                    console.error("Error saving chart:", error);
                    alert("Error: Could not save changes to the server. This may be due to a permission issue. Your last change will be reverted.");
                    // Mark as not-dirty *before* undoing to prevent a save loop.
                    hasUnsavedChanges.current = false;
                    // Revert the optimistic UI update.
                    undo();
                });
        }
    }, 500);

    return () => {
        clearTimeout(handler);
    };
  }, [data, chartName, canEditContent, user, undo]);
  
  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifierKey = isMac ? event.metaKey : event.ctrlKey;

        const isUndo = modifierKey && !event.shiftKey && event.key.toLowerCase() === 'z';
        const isRedo = modifierKey && event.shiftKey && event.key.toLowerCase() === 'z';

        if (isUndo && canUndo) {
            event.preventDefault();
            undo();
        } else if (isRedo && canRedo) {
            event.preventDefault();
            redo();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, canUndo, canRedo]);

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<Omit<Person, 'id' | 'children'>>) => {
    if (!canEditContent) return;
    const update = (node: Person): Person => {
        if (node.id === nodeId) return { ...node, ...updates };
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, canEditContent]);
  
  const handleAddFloatingNode = useCallback((coords: { x: number, y: number }) => {
    if (userRole !== 'admin') return;
    
    if (!Number.isFinite(coords.x) || !Number.isFinite(coords.y)) {
      console.error("Attempted to add a node with invalid coordinates:", coords);
      return;
    }

    const newNode: Person = {
        id: Date.now().toString(),
        name: 'New Member',
        title: 'New Role',
        skills: [],
        projects: [],
        children: [],
        team: 'New Team',
        x: coords.x,
        y: coords.y,
    };
    setLocalData([...data, newNode]);
  }, [data, setLocalData, userRole]);

  const handleAddChild = useCallback((parentId: string) => {
    if (userRole !== 'admin') return;
    
    const VERTICAL_GAP = 120;
    const NODE_HEIGHT = 220;

    const update = (node: Person): Person => {
        if (node.id === parentId) {
            const parentX = Number.isFinite(node.x) ? node.x as number : 0;
            const parentY = Number.isFinite(node.y) ? node.y as number : 0;
            const newNode: Person = {
                id: Date.now().toString(),
                name: 'New Member',
                title: 'New Role',
                skills: [],
                projects: [],
                children: [],
                team: node.team,
                x: parentX,
                y: parentY + NODE_HEIGHT + VERTICAL_GAP / 2
            };
            return { ...node, children: [...(node.children || []), newNode] };
        }
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, userRole]);

  const handleRemoveSkill = useCallback((nodeId: string, skillToRemove: string) => {
    if (!canEditContent) return;
    const update = (node: Person): Person => {
        if (node.id === nodeId) return { ...node, skills: node.skills.filter(s => s !== skillToRemove) };
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, canEditContent]);

  const handleAddSkill = useCallback((nodeId: string, skill: string) => {
    if (!canEditContent) return;
    const update = (node: Person): Person => {
        if (node.id === nodeId) return { ...node, skills: [...node.skills, skill] };
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, canEditContent]);
  
  const handleRemoveProject = useCallback((nodeId: string, projectToRemove: string) => {
    if (!canEditContent) return;
    const update = (node: Person): Person => {
        if (node.id === nodeId) return { ...node, projects: (node.projects || []).filter(p => p !== projectToRemove) };
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, canEditContent]);

  const handleAddProject = useCallback((nodeId: string, project: string) => {
    if (!canEditContent) return;
    const update = (node: Person): Person => {
        if (node.id === nodeId) return { ...node, projects: [...(node.projects || []), project] };
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, canEditContent]);


  const handleRemoveNodes = useCallback((nodeIds: string[]) => {
    if (userRole !== 'admin') return;
    const idsToRemove = new Set(nodeIds);

    const removeNodesRecursively = (node: Person): Person | null => {
        if (idsToRemove.has(node.id)) return null;
        const newChildren = (node.children || []).map(child => removeNodesRecursively(child)).filter((child): child is Person => child !== null);
        return { ...node, children: newChildren };
    };
    
    const newData = data
        .map(root => removeNodesRecursively(root))
        .filter((root): root is Person => root !== null);
    
    setLocalData(newData);
  }, [data, setLocalData, userRole]);

  const handleMoveNode = useCallback((draggedId: string, targetId: string) => {
    if (userRole !== 'admin' || draggedId === targetId) return;
    
    let foundDraggedNode: Person | null = null;
    const findAndRemoveRecursive = (p: Person): Person | null => {
        if (p.id === draggedId) {
            foundDraggedNode = p;
            return null;
        }
        return {
            ...p,
            children: (p.children || []).map(findAndRemoveRecursive).filter((c): c is Person => c !== null)
        };
    };
    const dataAfterRemove = data
        .map(findAndRemoveRecursive)
        .filter((p): p is Person => p !== null);
    
    if (!foundDraggedNode) return;

    const addNodeRecursive = (p: Person): Person => {
        if (p.id === targetId) {
            return { ...p, children: [...(p.children || []), foundDraggedNode!] };
        }
        return { ...p, children: (p.children || []).map(addNodeRecursive) };
    };

    const newData = dataAfterRemove.map(addNodeRecursive);
    setLocalData(newData);
  }, [data, setLocalData, userRole]);

  const handleNodeDrag = useCallback((nodeId: string, delta: { dx: number, dy: number }) => {
    if (userRole !== 'admin' || (delta.dx === 0 && delta.dy === 0)) return;

    if (!Number.isFinite(delta.dx) || !Number.isFinite(delta.dy)) {
        console.error("handleNodeDrag received invalid delta:", delta);
        return;
    }

    const updatePositionsRecursively = (node: Person, applyShift: boolean): Person => {
        const shouldShiftThisNode = applyShift || node.id === nodeId;
        
        const currentX = Number.isFinite(node.x) ? node.x as number : 0;
        const currentY = Number.isFinite(node.y) ? node.y as number : 0;

        const newPosition = shouldShiftThisNode
            ? { x: currentX + delta.dx, y: currentY + delta.dy }
            : {};

        return {
            ...node,
            ...newPosition,
            children: (node.children || []).map(child => updatePositionsRecursively(child, shouldShiftThisNode))
        };
    };

    setLocalData(data.map(root => updatePositionsRecursively(root, false)));
  }, [data, setLocalData, userRole]);
  
  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out?")) {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Error signing out:", error);
            alert("An error occurred during sign-out. Please try again.");
        }
    }
  };


  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="font-sans text-slate-600 dark:text-slate-400 w-screen h-screen overflow-hidden">
      <OrgChart
        data={data}
        chartName={chartName}
        userRole={userRole}
        onChartNameChange={setChartName}
        onUpdateNode={handleUpdateNode}
        onAddChild={handleAddChild}
        onAddSkill={handleAddSkill}
        onRemoveSkill={handleRemoveSkill}
        onAddProject={handleAddProject}
        onRemoveProject={handleRemoveProject}
        onMoveNode={handleMoveNode}
        onNodeDragEnd={handleNodeDrag}
        onRemoveNodes={handleRemoveNodes}
        onAddFloatingNode={handleAddFloatingNode}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      {isInfoModalOpen && (
        <div onClick={() => setIsInfoModalOpen(false)} className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md relative">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">About this Application</h2>
                    <button onClick={() => setIsInfoModalOpen(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    This interactive org chart was developed by Michael Kavalar (2025). For any suggestions, questions, or to report any issues, please reach out to Michael via Teams or Outlook.
                </p>
            </div>
        </div>
      )}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <PermissionLozenge role={userRole} />
        <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-md text-xs text-slate-500 dark:text-slate-400">
            Logged in as <span className="font-semibold text-slate-700 dark:text-slate-200">{user.email}</span>
        </div>
        <button
            onClick={() => setIsInfoModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Show app information"
            title="About this app"
        >
            <InformationCircleIcon className="w-6 h-6"/>
        </button>
        <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Toggle dark mode"
        >
            {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5"/>}
        </button>
        <button
            onClick={handleSignOut}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Sign Out"
            title="Sign Out"
        >
            <LogoutIcon className="w-5 h-5"/>
        </button>
      </div>
    </div>
  );
};

export default App;