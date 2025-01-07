import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import MessageNode from './MessageNode';
import { useChat } from '../contexts/ChatContext';
import { useGraph } from '../contexts/GraphContext';

const USE_TEST_DATA = false;

const TEST_MESSAGE_GRAPH = {
  root: 'msg1',
  currentPath: ['msg1', 'msg2', 'msg3'],
  nodes: {
    'msg1': {
      id: 'msg1',
      role: 'user',
      content: 'Can you help me understand how React hooks work? I\'m particularly interested in useState and useEffect.',
      children: ['msg2'],
      activeChild: 'msg2',
    },
    'msg2': {
      id: 'msg2',
      role: 'assistant',
      content: 'React hooks are functions that allow you to use state and other React features in functional components. The useState hook lets you add state to functional components, while useEffect handles side effects like data fetching or DOM manipulation. Would you like me to explain each one in detail?',
      children: ['msg3', 'msg4', 'msg7'],
      activeChild: 'msg3',
    },
    'msg3': {
      id: 'msg3',
      role: 'user',
      content: 'Yes, please explain useState first.',
      children: ['msg5'],
      activeChild: 'msg5',
    },
    'msg4': {
      id: 'msg4',
      role: 'user',
      content: 'Actually, I\'d prefer to learn about useEffect first.',
      children: ['msg6'],
      activeChild: 'msg6',
    },
    'msg5': {
      id: 'msg5',
      role: 'assistant',
      content: 'useState is a hook that lets you add state variables to functional components. It returns an array with two elements: the current state value and a function to update it. Here\'s a simple example:\n\nconst [count, setCount] = useState(0);\n\nIn this case, count is the state variable initialized to 0, and setCount is the function you use to update it. When you call setCount, React will re-render the component with the new value. This is particularly useful for managing dynamic data in your components.',
      children: [],
      activeChild: null,
    },
    'msg6': {
      id: 'msg6',
      role: 'assistant',
      content: 'useEffect is a hook for handling side effects in your components. It runs after every render and can optionally be configured to run only when certain values change. Here\'s a basic example:\n\nuseEffect(() => {\n  document.title = `Count: ${count}`;\n}, [count]);\n\nThe first argument is a function that contains the effect code, and the second argument is an array of dependencies. The effect will only run when these dependencies change.',
      children: [],
      activeChild: null,
    },
    'msg7': {
      id: 'msg7',
      role: 'user',
      content: 'Can you show me a complete example combining both hooks?',
      children: ['msg8'],
      activeChild: 'msg8',
    },
    'msg8': {
      id: 'msg8',
      role: 'assistant',
      content: 'Here\'s a complete example that uses both useState and useEffect to create a simple counter with a document title update:\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n\n  useEffect(() => {\n    document.title = `Count: ${count}`;\n  }, [count]);\n\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Click me! Count: {count}\n    </button>\n  );\n}\n\nThis component maintains a count state with useState and updates the document title whenever the count changes using useEffect.',
      children: [],
      activeChild: null,
    },
  }
};

const nodeTypes = {
  message: MessageNode,
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const NODE_WIDTH = 350;
const NODE_HEIGHT = 100;

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  if (!nodes.length) return { nodes: [], edges: [] };

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 100,
    ranksep: 250,  // Increased to handle taller nodes
    edgesep: 50,
    marginx: 50,
    marginy: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  nodes.forEach((node) => {
    const dimensions = getNodeDimensions(node.data.message);
    g.setNode(node.id, { 
      width: dimensions.width,
      height: dimensions.height,
      label: node.id
    });
  });

  // Add edges
  edges.forEach((edge) => {
    if (edge.source && edge.target) {
      g.setEdge(edge.source, edge.target, {
        minlen: 1,  // Allow nodes to be closer if possible
        weight: 1   // Default edge weight
      });
    }
  });

  try {
    dagre.layout(g);
  } catch (error) {
    console.error('Dagre layout error:', error);
    return { nodes, edges };
  }

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) {
      console.warn(`No position found for node ${node.id}`);
      return node;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (nodeWithPosition.width / 2),
        y: nodeWithPosition.y - (nodeWithPosition.height / 2)
      }
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Calculate node dimensions based on content
const getNodeDimensions = (message) => {
  if (!message || message.isPreview) {
    return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }
  
  try {
    // Count actual lines in the content (code blocks, etc.)
    const lineBreaks = (message.content.match(/\n/g) || []).length;
    
    // Calculate wrapped lines based on character count
    const charsPerLine = 45;  // Slightly reduced for better readability
    const contentLines = Math.ceil((message.content.length || 0) / charsPerLine);
    
    // Total lines is the max of actual lines and wrapped lines
    const totalLines = Math.max(lineBreaks + 1, contentLines);
    
    // Calculate height: base padding + line height * number of lines
    const lineHeight = 22;  // Pixels per line
    const verticalPadding = 32;  // 16px top + 16px bottom
    const height = Math.max(NODE_HEIGHT, (lineHeight * totalLines) + verticalPadding);

    // Calculate width based on longest line
    const longestLine = message.content.split('\n').reduce((max, line) => 
      Math.max(max, line.length), 0);
    const width = Math.max(NODE_WIDTH, Math.min(800, longestLine * 8 + 32)); // 8px per char + padding
    
    return { width, height };
  } catch (error) {
    console.warn('Error calculating dimensions:', error);
    return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }
};

