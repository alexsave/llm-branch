import { useMemo } from 'react';

const HORIZONTAL_SPACING = 250;
const VERTICAL_GAP = 40;
const DEFAULT_NODE_HEIGHT = 100;
const GRID_CENTER = 5000;

export const useTreeLayout = (messageGraph, nodeHeights = new Map()) => {
  return useMemo(() => {
    const positions = new Map();
    let bounds = { minX: GRID_CENTER, maxX: GRID_CENTER, minY: GRID_CENTER, maxY: GRID_CENTER };
    
    const computePositions = (nodeId, parentX = null, parentY = null, parentHeight = 0) => {
      if (!nodeId || !messageGraph.nodes[nodeId]) return { width: 0, center: GRID_CENTER };
      
      const node = messageGraph.nodes[nodeId];
      const nodeHeight = nodeHeights.get(nodeId) || DEFAULT_NODE_HEIGHT;
      
      // Calculate center position based on parent
      let center = parentX || GRID_CENTER;
      
      // Calculate y position based on parent or find the lowest sibling
      let y;
      if (parentY !== null) {
        y = parentY + parentHeight + VERTICAL_GAP;
      } else {
        y = GRID_CENTER;
      }
      
      // Store position before processing children
      positions.set(nodeId, {
        x: center,
        y,
        parentId: node.parentId,
        isActive: node.parentId && (
          messageGraph.nodes[node.parentId]?.activeChild === nodeId ||
          messageGraph.currentPath.includes(nodeId)
        )
      });
      
      // Process children after storing this node's position
      const childrenMetrics = node.children.map(childId => {
        const siblingPositions = node.children
          .slice(0, node.children.indexOf(childId))
          .map(id => positions.get(id))
          .filter(Boolean);
        
        const lastSiblingY = siblingPositions.length > 0 
          ? Math.max(...siblingPositions.map(pos => pos.y + (nodeHeights.get(pos.id) || DEFAULT_NODE_HEIGHT)))
          : y + nodeHeight;
          
        return computePositions(
          childId,
          null,
          lastSiblingY,
          0
        );
      });
      
      // Calculate total width needed for children
      const totalChildrenWidth = childrenMetrics.reduce((sum, m) => sum + m.width, 0);
      const nodeWidth = Math.max(HORIZONTAL_SPACING, totalChildrenWidth);
      
      // Adjust center based on children
      if (childrenMetrics.length > 0) {
        const firstChild = childrenMetrics[0].center;
        const lastChild = childrenMetrics[childrenMetrics.length - 1].center;
        center = (firstChild + lastChild) / 2;
        
        // Update position with new center
        positions.set(nodeId, {
          ...positions.get(nodeId),
          x: center
        });
      }
      
      // Ensure no horizontal overlap at this y-coordinate
      const nodesAtY = Array.from(positions.values()).filter(pos => 
        pos.y === y && pos.x !== center
      );
      if (nodesAtY.length > 0) {
        const rightmostX = Math.max(...nodesAtY.map(pos => pos.x)) + HORIZONTAL_SPACING;
        center = Math.max(center, rightmostX);
        positions.set(nodeId, {
          ...positions.get(nodeId),
          x: center
        });
      }
      
      // Update bounds
      bounds.minX = Math.min(bounds.minX, center - HORIZONTAL_SPACING / 2);
      bounds.maxX = Math.max(bounds.maxX, center + HORIZONTAL_SPACING / 2);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y + nodeHeight);
      
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