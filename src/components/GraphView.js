import React, { useEffect, useRef } from 'react';
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
  const { positions, curves, bounds, width, height, center } = useTreeLayout(messageGraph);

  // Center the tree when it updates
  useEffect(() => {
    if (containerRef.current && width && height) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Calculate the scale to fit the tree
      const scaleX = (containerRect.width - 100) / width;
      const scaleY = (containerRect.height - 100) / height;
      const fitScale = Math.min(1, scaleX, scaleY);
      
      // Center position
      const centerX = (containerRect.width / 2) - (center.x * fitScale);
      const centerY = (containerRect.height / 3) - (center.y * fitScale);
      
      // Only center if it's a new tree (no previous position)
      if (gridPosition.x === 0 && gridPosition.y === 0) {
        handleUpdatePosition(centerX, centerY);
        handleUpdateScale(fitScale);
      }
    }
  }, [width, height, center, messageGraph.root]);

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

  const handleLocalMouseDown = (e) => {
    e.preventDefault();
    lastPosition.current = { x: e.clientX, y: e.clientY };
    handleMouseDown(e);
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

  return (
    <div 
      ref={containerRef}
      className="graph-container"
      onWheel={handleWheel}
    >
      <div 
        className="graph-content"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${gridPosition.x}px, ${gridPosition.y}px) scale(${gridScale})`,
          transformOrigin: 'center',
          userSelect: 'none'
        }}
      >
        <div 
          className="grid-background" 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            cursor: isDragging ? 'grabbing' : 'grab'
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
            pointerEvents: 'none'
          }}
        >
          {Array.from(curves.entries()).map(([nodeId, curve]) => (
            <path
              key={nodeId}
              d={curve.path}
              stroke={curve.isActive ? '#4caf50' : 'rgba(255, 255, 255, 0.2)'}
              strokeWidth={curve.isActive ? 2 : 1}
              fill="none"
              strokeDasharray={curve.isActive ? '' : '4,4'}
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
            pointerEvents: isDragging ? 'none' : 'auto'
          }}
        >
          {Array.from(positions.entries()).map(([nodeId, pos]) => {
            const node = messageGraph.nodes[nodeId];
            return (
              <div
                key={nodeId}
                className={`message ${node.role} ${selectedMessageId === nodeId ? 'selected' : ''} ${pos.isActive ? 'active' : ''}`}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  transform: 'translate(-50%, 0)',
                }}
                onClick={() => handleBranch(nodeId)}
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