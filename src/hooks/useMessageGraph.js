import { useState } from 'react';

export const useMessageGraph = () => {
  const [messageGraph, setMessageGraph] = useState({
    nodes: {
      preview: {
        id: 'preview',
        role: 'user',
        content: '',
        parentId: null,
        children: [],
        activeChild: null,
      }
    },
    root: 'preview',
    currentPath: ['preview'],
  });
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  const getCurrentPathMessages = () => {
    const messages = [];
    let currentId = messageGraph.root;
    
    if (selectedMessageId) {
      const path = [];
      let current = selectedMessageId;
      while (current) {
        path.unshift(current);
        current = messageGraph.nodes[current]?.parentId;
      }
      
      for (const id of path) {
        const node = messageGraph.nodes[id];
        if (!node) break;
        messages.push(node);
      }
    } else {
      while (currentId) {
        const node = messageGraph.nodes[currentId];
        if (!node) break;
        messages.push(node);
        currentId = node.activeChild;
      }
    }
    
    return messages;
  };

  const getLevels = () => {
    const levels = [];
    const seen = new Set();
    
    const addToLevel = (messageId, level) => {
      if (!messageId || seen.has(messageId)) return;
      
      while (levels.length <= level) {
        levels.push([]);
      }
      
      const message = messageGraph.nodes[messageId];
      if (!message) return;
      
      levels[level].push(message);
      seen.add(messageId);
      
      message.children.forEach(childId => {
        addToLevel(childId, level + 1);
      });
    };
    
    addToLevel(messageGraph.root, 0);
    return levels;
  };

  const handleBranch = (messageId) => {
    console.log('handleBranch called with:', messageId);
    const node = messageGraph.nodes[messageId];
    console.log('Found node:', node);
    if (!node || node.role === 'user') return;

    // Build the new path from root to selected node
    const newPath = [];
    let currentId = messageId;
    while (currentId) {
      newPath.unshift(currentId);
      currentId = messageGraph.nodes[currentId]?.parentId;
    }
    console.log('Built new path:', newPath);

    // Update the graph with new path and active children
    setMessageGraph(prev => {
      console.log('Updating message graph:', { prev, newPath });
      const newNodes = { ...prev.nodes };
      
      // Update active children along the new path
      for (let i = 0; i < newPath.length - 1; i++) {
        const parentId = newPath[i];
        const childId = newPath[i + 1];
        console.log('Updating active child:', { parentId, childId });
        newNodes[parentId] = {
          ...newNodes[parentId],
          activeChild: childId
        };
      }

      const newGraph = {
        ...prev,
        nodes: newNodes,
        currentPath: newPath,
      };
      console.log('New graph state:', newGraph);
      return newGraph;
    });
    
    setSelectedMessageId(messageId);
  };

  return {
    messageGraph,
    setMessageGraph,
    selectedMessageId,
    setSelectedMessageId,
    getCurrentPathMessages,
    getLevels,
    handleBranch,
  };
}; 