import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import MessageNode from './MessageNode';
import { useChat } from '../contexts/ChatContext';
import { useGraph } from '../contexts/GraphContext';

const nodeTypes = {
  message: MessageNode,
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const HORIZONTAL_SPACING = 250;
const VERTICAL_SPACING = 140;

const GraphView = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setCenter, setViewport } = useReactFlow();

  const { messageGraph, selectedMessageId, handleBranch } = useChat();
  const { gridPosition, gridScale } = useGraph();

  // Convert message graph to React Flow format
  const updateNodesAndEdges = useCallback(() => {
    const newNodes = [];
    const newEdges = [];
    const processedNodes = new Map();
    const levels = new Map();

    const processNode = (nodeId, level = 0) => {
      if (processedNodes.has(nodeId)) return;
      const node = messageGraph.nodes[nodeId];
      if (!node) return;

      // Track nodes at each level for positioning
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level).push(nodeId);
      processedNodes.set(nodeId, true);

      // Process children
      node.children.forEach(childId => {
        processNode(childId, level + 1);
        // Create edge
        const isActive = messageGraph.nodes[nodeId]?.activeChild === childId && 
                        messageGraph.currentPath.includes(nodeId) &&
                        messageGraph.currentPath.includes(childId);
        newEdges.push({
          id: `${nodeId}-${childId}`,
          source: nodeId,
          target: childId,
          type: 'straight',
          animated: isActive,
          style: {
            stroke: isActive ? '#4caf50' : 'rgba(255, 255, 255, 0.2)',
            strokeWidth: isActive ? 2 : 1,
          },
        });
      });

      // Add preview node if this is the selected node
      if (nodeId === selectedMessageId && node.role === 'assistant') {
        const previewId = `preview-${nodeId}`;
        const previewLevel = level + 1;
        if (!levels.has(previewLevel)) {
          levels.set(previewLevel, []);
        }
        levels.get(previewLevel).push(previewId);
        processedNodes.set(previewId, true);

        // Create edge to preview node
        const isActive = messageGraph.nodes[nodeId]?.activeChild === previewId &&
                        messageGraph.currentPath.includes(nodeId) &&
                        messageGraph.currentPath.includes(previewId);
        newEdges.push({
          id: `${nodeId}-${previewId}`,
          source: nodeId,
          target: previewId,
          type: 'straight',
          animated: isActive,
          style: {
            stroke: isActive ? '#4caf50' : 'rgba(255, 255, 255, 0.2)',
            strokeWidth: isActive ? 2 : 1,
            strokeDasharray: '5,5',
          },
        });
      }
    };

    // Process all nodes starting from root
    if (messageGraph.root) {
      processNode(messageGraph.root);
    }

    // Position nodes by level
    levels.forEach((nodeIds, level) => {
      const levelWidth = nodeIds.length * HORIZONTAL_SPACING;
      const startX = -levelWidth / 2;

      nodeIds.forEach((nodeId, index) => {
        const isPreview = nodeId.startsWith('preview-');
        const x = startX + (index * HORIZONTAL_SPACING);
        const y = level * VERTICAL_SPACING;

        newNodes.push({
          id: nodeId,
          type: 'message',
          position: { x, y },
          draggable: false,
          data: {
            message: isPreview ? {
              id: nodeId,
              role: 'user',
              content: 'Your message...',
              parentId: selectedMessageId,
              children: [],
              activeChild: null,
              isPreview: true,
            } : messageGraph.nodes[nodeId],
            isSelected: nodeId === selectedMessageId,
            isActive: messageGraph.currentPath.includes(nodeId),
            onBranch: handleBranch,
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);

    // Center on the latest message if it exists
    const latestMessageId = messageGraph.currentPath[messageGraph.currentPath.length - 1];
    if (latestMessageId) {
      const latestNode = newNodes.find(node => node.id === latestMessageId);
      if (latestNode) {
        setCenter(latestNode.position.x, latestNode.position.y, { zoom: gridScale, duration: 500 });
      }
    }
  }, [messageGraph, selectedMessageId, handleBranch, gridScale, setCenter]);

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