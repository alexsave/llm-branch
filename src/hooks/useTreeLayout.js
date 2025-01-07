import { useMemo } from 'react';

const HORIZONTAL_SPACING = 250;
const VERTICAL_GAP = 40; // Desired visual gap between nodes
const DEFAULT_NODE_HEIGHT = 100; // Fallback height if actual height is not available
const GRID_CENTER = 5000; // Center of our 10000x10000 grid

export const useTreeLayout = (messageGraph, nodeHeights = new Map()) => {
  return useMemo(() => {
    const positions = new Map();
    const processedLevels = new Map();
    let bounds = { minX: GRID_CENTER, maxX: GRID_CENTER, minY: GRID_CENTER, maxY: GRID_CENTER };
    
    // Calculate level heights and y-positions
    const levelHeights = new Map();
    const levelYPositions = new Map();
    
    const computePositions = (nodeId, level = 0, parentX = null) => {
      if (!nodeId || !messageGraph.nodes[nodeId]) return { width: 0, center: GRID_CENTER };
      
      const node = messageGraph.nodes[nodeId];
      
      if (!processedLevels.has(level)) {
        processedLevels.set(level, []);
        // Initialize level height with default
        levelHeights.set(level, DEFAULT_NODE_HEIGHT);
      }
      const levelNodes = processedLevels.get(level);
      
      // Update maximum height for this level
      const nodeHeight = nodeHeights.get(nodeId) || DEFAULT_NODE_HEIGHT;
      levelHeights.set(level, Math.max(levelHeights.get(level), nodeHeight));
      
      // Process children first
      const childrenMetrics = node.children.map((childId, index) => 
        computePositions(childId, level + 1, parentX)
      );
      
      // Calculate node width and center
      let nodeWidth = Math.max(
        HORIZONTAL_SPACING,
        childrenMetrics.reduce((sum, m) => sum + m.width, 0)
      );
      
      if (childrenMetrics.length === 0) {
        nodeWidth = HORIZONTAL_SPACING;
      }
      
      // Calculate center position
      let center;
      if (childrenMetrics.length > 0) {
        const firstChild = childrenMetrics[0].center;
        const lastChild = childrenMetrics[childrenMetrics.length - 1].center;
        center = (firstChild + lastChild) / 2;
      } else {
        const lastNodeAtLevel = levelNodes[levelNodes.length - 1];
        center = lastNodeAtLevel 
          ? positions.get(lastNodeAtLevel).x + HORIZONTAL_SPACING
          : (parentX !== null ? parentX : GRID_CENTER);
      }
      
      // Calculate y position based on previous levels
      let y = GRID_CENTER;
      for (let i = 0; i < level; i++) {
        y += (levelHeights.get(i) || DEFAULT_NODE_HEIGHT) + VERTICAL_GAP;
      }
      levelYPositions.set(level, y);
      
      // Update bounds
      bounds.minX = Math.min(bounds.minX, center - HORIZONTAL_SPACING / 2);
      bounds.maxX = Math.max(bounds.maxX, center + HORIZONTAL_SPACING / 2);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y + (levelHeights.get(level) || DEFAULT_NODE_HEIGHT));
      
      // Store position
      positions.set(nodeId, {
        x: center,
        y,
        parentId: node.parentId,
        isActive: node.parentId && (
          messageGraph.nodes[node.parentId]?.activeChild === nodeId ||
          messageGraph.currentPath.includes(nodeId)
        )
      });
      
      levelNodes.push(nodeId);
      
      return { width: nodeWidth, center };
    };
    
    if (messageGraph.root) {
      computePositions(messageGraph.root);
    }
    
    // Calculate path curves
    const curves = new Map();
    positions.forEach((pos, nodeId) => {
      if (pos.parentId) {
        const parentPos = positions.get(pos.parentId);
        if (parentPos) {
          const parentHeight = nodeHeights.get(pos.parentId) || DEFAULT_NODE_HEIGHT;
          
          // Start from the bottom center of the parent node
          const startX = parentPos.x;
          const startY = parentPos.y + parentHeight;
          // End at the top center of the child node
          const endX = pos.x;
          const endY = pos.y;
          
          // Calculate control points for a smooth curve
          const deltaY = endY - startY;
          const controlPoint1Y = startY + (deltaY * 0.4); // Control point closer to start
          const controlPoint2Y = endY - (deltaY * 0.4); // Control point closer to end
          
          curves.set(nodeId, {
            path: `M ${startX} ${startY} C ${startX} ${controlPoint1Y}, ${endX} ${controlPoint2Y}, ${endX} ${endY}`,
            isActive: pos.isActive
          });
        }
      }
    });
    
    return { 
      positions, 
      curves,
      bounds,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      center: {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2
      }
    };
  }, [messageGraph, nodeHeights]);
}; 