import React, { createContext, useContext } from 'react';
import { useGridControl } from '../hooks/useGridControl';

const GraphContext = createContext(null);

export const GraphProvider = ({ children }) => {
  const {
    gridPosition,
    gridScale,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useGridControl();

  const value = {
    gridPosition,
    gridScale,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };

  return (
    <GraphContext.Provider value={value}>
      {children}
    </GraphContext.Provider>
  );
};

export const useGraph = () => {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return context;
}; 