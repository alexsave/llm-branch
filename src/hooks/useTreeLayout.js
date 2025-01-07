import { useMemo } from 'react';

const VERTICAL_SPACING = 120;
const HORIZONTAL_SPACING = 250;
const NODE_HEIGHT = 100; // Approximate height of a node

export const useTreeLayout = (messageGraph) => {
  return useMemo(() => {
    const positions = new Map();
    const processedLevels = new Map();
    let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
    const computePositions = (nodeId, level = 0, parentX = null) => {
      if (!nodeId || !messageGraph.nodes[nodeId]) return { width: 0, center: 0 };
      
      const node = messageGraph.nodes[nodeId];
      
      if (!processedLevels.has(level)) {
        processedLevels.set(level, []);
      }
      const levelNodes = processedLevels.get(level);
      
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
          : (parentX !== null ? parentX : 0);
      }
      
      const y = level * VERTICAL_SPACING + 60;
      
      // Update bounds
      bounds.minX = Math.min(bounds.minX, center - HORIZONTAL_SPACING / 2);
      bounds.maxX = Math.max(bounds.maxX, center + HORIZONTAL_SPACING / 2);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y + NODE_HEIGHT);
      
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
          const startX = parentPos.x;
          const startY = parentPos.y + 40;
          const endX = pos.x;
          const endY = pos.y;
          
          // Calculate control points for the curve
          const midY = (startY + endY) / 2;
          const controlPoint1Y = startY + (endY - startY) / 3;
          const controlPoint2Y = endY - (endY - startY) / 3;
          
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
  }, [messageGraph]);
}; 