const GraphView = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setCenter, setViewport, getNode } = useReactFlow();

  const { messageGraph: originalMessageGraph, selectedMessageId, handleBranch } = useChat();
  const messageGraph = USE_TEST_DATA ? TEST_MESSAGE_GRAPH : originalMessageGraph;
  const { gridPosition, gridScale } = useGraph();

  // Center on node with actual dimensions
  const centerOnNode = useCallback((nodeId) => {
    const node = getNode(nodeId);
    if (node) {
      setCenter(
        node.position.x + (node.width / 2),
        node.position.y + (node.height / 2),
        { zoom: gridScale, duration: 500 }
      );
    }
  }, [getNode, setCenter, gridScale]);

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    console.log('Node clicked:', node);
    // Only allow clicking assistant nodes that aren't the current selected node
    if (node.data.message.role === 'assistant' && node.id !== selectedMessageId) {
      console.log('Handling branch for node:', node.id);
      handleBranch(node.id);
    }
  }, [handleBranch, selectedMessageId]);

  // Convert message graph to React Flow format
  const updateNodesAndEdges = useCallback(() => {
    console.log('Updating graph with:', { messageGraph, selectedMessageId });
    const newNodes = [];
    const newEdges = [];

    const processNode = (nodeId) => {
      if (!messageGraph.nodes[nodeId]) return;
      const node = messageGraph.nodes[nodeId];
      console.log('Processing node:', { nodeId, node, currentPath: messageGraph.currentPath });

      // Add node
      newNodes.push({
        id: nodeId,
        type: 'message',
        position: { x: 0, y: 0 },
        draggable: false,
        data: {
          message: node,
          isSelected: nodeId === selectedMessageId,
          isActive: messageGraph.currentPath.includes(nodeId),
          onBranch: handleBranch,
          isClickable: node.role === 'assistant' && nodeId !== selectedMessageId
        },
      });

      // Process children
      const children = node.children || [];
      children.forEach((childId) => {
        if (childId && messageGraph.nodes[childId]) {
          processNode(childId);
          
          // Create edge
          const isActive = messageGraph.currentPath.includes(nodeId) && 
                          messageGraph.currentPath.includes(childId) &&
                          messageGraph.nodes[nodeId].activeChild === childId;
          console.log('Edge status:', { 
            source: nodeId, 
            target: childId, 
            isActive,
            inPath: messageGraph.currentPath.includes(nodeId) && messageGraph.currentPath.includes(childId),
            isActiveChild: messageGraph.nodes[nodeId].activeChild === childId
          });
          newEdges.push({
            id: `${nodeId}-${childId}`,
            source: nodeId,
            target: childId,
            type: 'smoothstep',
            animated: isActive,
            style: {
              stroke: isActive ? '#4caf50' : 'rgba(255, 255, 255, 0.2)',
              strokeWidth: isActive ? 3 : 1,
              opacity: isActive ? 1 : 0.5,
            },
          });
        }
      });

      // Add preview node if this is the selected node
      if (nodeId === selectedMessageId && node.role === 'assistant') {
        const previewId = `preview-${nodeId}`;
        newNodes.push({
          id: previewId,
          type: 'message',
          position: { x: 0, y: 0 },
          draggable: false,
          data: {
            message: {
              id: previewId,
              role: 'user',
              content: 'Your message...',
              parentId: selectedMessageId,
              children: [],
              activeChild: null,
              isPreview: true,
            },
            isSelected: false,
            isActive: false,
            onBranch: handleBranch,
            isClickable: false
          },
        });

        newEdges.push({
          id: `${nodeId}-${previewId}`,
          source: nodeId,
          target: previewId,
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: 'rgba(255, 255, 255, 0.2)',
            strokeWidth: 1,
            opacity: 0.5,
            strokeDasharray: '5,5',
          },
        });
      }
    };

    // Process all nodes starting from root
    if (messageGraph.root) {
      processNode(messageGraph.root);
    }

    // Apply layout
    const layouted = getLayoutedElements(newNodes, newEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    // Center on the latest message if it exists
    const latestMessageId = messageGraph.currentPath[messageGraph.currentPath.length - 1];
    if (latestMessageId) {
      // Use setTimeout to ensure nodes are rendered and dimensions are available
      setTimeout(() => centerOnNode(latestMessageId), 100);
    }
  }, [messageGraph, centerOnNode, selectedMessageId, handleBranch]);

  // Update nodes and edges when the message graph changes
  useEffect(() => {
    updateNodesAndEdges();
  }, [updateNodesAndEdges]);

  // Update viewport when grid position changes
  useEffect(() => {
    setViewport({ x: gridPosition.x, y: gridPosition.y, zoom: gridScale });
  }, [gridPosition, gridScale, setViewport]);

  return (
    <div className="graph-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        connectOnClick={false}
      >
        <Background color="rgba(255, 255, 255, 0.1)" gap={40} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default GraphView; 