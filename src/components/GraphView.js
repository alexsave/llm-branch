import React, { useEffect, useRef, useState } from 'react';
import { useTreeLayout } from '../hooks/useTreeLayout';

const MIN_SCALE = 0.2;
const MAX_SCALE = 2;
const ZOOM_SPEED = 0.002;

const GraphView = ({ 
  messageGraph, 
  selectedMessageId, 
  handleBranch,
  gridPosition,
  gridScale,
  isDragging,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleUpdatePosition,
  handleUpdateScale
}) => {
  const containerRef = useRef(null);
  const lastPosition = useRef({ x: 0, y: 0 });
  const nodeBoundaries = useRef(new Map());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { positions, curves, bounds, width, height, center } = useTreeLayout(messageGraph);

  const isClickInsideNode = (clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    // Convert client coordinates to graph space
    const graphX = (clientX - rect.left - gridPosition.x) / gridScale;
    const graphY = (clientY - rect.top - gridPosition.y) / gridScale;

    // Check each node's boundaries
    for (const [nodeId, boundary] of nodeBoundaries.current.entries()) {
      if (graphX >= boundary.left && graphX <= boundary.right &&
          graphY >= boundary.top && graphY <= boundary.bottom) {
        return nodeId;
      }
    }
    return null;
  };

  const handleLocalMouseDown = (e) => {
    e.preventDefault();
    const nodeId = isClickInsideNode(e.clientX, e.clientY);
    lastPosition.current = { x: e.clientX, y: e.clientY };
    handleMouseDown(e, nodeId);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      handleMouseMove(e);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Update node boundaries when positions change
  useEffect(() => {
    const newBoundaries = new Map();
    const nodeElements = document.querySelectorAll('.message');
    
    nodeElements.forEach(element => {
      const nodeId = element.getAttribute('data-node-id');
      if (nodeId) {
        const rect = element.getBoundingClientRect();
        const container = containerRef.current.getBoundingClientRect();
        
        // Convert to graph space coordinates
        const left = (rect.left - container.left - gridPosition.x) / gridScale;
        const right = (rect.right - container.left - gridPosition.x) / gridScale;
        const top = (rect.top - container.top - gridPosition.y) / gridScale;
        const bottom = (rect.bottom - container.top - gridPosition.y) / gridScale;
        
        newBoundaries.set(nodeId, { left, right, top, bottom });
      }
    });
    
    nodeBoundaries.current = newBoundaries;
  }, [positions, gridPosition.x, gridPosition.y, gridScale]);

  // Center the tree when it updates or when new messages are added
  useEffect(() => {
    if (containerRef.current && width && height) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Calculate the scale to fit the tree
      const scaleX = (containerRect.width - 100) / width;
      const scaleY = (containerRect.height - 100) / height;
      const fitScale = Math.min(1, scaleX, scaleY);

      // Get the latest message position
      const latestMessageId = messageGraph.currentPath[messageGraph.currentPath.length - 1];
      const latestPosition = positions.get(latestMessageId);
      
      if (latestPosition) {
        // Check if the new node would be visible in the current view
        const nodeX = latestPosition.x * gridScale + gridPosition.x;
        const nodeY = latestPosition.y * gridScale + gridPosition.y;
        
        const margin = 100; // Add some margin to ensure node is comfortably in view
        const isVisible = 
          nodeX >= margin && 
          nodeX <= containerRect.width - margin &&
          nodeY >= margin && 
          nodeY <= containerRect.height - margin;

        if (!isVisible) {
          // Center on the latest message only if it's not visible
          setIsTransitioning(true);
          const centerX = (containerRect.width / 2) - (latestPosition.x * fitScale);
          const centerY = (containerRect.height / 2) - (latestPosition.y * fitScale);
          handleUpdatePosition(centerX, centerY);
          handleUpdateScale(fitScale);
          // Remove transition class after animation completes
          setTimeout(() => setIsTransitioning(false), 500);
        }
      } else if (!messageGraph.root || gridPosition.x === 0 && gridPosition.y === 0) {
        // Initial centering for first message
        setIsTransitioning(true);
        const centerX = (containerRect.width / 2) - (center.x * fitScale);
        const centerY = (containerRect.height / 2) - (center.y * fitScale);
        handleUpdatePosition(centerX, centerY);
        handleUpdateScale(fitScale);
        // Remove transition class after animation completes
        setTimeout(() => setIsTransitioning(false), 500);
      }
    }
  }, [width, height, center, messageGraph.root, messageGraph.currentPath]);

  const constrainPosition = (x, y) => {
    const container = containerRef.current;
    if (!container) return { x, y };
    
    const containerRect = container.getBoundingClientRect();
    const treeWidth = width * gridScale;
    const treeHeight = height * gridScale;
    
    // Add padding
    const minX = containerRect.width - treeWidth - 40;
    const maxX = 40;
    const minY = containerRect.height - treeHeight - 40;
    const maxY = 40;
    
    // Constrain position
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y))
    };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate zoom
      const delta = -e.deltaY * ZOOM_SPEED;
      const newScale = gridScale * (1 + delta);
      
      if (newScale >= MIN_SCALE && newScale <= MAX_SCALE) {
        // Calculate mouse position relative to content
        const mouseContentX = (mouseX - gridPosition.x) / gridScale;
        const mouseContentY = (mouseY - gridPosition.y) / gridScale;
        
        // Calculate new position to zoom towards mouse
        const newX = mouseX - mouseContentX * newScale;
        const newY = mouseY - mouseContentY * newScale;
        
        const constrained = constrainPosition(newX, newY);
        
        handleUpdateScale(newScale);
        handleUpdatePosition(constrained.x, constrained.y);
      }
    } else {
      // Pan
      const constrained = constrainPosition(
        gridPosition.x - e.deltaX,
        gridPosition.y - e.deltaY
      );
      handleUpdatePosition(constrained.x, constrained.y);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="graph-container"
      onWheel={handleWheel}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 420,
        bottom: 0,
        padding: 40,
        zIndex: 2,
        overflow: 'visible'
      }}
    >
      <div 
        className={`graph-content ${isTransitioning ? 'transitioning' : ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${gridPosition.x}px, ${gridPosition.y}px) scale(${gridScale})`,
          transformOrigin: '0 0',
          userSelect: 'none',
          overflow: 'visible'
        }}
      >
        <div 
          className="grid-background" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 420,
            bottom: 0,
            cursor: isDragging ? 'grabbing' : 'grab',
            zIndex: 1
          }}
          onMouseDown={handleLocalMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        <svg 
          className="connections" 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%',
            minWidth: '10000px', // Large minimum size to ensure SVG can extend
            minHeight: '10000px',
            pointerEvents: 'none',
            overflow: 'visible'
          }}
          preserveAspectRatio="none"
        >
          {Array.from(curves.entries()).map(([nodeId, curve]) => (
            <path
              key={nodeId}
              d={curve.path}
              stroke={curve.isActive ? '#4caf50' : 'rgba(255, 255, 255, 0.2)'}
              strokeWidth={curve.isActive ? 2 : 1}
              fill="none"
              strokeDasharray={curve.isActive ? '' : '4,4'}
              style={{ overflow: 'visible' }}
            />
          ))}
        </svg>
        <div 
          className="nodes" 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            minWidth: '10000px', // Large minimum size to ensure nodes can extend
            minHeight: '10000px',
            pointerEvents: isDragging ? 'none' : 'auto',
            overflow: 'visible'
          }}
        >
          {Array.from(positions.entries()).map(([nodeId, pos]) => {
            const node = messageGraph.nodes[nodeId];
            return (
              <div
                key={nodeId}
                data-node-id={nodeId}
                className={`message ${node.role} ${selectedMessageId === nodeId ? 'selected' : ''} ${pos.isActive ? 'active' : ''}`}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  transform: 'translate(-50%, 0)',
                }}
              >
                <strong>{node.role === 'user' ? 'You' : 'Assistant'}:</strong>
                <p>{node.content}</p>
                <div className="message-actions">
                  {node.role === 'assistant' && (
                    <span className="reply-label">Click to reply</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GraphView; 