import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import MessageNode from './MessageNode';

const nodeTypes = {
  message: MessageNode,
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const HORIZONTAL_SPACING = 250;
const VERTICAL_SPACING = 140;

const GraphView = ({
  messageGraph,
  selectedMessageId,
  handleBranch,
  gridPosition,
  gridScale,
  previewMessageId,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setCenter, setViewport } = useReactFlow();

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
        newEdges.push({
          id: `${nodeId}-${childId}`,
          source: nodeId,
          target: childId,
          type: 'straight',
          animated: messageGraph.nodes[nodeId]?.activeChild === childId,
          style: {
            stroke: messageGraph.nodes[nodeId]?.activeChild === childId ? '#4caf50' : 'rgba(255, 255, 255, 0.2)',
            strokeWidth: messageGraph.nodes[nodeId]?.activeChild === childId ? 2 : 1,
          },
        });
      });

      // Add preview node if this is the selected node
      if (nodeId === selectedMessageId && previewMessageId) {
        const previewLevel = level + 1;
        if (!levels.has(previewLevel)) {
          levels.set(previewLevel, []);
        }
        levels.get(previewLevel).push(previewMessageId);
        processedNodes.set(previewMessageId, true);

        // Create edge to preview node
        newEdges.push({
          id: `${nodeId}-${previewMessageId}`,
          source: nodeId,
          target: previewMessageId,
          type: 'straight',
          style: {
            stroke: 'rgba(255, 255, 255, 0.2)',
            strokeWidth: 1,
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
        const isPreview = nodeId === previewMessageId;
        const x = startX + (index * HORIZONTAL_SPACING);
        const y = level * VERTICAL_SPACING;

        newNodes.push({
          id: nodeId,
          type: 'message',
          position: { x, y },
          draggable: false,
          data: {
            message: isPreview ? {
              id: previewMessageId,
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
  }, [messageGraph, selectedMessageId, handleBranch, gridScale, setCenter, previewMessageId]);

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
        <MiniMap
          style={{
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          nodeColor={(node) => {
            return node.data.message.role === 'user' ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 255, 255, 0.1)';
          }}
        />
      </ReactFlow>
    </div>
  );
};

export default GraphView; 