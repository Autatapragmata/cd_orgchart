import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Person, ChartMeta } from './types';
import { useHistoryState } from './hooks/useHistoryState';
import { layoutTree } from './utils/treeUtils';
import OrgChart from './components/OrgChart';
import ChartTabs from './components/ChartTabs';
import { useDarkMode } from './hooks/useDarkMode';
import { SunIcon } from './components/icons/SunIcon';
import { MoonIcon } from './components/icons/MoonIcon';
import { auth, db, User } from './firebase';
import { InformationCircleIcon } from './components/icons/InformationCircleIcon';
import { XIcon } from './components/icons/XIcon';
import Login from './components/Login';
import { LogoutIcon } from './components/icons/LogoutIcon';
import PermissionLozenge from './components/PermissionLozenge';
import ManageUsersModal from './components/ManageUsersModal';
import { UsersIcon } from './components/icons/UsersIcon';

// --- Permissions ---
export type UserRole = 'admin' | 'contributor' | 'viewer';

// The super admin always has admin rights regardless of Firestore.
const SUPER_ADMIN = 'michael.kavalar@mtacd.org';

// Initial roles seeded into Firestore on first super-admin login.
const INITIAL_ROLES: Record<string, UserRole> = {
    'natalie.millstein@mtahq.org': 'admin',
    'natalie.millstein@mtacd.org': 'admin',
    'eric.wilson@mtacd.org': 'contributor',
    'kiyoshi.yamazaki@mtacd.org': 'contributor',
};

const ROLES_DOC_REF = db.collection('app_config').doc('user_roles');
const CHARTS_INDEX_REF = db.collection('app_config').doc('charts_index');
const MASTER_CHART_COLLECTION = 'shared_charts';
// Kept for migration: existing chart becomes the first entry in charts_index.
const MASTER_CHART_ID = 'zzgWWOjrxUIHhC4FYkRj';

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

// Firestore rejects `undefined` values. Strip them recursively before every save.
const stripUndefined = (value: any): any => {
    if (Array.isArray(value)) return value.map(stripUndefined);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, stripUndefined(v)])
        );
    }
    return value;
};

const processDataForLoad = (data: any): Person[] => {
    let dataToLoad = data || fallbackData;
    if (!Array.isArray(dataToLoad)) {
        dataToLoad = [dataToLoad];
    }
    if (dataToLoad.length > 0 && (dataToLoad[0].x === undefined || dataToLoad[0].y === undefined)) {
        dataToLoad[0] = layoutTree(dataToLoad[0]);
    }
    return dataToLoad;
};


