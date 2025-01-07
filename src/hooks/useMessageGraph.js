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
    const node = messageGraph.nodes[messageId];
    if (!node || node.role === 'user') return;

    const newPath = [];
    let currentId = messageId;
    while (currentId) {
      newPath.unshift(currentId);
      currentId = messageGraph.nodes[currentId]?.parentId;
    }

    setMessageGraph(prev => ({
      ...prev,
      currentPath: newPath,
    }));
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