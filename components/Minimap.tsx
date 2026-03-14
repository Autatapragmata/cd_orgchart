import React, { useRef } from 'react';
import { Person } from '../types';

interface MinimapProps {
  nodes: (Person & { x: number; y: number })[];
  chartWidth: number;
  chartHeight: number;
  viewTransform: { scale: number; positionX: number; positionY: number };
  viewportSize: { width: number; height: number };
  onPan: (targetX: number, targetY: number) => void;
}

const MINIMAP_WIDTH = 200; // pixels
const NODE_WIDTH_ON_CHART = 256;
const NODE_HEIGHT_ON_CHART = 220;

const Minimap: React.FC<MinimapProps> = ({
  nodes,
  chartWidth,
  chartHeight,
  viewTransform,
  viewportSize,
  onPan,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  if (!chartWidth || !chartHeight || !viewportSize.width) {
    return null;
  }

  const scaleRatio = MINIMAP_WIDTH / chartWidth;
  const minimapHeight = chartHeight * scaleRatio;

  const viewX = -viewTransform.positionX / viewTransform.scale;
  const viewY = -viewTransform.positionY / viewTransform.scale;
  const viewWidth = viewportSize.width / viewTransform.scale;
  const viewHeight = viewportSize.height / viewTransform.scale;
  
  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetChartX = clickX / scaleRatio;
    const targetChartY = clickY / scaleRatio;
    
    onPan(targetChartX, targetChartY);
  };


  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden nodrag">
      <svg
        ref={svgRef}
        width={MINIMAP_WIDTH}
        height={minimapHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        onClick={handleMinimapClick}
        className="cursor-pointer"
      >
        <rect width={chartWidth} height={chartHeight} className="fill-slate-100 dark:fill-slate-900" />

        {/* Render nodes */}
        {nodes.map(node => (
          <rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={NODE_WIDTH_ON_CHART}
            height={NODE_HEIGHT_ON_CHART}
            className="fill-slate-300 dark:fill-slate-600"
          />
        ))}

        {/* Render viewport */}
        <rect
          x={viewX}
          y={viewY}
          width={viewWidth}
          height={viewHeight}
          className="fill-indigo-500/20 stroke-indigo-600 dark:stroke-indigo-400"
          strokeWidth={4 / viewTransform.scale} // Make stroke width consistent on screen
        />
      </svg>
    </div>
  );
};

export default Minimap;