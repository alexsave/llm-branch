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
    ranksep: 50,
    edgesep: 50,
    marginx: 50,
    marginy: 50,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with validation
  nodes.forEach((node) => {
    const dimensions = getNodeDimensions(node.data?.message);
    // Ensure dimensions are valid numbers
    const width = Math.max(NODE_WIDTH, Math.min(1000, Math.floor(dimensions.width)));
    const height = Math.max(NODE_HEIGHT, Math.min(1000, Math.floor(dimensions.height)));
    
    g.setNode(node.id, { 
      width,
      height,
      label: node.id
    });
  });

  // Add edges
  edges.forEach((edge) => {
    if (edge.source && edge.target) {
      g.setEdge(edge.source, edge.target, {
        minlen: 1,
        weight: 1
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

    // Ensure position values are finite
    const x = isFinite(nodeWithPosition.x) ? nodeWithPosition.x - (nodeWithPosition.width / 2) : 0;
    const y = isFinite(nodeWithPosition.y) ? nodeWithPosition.y - (nodeWithPosition.height / 2) : 0;

    return {
      ...node,
      position: { x, y }
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
    const lineBreaks = ((message.content || '').match(/\n/g) || []).length;
    
    // Calculate wrapped lines based on character count
    const charsPerLine = 45;  // Slightly reduced for better readability
    const contentLines = Math.ceil(((message.content || '').length || 0) / charsPerLine);
    
    // Total lines is the max of actual lines and wrapped lines
    const totalLines = Math.max(lineBreaks + 1, contentLines);
    
    // Calculate height: base padding + line height * number of lines
    const lineHeight = 22;  // Pixels per line
    const verticalPadding = 32;  // 16px top + 16px bottom
    const height = Math.max(NODE_HEIGHT, Math.floor((lineHeight * totalLines) + verticalPadding));

    // Calculate width based on longest line
    const longestLine = (message.content || '').split('\n').reduce((max, line) => 
      Math.max(max, line.length), 0);
    const width = Math.max(NODE_WIDTH, Math.min(800, Math.floor(longestLine * 8 + 32))); // 8px per char + padding
    
    // Ensure we never return NaN or invalid values
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      console.warn('Invalid dimensions calculated:', { width, height });
      return { width: NODE_WIDTH, height: NODE_HEIGHT };
    }
    
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

  const { messageGraph: originalMessageGraph, selectedMessageId, handleBranch, isLoading } = useChat();
  const messageGraph = originalMessageGraph;
  const { gridPosition, gridScale } = useGraph();

  // Center on node with actual dimensions
  const centerOnNode = useCallback((nodeId) => {
    const node = getNode(nodeId);
    if (node) {
      const dimensions = getNodeDimensions(node.data?.message);
      const width = dimensions.width || NODE_WIDTH;
      const height = dimensions.height || NODE_HEIGHT;
      
      const centerX = node.position.x + (width / 2);
      const centerY = node.position.y + (height / 2);
      
      // Ensure we're not passing NaN values
      if (!isNaN(centerX) && !isNaN(centerY)) {
        setCenter(centerX, centerY, { zoom: gridScale, duration: 500 });
      } else {
        console.warn('Invalid center coordinates:', { centerX, centerY, node });
        // Fallback to just the node position if calculations fail
        setCenter(node.position.x, node.position.y, { zoom: gridScale, duration: 500 });
      }
    }
  }, [getNode, setCenter, gridScale]);

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    // Only allow clicking assistant nodes that aren't the current selected node
    if (node.data.message.role === 'assistant' && node.id !== selectedMessageId) {
      handleBranch(node.id);
    }
  }, [handleBranch, selectedMessageId]);

  // Convert message graph to React Flow format
  const updateNodesAndEdges = useCallback(() => {
    const newNodes = [];
    const newEdges = [];

    const processNode = (nodeId) => {
      if (!messageGraph.nodes[nodeId]) return;
      const node = messageGraph.nodes[nodeId];

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

      // Add preview node if this is the selected node and we're not loading
      if (nodeId === selectedMessageId && node.role === 'assistant' && !isLoading) {
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
  }, [messageGraph, centerOnNode, selectedMessageId, handleBranch, setNodes, setEdges, isLoading]);

  // Update nodes and edges when the message graph changes
  useEffect(() => {
    updateNodesAndEdges();
  }, [updateNodesAndEdges]);

  // Update viewport when grid position changes
  useEffect(() => {
    // Ensure we have valid, finite numbers for the viewport
    const safeX = isFinite(gridPosition.x) ? gridPosition.x : 0;
    const safeY = isFinite(gridPosition.y) ? gridPosition.y : 0;
    const safeZoom = isFinite(gridScale) && gridScale > 0 ? gridScale : 1;
    
    setViewport({ x: safeX, y: safeY, zoom: safeZoom });
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
        fitViewOptions={{ 
          padding: 0.2,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM 
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        connectOnClick={false}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        style={{ background: '#1a1a1a' }}
      >
        <Background 
          color="rgba(255, 255, 255, 0.1)" 
          gap={40} 
          size={1}
          offset={1}
          variant="dots"
        />
        <Controls 
          showZoom={true}
          showFitView={true}
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
};

export default GraphView; 