const App: React.FC = () => {
  const [theme, toggleTheme] = useDarkMode();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('viewer');
  const [rolesConfig, setRolesConfig] = useState<Record<string, UserRole>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);

  // Multiple charts
  const [chartsIndex, setChartsIndex] = useState<ChartMeta[]>([]);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [allChartsData, setAllChartsData] = useState<Record<string, Person[]>>({});
  const allChartsLoadedRef = useRef(false);

  const hasUnsavedChanges = useRef(false);

  const { state: data, set: setData, undo, redo, canUndo, canRedo, reset } = useHistoryState<Person[]>(fallbackData);

  const canEditContent = userRole === 'admin' || userRole === 'contributor';
  const chartName = chartsIndex.find(c => c.id === activeChartId)?.name || '';

  const setLocalData = useCallback((updater: Person[] | ((current: Person[]) => Person[])) => {
      hasUnsavedChanges.current = true;
      setData(updater);
  }, [setData]);

  // Effect 1: Auth + roles + charts index listener (runs once)
  useEffect(() => {
    let chartsIndexUnsubscribe = () => {};

    const authUnsubscribe = auth.onAuthStateChanged(async (currentUser) => {
        chartsIndexUnsubscribe();
        setUser(currentUser);

        if (!currentUser) {
            setUserRole('viewer');
            setIsLoading(false);
            return;
        }

        // Load roles from Firestore
        let loadedRoles: Record<string, UserRole> = {};
        try {
            const rolesDoc = await ROLES_DOC_REF.get();
            if (rolesDoc.exists) {
                loadedRoles = rolesDoc.data()?.roles || {};
            } else if (currentUser.email === SUPER_ADMIN) {
                await ROLES_DOC_REF.set({ roles: INITIAL_ROLES });
                loadedRoles = INITIAL_ROLES;
            }
        } catch (e) {
            console.error('Error loading user roles:', e);
        }
        setRolesConfig(loadedRoles);

        if (currentUser.email === SUPER_ADMIN) {
            setUserRole('admin');
        } else if (currentUser.email) {
            setUserRole(loadedRoles[currentUser.email] || 'viewer');
        } else {
            setUserRole('viewer');
        }

        // Start charts index real-time listener
        chartsIndexUnsubscribe = CHARTS_INDEX_REF.onSnapshot(async (docSnap) => {
            if (docSnap.exists) {
                const charts = (docSnap.data()?.charts || []) as ChartMeta[];
                setChartsIndex(charts);
                // Only auto-select a chart if none is active or active was deleted
                setActiveChartId(prev =>
                    prev && charts.find(c => c.id === prev) ? prev : (charts[0]?.id || null)
                );
            } else if (currentUser.email === SUPER_ADMIN) {
                // Migration: seed charts index from existing master chart
                let existingName = 'MTA C&D Org Chart';
                try {
                    const existingDoc = await db.collection(MASTER_CHART_COLLECTION).doc(MASTER_CHART_ID).get();
                    if (existingDoc.exists) {
                        existingName = existingDoc.data()?.name || existingName;
                    }
                } catch (_) { /* ignore */ }
                const initialCharts: ChartMeta[] = [{ id: MASTER_CHART_ID, name: existingName }];
                await CHARTS_INDEX_REF.set({ charts: initialCharts });
            } else {
                // No charts index exists and user isn't admin — show empty state
                setIsLoading(false);
            }
        }, (error) => {
            console.error('Error loading charts index:', error);
            setIsLoading(false);
        });
    });

    return () => {
        authUnsubscribe();
        chartsIndexUnsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2: Chart data listener — re-subscribes whenever the active chart changes
  useEffect(() => {
    if (!activeChartId || !user) return;

    hasUnsavedChanges.current = false;

    const chartDocRef = db.collection(MASTER_CHART_COLLECTION).doc(activeChartId);

    const unsubscribe = chartDocRef.onSnapshot((docSnap) => {
        if (docSnap.metadata.hasPendingWrites) return;
        if (hasUnsavedChanges.current) return;

        if (docSnap.exists) {
            reset(processDataForLoad(docSnap.data()?.data));
        } else {
            // New chart: create with fallback data
            const newData = processDataForLoad(null);
            chartDocRef.set({ data: stripUndefined(newData) });
            reset(newData);
        }
        setIsLoading(false);
    }, (error) => {
        console.error('Error listening to chart:', error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChartId, user]);

  // Effect 3: Debounced save to Firestore
  useEffect(() => {
    if (!canEditContent || !user || !activeChartId) return;

    const handler = setTimeout(() => {
        if (hasUnsavedChanges.current) {
            db.collection(MASTER_CHART_COLLECTION).doc(activeChartId)
                .set({ data: stripUndefined(data) })
                .then(() => {
                    hasUnsavedChanges.current = false;
                })
                .catch(error => {
                    console.error("Error saving chart:", error);
                    alert("Error: Could not save changes to the server. This may be due to a permission issue. Your last change will be reverted.");
                    hasUnsavedChanges.current = false;
                    undo();
                });
        }
    }, 500);

    return () => clearTimeout(handler);
  }, [data, canEditContent, user, activeChartId, undo]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifierKey = isMac ? event.metaKey : event.ctrlKey;
        const isUndo = modifierKey && !event.shiftKey && event.key.toLowerCase() === 'z';
        const isRedo = modifierKey && event.shiftKey && event.key.toLowerCase() === 'z';

        if (isUndo && canUndo) { event.preventDefault(); undo(); }
        else if (isRedo && canRedo) { event.preventDefault(); redo(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // --- Chart management ---

  const handleSwitchChart = useCallback((chartId: string) => {
    if (chartId === activeChartId) return;
    // Flush pending save before switching
    if (hasUnsavedChanges.current && activeChartId && canEditContent) {
        db.collection(MASTER_CHART_COLLECTION).doc(activeChartId)
            .set({ data: stripUndefined(data) })
            .catch(console.error);
        hasUnsavedChanges.current = false;
    }
    setIsLoading(true);
    reset(fallbackData);
    setActiveChartId(chartId);
  }, [activeChartId, data, canEditContent, reset]);

  // Reset cross-tab cache when switching charts so stale data isn't shown
  useEffect(() => {
    allChartsLoadedRef.current = false;
    setAllChartsData({});
  }, [activeChartId]);

  const loadAllChartsForSearch = useCallback(async () => {
    if (allChartsLoadedRef.current || !user) return;
    allChartsLoadedRef.current = true;
    try {
      const results: Record<string, Person[]> = {};
      await Promise.all(
        chartsIndex
          .filter(c => c.id !== activeChartId)
          .map(async (c) => {
            const doc = await db.collection(MASTER_CHART_COLLECTION).doc(c.id).get();
            if (doc.exists) {
              results[c.id] = processDataForLoad(doc.data()?.data);
            }
          })
      );
      setAllChartsData(results);
    } catch (e) {
      console.error('Error loading all charts for search:', e);
    }
  }, [chartsIndex, activeChartId, user]);

  const handleAddChart = useCallback(async () => {
    if (userRole !== 'admin') return;
    const newRef = db.collection(MASTER_CHART_COLLECTION).doc();
    const newId = newRef.id;
    const newChart: ChartMeta = { id: newId, name: 'New Chart' };
    const updatedCharts = [...chartsIndex, newChart];
    try {
        const batch = db.batch();
        batch.set(newRef, { data: fallbackData });
        batch.set(CHARTS_INDEX_REF, { charts: updatedCharts });
        await batch.commit();
        setIsLoading(true);
        reset(fallbackData);
        setActiveChartId(newId);
    } catch (e) {
        console.error('Error adding chart:', e);
    }
  }, [chartsIndex, userRole, reset]);

  const handleDeleteChart = useCallback(async (chartId: string) => {
    if (userRole !== 'admin') return;
    if (chartsIndex.length <= 1) {
        alert("You can't delete the only remaining chart.");
        return;
    }
    const name = chartsIndex.find(c => c.id === chartId)?.name || 'this chart';
    if (!confirm(`Delete "${name}"? All data will be permanently removed.`)) return;
    const updatedCharts = chartsIndex.filter(c => c.id !== chartId);
    try {
        const batch = db.batch();
        batch.delete(db.collection(MASTER_CHART_COLLECTION).doc(chartId));
        batch.set(CHARTS_INDEX_REF, { charts: updatedCharts });
        await batch.commit();
        if (activeChartId === chartId) {
            setIsLoading(true);
            reset(fallbackData);
            setActiveChartId(updatedCharts[0]?.id || null);
        }
    } catch (e) {
        console.error('Error deleting chart:', e);
    }
  }, [chartsIndex, userRole, activeChartId, reset]);

  const handleChartNameChange = useCallback(async (newName: string) => {
    if (!activeChartId || !newName.trim()) return;
    const updatedCharts = chartsIndex.map(c => c.id === activeChartId ? { ...c, name: newName } : c);
    try {
        await CHARTS_INDEX_REF.set({ charts: updatedCharts });
    } catch (e) {
        console.error('Error renaming chart:', e);
    }
  }, [activeChartId, chartsIndex]);

  // --- Node handlers ---

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<Omit<Person, 'id' | 'children'>>) => {
    if (!canEditContent) return;
    const update = (node: Person): Person => {
        if (node.id === nodeId) return { ...node, ...updates };
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, canEditContent]);

  const handleAddFloatingNode = useCallback((coords: { x: number, y: number }, type: 'person' | 'division' = 'person') => {
    if (userRole !== 'admin') return;
    if (!Number.isFinite(coords.x) || !Number.isFinite(coords.y)) {
      console.error("Attempted to add a node with invalid coordinates:", coords);
      return;
    }
    const newNode: Person = type === 'division' ? {
        id: Date.now().toString(),
        name: 'New Division',
        title: '',
        type: 'division',
        notes: '',
        skills: [],
        projects: [],
        children: [],
        x: coords.x,
        y: coords.y,
    } : {
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

  const handleAddChild = useCallback((parentId: string, type: 'person' | 'division' = 'person') => {
    if (userRole !== 'admin') return;
    const VERTICAL_GAP = 120;
    const NODE_HEIGHT = 220;

    const update = (node: Person): Person => {
        if (node.id === parentId) {
            const parentX = Number.isFinite(node.x) ? node.x as number : 0;
            const parentY = Number.isFinite(node.y) ? node.y as number : 0;
            const newNode: Person = type === 'division' ? {
                id: Date.now().toString(),
                name: 'New Division',
                title: '',
                type: 'division',
                notes: '',
                skills: [],
                projects: [],
                children: [],
                x: parentX,
                y: parentY + NODE_HEIGHT + VERTICAL_GAP / 2,
            } : {
                id: Date.now().toString(),
                name: 'New Member',
                title: 'New Role',
                skills: [],
                projects: [],
                children: [],
                team: node.team,
                x: parentX,
                y: parentY + NODE_HEIGHT + VERTICAL_GAP / 2,
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
        if (node.id === nodeId) return { ...node, skills: (node.skills || []).filter(s => s !== skillToRemove) };
        return { ...node, children: (node.children || []).map(update) };
    };
    setLocalData(data.map(update));
  }, [data, setLocalData, canEditContent]);

  const handleAddSkill = useCallback((nodeId: string, skill: string) => {
    if (!canEditContent) return;
    const update = (node: Person): Person => {
        if (node.id === nodeId) return { ...node, skills: [...(node.skills || []), skill] };
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
    const newData = data.map(root => removeNodesRecursively(root)).filter((root): root is Person => root !== null);
    setLocalData(newData);
  }, [data, setLocalData, userRole]);

  const handleMoveNode = useCallback((draggedId: string, targetId: string) => {
    if (userRole !== 'admin' || draggedId === targetId) return;
    let foundDraggedNode: Person | null = null;
    const findAndRemoveRecursive = (p: Person): Person | null => {
        if (p.id === draggedId) { foundDraggedNode = p; return null; }
        return { ...p, children: (p.children || []).map(findAndRemoveRecursive).filter((c): c is Person => c !== null) };
    };
    const dataAfterRemove = data.map(findAndRemoveRecursive).filter((p): p is Person => p !== null);
    if (!foundDraggedNode) return;
    const addNodeRecursive = (p: Person): Person => {
        if (p.id === targetId) return { ...p, children: [...(p.children || []), foundDraggedNode!] };
        return { ...p, children: (p.children || []).map(addNodeRecursive) };
    };
    setLocalData(dataAfterRemove.map(addNodeRecursive));
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
        const newPosition = shouldShiftThisNode ? { x: currentX + delta.dx, y: currentY + delta.dy } : {};
        return { ...node, ...newPosition, children: (node.children || []).map(child => updatePositionsRecursively(child, shouldShiftThisNode)) };
    };
    setLocalData(data.map(root => updatePositionsRecursively(root, false)));
  }, [data, setLocalData, userRole]);

  const handleRolesChange = useCallback((newRoles: Record<string, UserRole>) => {
    setRolesConfig(newRoles);
    if (user?.email && user.email !== SUPER_ADMIN) {
        setUserRole(newRoles[user.email] || 'viewer');
    }
  }, [user]);

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

  if (chartsIndex.length === 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-slate-500 dark:text-slate-400 text-center">
          <p>No charts available.</p>
          <p className="text-sm mt-1">Ask an administrator to create one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-600 dark:text-slate-400 w-screen h-screen flex flex-col overflow-hidden">
      <ChartTabs
        charts={chartsIndex}
        activeChartId={activeChartId}
        userRole={userRole}
        onSwitch={handleSwitchChart}
        onAdd={handleAddChart}
        onDelete={handleDeleteChart}
      />
      <div className="flex-1 relative overflow-hidden">
        <OrgChart
          key={activeChartId}
          data={data}
          chartName={chartName}
          userRole={userRole}
          chartsIndex={chartsIndex}
          activeChartId={activeChartId}
          allChartsData={allChartsData}
          onSwitchChart={handleSwitchChart}
          onSearchStart={loadAllChartsForSearch}
          onChartNameChange={handleChartNameChange}
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
        {isManageUsersOpen && (
          <ManageUsersModal
            roles={rolesConfig}
            currentUserEmail={user.email!}
            superAdminEmail={SUPER_ADMIN}
            onClose={() => setIsManageUsersOpen(false)}
            onRolesChange={handleRolesChange}
          />
        )}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-md text-xs text-slate-500 dark:text-slate-400">
              Logged in as <span className="font-semibold text-slate-700 dark:text-slate-200">{user.email}</span>
          </div>
          {userRole === 'admin' && (
            <button
              onClick={() => setIsManageUsersOpen(true)}
              className="flex items-center justify-center px-3 py-1.5 rounded-full shadow-md bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900"
              aria-label="Manage user permissions"
              title="Manage Users"
            >
              <UsersIcon className="w-4 h-4"/>
            </button>
          )}
          <PermissionLozenge role={userRole} />
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
    </div>
  );
};

export default App;
