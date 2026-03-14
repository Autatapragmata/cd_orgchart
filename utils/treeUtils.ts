import { Person } from '../types';

const DEFAULT_NODE_WIDTH = 256; // Corresponds to w-64
const DEFAULT_HORIZONTAL_GAP = 64;
const DEFAULT_VERTICAL_GAP = 120;

interface LayoutOptions {
    nodeWidth: number;
    horizontalGap: number;
    verticalGap: number;
    mode: 'organic' | 'rigid';
    getNodeHeight: (node: Person) => number;
}

type PersonWithLayout = Person & {
  x: number;
  y: number;
  height: number;
  propagatedColor?: string;
};

type Connection = {
    from: string;
    to: string;
    color: string;
};


// Calculates the total width required for a subtree
const calculateSubtreeWidth = (node: Person, options: LayoutOptions): number => {  
  if (!node.children || node.children.length === 0) {
    return options.nodeWidth;
  }
  const childrenWidth = node.children.map(child => calculateSubtreeWidth(child, options)).reduce((acc, width) => acc + width, 0);
  const gapsWidth = (node.children.length - 1) * options.horizontalGap;
  return Math.max(options.nodeWidth, childrenWidth + gapsWidth);
};

// Pre-traverses the tree to find the max height for each depth level.
const calculateLevelHeights = (node: Person, depth: number, levelHeightMap: Map<number, number>, options: LayoutOptions) => {
    const nodeHeight = options.getNodeHeight(node);
    const currentMax = levelHeightMap.get(depth) || 0;
    if (nodeHeight > currentMax) {
        levelHeightMap.set(depth, nodeHeight);
    }

    if (node.children) {
        for (const child of node.children) {
            calculateLevelHeights(child, depth + 1, levelHeightMap, options);
        }
    }
};


// Recursively assigns positions to nodes, using pre-calculated max level heights for vertical alignment.
const assignPositions = (
    node: Person,
    x: number,
    y: number,
    depth: number,
    levelHeightMap: Map<number, number>,
    options: LayoutOptions
): PersonWithLayout => {
  const levelHeight = levelHeightMap.get(depth)!;
  // Assign the max height of the level to all nodes on that level.
  const nodeWithPosition = { ...node, x, y, height: levelHeight };
  
  const children = node.children || [];

  if (children.length > 0) {
    // Calculate nextY using the max height of the current level to ensure all cousins start at the same vertical position.
    const nextY = y + levelHeight + options.verticalGap;
    
    const childrenSubtreeWidths = children.map(child => calculateSubtreeWidth(child, options));
    const totalChildrenSubtreeWidth = childrenSubtreeWidths.reduce((a, b) => a + b, 0) + (children.length > 1 ? children.length - 1 : 0) * options.horizontalGap;

    let childStartX = x + options.nodeWidth / 2 - totalChildrenSubtreeWidth / 2;
    
    nodeWithPosition.children = children.map((child, index) => {
        const childSubtreeWidth = childrenSubtreeWidths[index];
        const childX = childStartX + childSubtreeWidth / 2 - options.nodeWidth / 2;
        const positionedChild = assignPositions(child, childX, nextY, depth + 1, levelHeightMap, options);
        childStartX += childSubtreeWidth + options.horizontalGap;
        return positionedChild;
    });
  }
  
  return nodeWithPosition as PersonWithLayout;
};

export const layoutTree = (root: Person, startX = 0, startY = 50, customOptions?: Partial<LayoutOptions>): Person => {
  const options: LayoutOptions = {
      nodeWidth: customOptions?.nodeWidth ?? DEFAULT_NODE_WIDTH,
      horizontalGap: customOptions?.horizontalGap ?? DEFAULT_HORIZONTAL_GAP,
      verticalGap: customOptions?.verticalGap ?? DEFAULT_VERTICAL_GAP,
      mode: customOptions?.mode ?? 'organic',
      getNodeHeight: customOptions?.getNodeHeight ?? (() => 220),
  }

  // Pre-processing step to determine max height per level
  const levelHeightMap = new Map<number, number>();
  calculateLevelHeights(root, 0, levelHeightMap, options);
  
  return assignPositions(root, startX, startY, 0, levelHeightMap, options);
};

// Flattens a single tree into lists of nodes and connections for rendering
export const flattenTree = (root: Person): { nodes: PersonWithLayout[], connections: Connection[] } => {
    const nodes: PersonWithLayout[] = [];
    const connections: Connection[] = [];
    
    function traverse(node: Person, parent: Person | null, inheritedColor?: string) {
        const currentColor = node.color || inheritedColor;

        const nodeWithLayout = {
            ...node,
            x: Number.isFinite(node.x) ? node.x as number : 0,
            y: Number.isFinite(node.y) ? node.y as number : 0,
            // The height property is added by assignPositions
            height: (node as any).height || 220,
            propagatedColor: inheritedColor
        };
        nodes.push(nodeWithLayout);
        
        if (parent) {
            connections.push({ from: parent.id, to: node.id, color: currentColor || '#94a3b8' });
        }
        
        if (node.children) {
            node.children.forEach(child => traverse(child, node, currentColor));
        }
    }
    
    traverse(root, null);
    return { nodes, connections };
};

// Flattens multiple trees
export const flattenTrees = (roots: Person[]): { nodes: PersonWithLayout[], connections: Connection[] } => {
    const allNodes: PersonWithLayout[] = [];
    const allConnections: Connection[] = [];

    for (const root of roots) {
        const { nodes, connections } = flattenTree(root);
        allNodes.push(...nodes);
        allConnections.push(...connections);
    }
    
    return { nodes: allNodes, connections: allConnections };
}


export const getDescendantIds = (root: Person): string[] => {
    let ids: string[] = [];
    if (root.children) {
        for (const child of root.children) {
            ids.push(child.id);
            ids = ids.concat(getDescendantIds(child));
        }
    }
    return ids;
};
