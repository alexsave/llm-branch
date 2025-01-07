export const validateActiveChildren = (nodes, currentPath) => {
  const newNodes = { ...nodes };
  Object.entries(newNodes).forEach(([id, node]) => {
    // Skip if node is undefined
    if (!node) return;
    
    // Clear activeChild if:
    // 1. Node has no children
    // 2. activeChild isn't in children array
    // 3. activeChild points to a non-existent node
    // 4. Node is not in the current path
    if (!node.children?.length || 
        (node.activeChild && !node.children?.includes(node.activeChild)) ||
        (node.activeChild && !newNodes[node.activeChild]) ||
        !currentPath.includes(id)) {
      newNodes[id] = {
        ...node,
        activeChild: null
      };
    }
  });
  return newNodes;
};

export const validateGraph = (prevState, newNodes, newPath) => {
  // First validate all nodes
  const validatedNodes = validateActiveChildren(newNodes, newPath);
  
  // Ensure path is valid (all nodes exist and are connected)
  const validPath = newPath.filter(id => validatedNodes[id]);
  
  // Ensure root exists
  const root = prevState.root === 'preview' && !validatedNodes.preview ? 
    validPath[0] : prevState.root;

  return {
    nodes: validatedNodes,
    root: root,
    currentPath: validPath,
  };
}; 