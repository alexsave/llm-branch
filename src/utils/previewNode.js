export const handlePreviewNode = (nodes, assistantId, currentPath) => {
  // Deep copy the nodes
  const newNodes = JSON.parse(JSON.stringify(nodes));
  
  // First, remove all preview nodes
  Object.entries(newNodes)
    .filter(([id]) => id.startsWith('preview-'))
    .forEach(([id]) => {
      delete newNodes[id];
    });

  // Remove preview from all assistant nodes' children
  Object.entries(newNodes)
    .filter(([_, node]) => node.role === 'assistant')
    .forEach(([id, node]) => {
      newNodes[id] = {
        ...node,
        children: node.children.filter(childId => !childId.startsWith('preview-')),
        activeChild: node.activeChild?.startsWith('preview-') ? null : node.activeChild
      };
    });

  // Check if the target assistant has other children
  const hasOtherChildren = newNodes[assistantId]?.children?.length > 0;
  
  if (!hasOtherChildren) {
    // Create a new preview node with a unique ID
    const previewId = `preview-${assistantId}`;
    
    // Add preview to current assistant
    newNodes[assistantId] = {
      ...newNodes[assistantId],
      children: [previewId],
      activeChild: previewId,
    };

    // Create new preview node
    newNodes[previewId] = {
      id: previewId,
      role: 'user',
      content: '',
      parentId: assistantId,
      children: [],
      activeChild: null,
    };

    // Add preview to path if not already there
    if (!currentPath.includes(previewId)) {
      currentPath.push(previewId);
    }
  }

  return { nodes: newNodes, path: currentPath };
}; 