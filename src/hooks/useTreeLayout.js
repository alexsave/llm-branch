import { useMemo } from 'react';

const HORIZONTAL_SPACING = 250;
const VERTICAL_GAP = 40;
const DEFAULT_NODE_HEIGHT = 100;
const GRID_CENTER = 5000;

export const useTreeLayout = (messageGraph, nodeHeights = new Map()) => {
  return useMemo(() => {
    const positions = new Map();
    const processedLevels = new Map();
    let bounds = { minX: GRID_CENTER, maxX: GRID_CENTER, minY: GRID_CENTER, maxY: GRID_CENTER };
    const levelHeights = new Map();
    const levelYPositions = new Map();
    
    // Track the rightmost position used at each level
    const levelRightEdge = new Map();
    
    const computePositions = (nodeId, level = 0, parentX = null) => {
      if (!nodeId || !messageGraph.nodes[nodeId]) return { width: 0, center: GRID_CENTER };
      
      const node = messageGraph.nodes[nodeId];
      
      if (!processedLevels.has(level)) {
        processedLevels.set(level, []);
        levelHeights.set(level, DEFAULT_NODE_HEIGHT);
        levelRightEdge.set(level, parentX || GRID_CENTER);
      }
      const levelNodes = processedLevels.get(level);
      
      // Update maximum height for this level
      const nodeHeight = nodeHeights.get(nodeId) || DEFAULT_NODE_HEIGHT;
      levelHeights.set(level, Math.max(levelHeights.get(level), nodeHeight));
      
      // Process children first to calculate their total width
      const childrenMetrics = node.children.map((childId, index) => 
        computePositions(childId, level + 1, null) // Don't pass parentX to children
      );
      
      // Calculate total width needed for children
      const totalChildrenWidth = childrenMetrics.reduce((sum, m) => sum + m.width, 0);
      const nodeWidth = Math.max(HORIZONTAL_SPACING, totalChildrenWidth);
      
      // Calculate center position
      let center;
      if (childrenMetrics.length > 0) {
        // If node has children, center it above them
        const firstChild = childrenMetrics[0].center;
        const lastChild = childrenMetrics[childrenMetrics.length - 1].center;
        center = (firstChild + lastChild) / 2;
      } else {
        // If no children, position relative to the last node at this level
        const rightEdge = levelRightEdge.get(level);
        center = Math.max(
          rightEdge + HORIZONTAL_SPACING,
          parentX || GRID_CENTER
        );
      }
      
      // Update the rightmost position used at this level
      levelRightEdge.set(level, center + HORIZONTAL_SPACING / 2);
      
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
          
          const startX = parentPos.x;
          const startY = parentPos.y + parentHeight;
          const endX = pos.x;
          const endY = pos.y;
          
          const deltaY = endY - startY;
          const controlPoint1Y = startY + (deltaY * 0.4);
          const controlPoint2Y = endY - (deltaY * 0.4);
          
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