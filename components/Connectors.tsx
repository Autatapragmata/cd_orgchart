import React from 'react';
import { Person } from '../types';

type PersonWithLayout = Person & {
  x: number;
  y: number;
  height: number;
};

type Connection = {
    from: string;
    to: string;
    color: string;
};

interface ConnectorsProps {
  nodes: PersonWithLayout[];
  connections: Connection[];
  connectorType?: 'curved' | 'elbow';
}

// Function to generate an SVG path for a smooth curve connector
const getCurvePath = (startX: number, startY: number, endX: number, endY: number): string => {
  const verticalOffset = (endY - startY) * 0.5;
  // Using a cubic Bezier curve for a smooth "S" shape
  return `M ${startX},${startY} C ${startX},${startY + verticalOffset} ${endX},${endY - verticalOffset} ${endX},${endY}`;
};

// Function to generate an SVG path for a right-angled elbow connector
const getElbowPath = (startX: number, startY: number, endX: number, endY: number): string => {
    const midY = startY + (endY - startY) / 2;
    return `M ${startX},${startY} V ${midY} H ${endX} V ${endY}`;
};


const Connectors: React.FC<ConnectorsProps> = ({ nodes, connections, connectorType = 'curved' }) => {
  const nodeMap = new Map<string, PersonWithLayout>(nodes.map(node => [node.id, node]));

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
      {connections.map(({ from, to, color }) => {
        const fromNode = nodeMap.get(from);
        const toNode = nodeMap.get(to);

        if (!fromNode || !toNode) return null;

        const NODE_WIDTH = connectorType === 'elbow' ? 200 : 256;
        const fromNodeHeight = fromNode.height || 220; // Use dynamic height, fallback to default
        const NODE_HEADER_HEIGHT = 4; // Visual offset for connector end point

        const startX = fromNode.x + NODE_WIDTH / 2;
        // Anchor the line at the bottom-center of the parent node's box.
        const startY = fromNode.y + fromNodeHeight;
        
        const endX = toNode.x + NODE_WIDTH / 2;
        // Anchor the line just above the child node's box.
        const endY = toNode.y - NODE_HEADER_HEIGHT;
        
        const path = connectorType === 'elbow'
            ? getElbowPath(startX, startY, endX, endY)
            : getCurvePath(startX, startY, endX, endY);

        return (
          <path
            key={`${from}-${to}`}
            d={path}
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
        );
      })}
    </svg>
  );
};

export default Connectors;
