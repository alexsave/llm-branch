import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ReactFlowProvider } from 'reactflow';
import GraphView from './components/GraphView';
import './App.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

function App() {
  // Store messages as a graph structure
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
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const responseRef = useRef('');
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
  const [gridScale, setGridScale] = useState(1);
  const [previewMessageId, setPreviewMessageId] = useState('preview');

  // Helper function to validate the entire graph state
  const validateGraph = (prevState, newNodes, newPath) => {
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

  // Helper function to validate and clean activeChild pointers
  const validateActiveChildren = (nodes, currentPath) => {
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

  // Helper function to handle preview node logic
  const handlePreviewNode = (nodes, assistantId, currentPath) => {
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

  // Get messages in the current conversation path
  const getCurrentPathMessages = () => {
    const messages = [];
    let currentId = messageGraph.root;
    
    // If a message is selected, traverse up to find its path
    if (selectedMessageId) {
      const path = [];
      let current = selectedMessageId;
      // Build path from selected message up to root
      while (current) {
        path.unshift(current);
        current = messageGraph.nodes[current]?.parentId;
      }
      
      // Now follow this exact path
      for (const id of path) {
        const node = messageGraph.nodes[id];
        if (!node) break;
        messages.push(node);
      }
    } else {
      // No selection - follow the current active path
      while (currentId) {
        const node = messageGraph.nodes[currentId];
        if (!node) break;
        messages.push(node);
        currentId = node.activeChild;
      }
    }
    
    return messages;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Get the parent ID - either from the selected message or from the preview node's parent
    const parentId = selectedMessageId || messageGraph.nodes.preview?.parentId;
    
    // Remove preview node and create user message
    const newMessageId = Date.now().toString();
    const userMessage = { 
      id: newMessageId,
      role: 'user', 
      content: input,
      parentId,
      children: [],
      activeChild: null,
    };

    // Update graph with new message
    setMessageGraph(prev => {
      // Deep copy the nodes
      const { preview, ...otherNodes } = JSON.parse(JSON.stringify(prev.nodes));
      const newNodes = { ...otherNodes, [newMessageId]: userMessage };
      
      if (parentId) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...(newNodes[parentId]?.children?.filter(id => id !== 'preview') || []), newMessageId],
          activeChild: newMessageId,
        };
      }
      
      // Build new path from root to new message
      const newPath = [];
      let currentId = newMessageId;
      while (currentId) {
        newPath.unshift(currentId);
        currentId = newNodes[currentId]?.parentId;
      }
      
      return validateGraph(prev, newNodes, newPath);
    });

    setInput('');
    setIsLoading(true);
    setError(null);
    responseRef.current = '';

    try {
      // Add assistant message placeholder
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        parentId: newMessageId,
        children: [],
        activeChild: null,
      };

      // Add assistant message and new preview node
      setMessageGraph(prev => {
        const newPath = [...prev.currentPath.filter(id => id !== 'preview'), assistantMessageId];
        // Deep copy the nodes
        const newNodes = JSON.parse(JSON.stringify(prev.nodes));
        newNodes[assistantMessageId] = assistantMessage;
        newNodes[newMessageId] = {
          ...newNodes[newMessageId],
          children: [...newNodes[newMessageId].children, assistantMessageId],
          activeChild: assistantMessageId,
        };

        // Set activeChild pointers along the path
        Object.values(newNodes).forEach(node => {
          node.activeChild = null;
        });
        
        for (let i = 0; i < newPath.length - 1; i++) {
          const parentId = newPath[i];
          const childId = newPath[i + 1];
          if (parentId && childId) {
            newNodes[parentId] = {
              ...newNodes[parentId],
              activeChild: childId
            };
          }
        }

        return validateGraph(prev, newNodes, newPath);
      });

      // Get messages up to the new user message
      const getMessageHistory = () => {
        const messages = getCurrentPathMessages();
        
        // Add the new user message if it's not already included
        if (messages[messages.length - 1]?.content !== input) {
          messages.push({ role: 'user', content: input });
        }
        
        // Convert to the format expected by the API
        return messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      };

      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: getMessageHistory()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('=== Streaming complete ===');
          console.log('Assistant message ID:', assistantMessageId);
          console.log('Current messageGraph:', messageGraph);
          
          // Update preview node's parent and path
          setMessageGraph(prev => {
            console.log('Creating preview node - current state:', {
              nodes: Object.keys(prev.nodes),
              currentPath: prev.currentPath,
              root: prev.root
            });
            
            // Build path using current graph state
            const newPath = [];
            let currentId = assistantMessageId;
            console.log('Building path from assistant ID:', assistantMessageId);
            
            while (currentId) {
              newPath.unshift(currentId);
              console.log('Added to path:', currentId);
              const node = prev.nodes[currentId];
              console.log('Current node:', node);
              currentId = node?.parentId;
              console.log('Next parent:', currentId);
            }
            
            const newNodes = { ...prev.nodes };
            
            // Reset all activeChild pointers first
            console.log('Resetting activeChild pointers');
            Object.values(newNodes).forEach(node => {
              node.activeChild = null;
            });

            // Handle preview node
            const { nodes: updatedNodes, path: updatedPath } = handlePreviewNode(newNodes, assistantMessageId, newPath);
            Object.assign(newNodes, updatedNodes);
            newPath.length = 0;
            newPath.push(...updatedPath);
            
            console.log('Setting new activeChild pointers');
            // Set activeChild for each parent in the path
            for (let i = 0; i < newPath.length - 1; i++) {
              const parentId = newPath[i];
              const childId = newPath[i + 1];
              console.log(`Setting ${parentId}'s activeChild to ${childId}`);
              if (parentId && childId && newNodes[parentId]?.children?.includes(childId)) {
                newNodes[parentId] = {
                  ...newNodes[parentId],
                  activeChild: childId
                };
              }
            }
            
            const result = validateGraph(prev, newNodes, newPath);

            console.log('Final result:', {
              nodes: Object.keys(result.nodes),
              currentPath: result.currentPath,
              preview: result.nodes.preview,
              assistant: result.nodes[assistantMessageId]
            });
            return result;
          });
          break;
        }

        const text = decoder.decode(value);
        responseRef.current += text;
        
        // Update the assistant's message
        setMessageGraph(prev => {
          const newNodes = {
            ...prev.nodes,
            [assistantMessageId]: {
              ...prev.nodes[assistantMessageId],
              content: responseRef.current,
            },
          };
          return validateGraph(prev, newNodes, prev.currentPath);
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setSelectedMessageId(null);
    }
  };

  const handleBranch = (messageId) => {
    const node = messageGraph.nodes[messageId];
    if (!node) return;

    // Show chat when a node is clicked
    setIsChatVisible(true);

    // Single state update to handle all changes
    setMessageGraph(prev => {
      const newNodes = { ...prev.nodes };
      
      // Reset all activeChild pointers first
      Object.values(newNodes).forEach(node => {
        node.activeChild = null;
      });

      // Handle preview node if clicking on assistant message
      const newPath = [...prev.currentPath];
      if (node.role === 'assistant') {
        const { nodes: updatedNodes, path: updatedPath } = handlePreviewNode(newNodes, messageId, newPath);
        Object.assign(newNodes, updatedNodes);
        newPath.length = 0;
        newPath.push(...updatedPath);
      }
      
      // Set activeChild for each parent in the path
      for (let i = 0; i < newPath.length - 1; i++) {
        const parentId = newPath[i];
        const childId = newPath[i + 1];
        if (parentId && childId && newNodes[parentId]?.children?.includes(childId)) {
          newNodes[parentId] = {
            ...newNodes[parentId],
            activeChild: childId
          };
        }
      }
      
      return validateGraph(prev, newNodes, newPath);
    });
    
    setSelectedMessageId(messageId);
  };

  const messages = getCurrentPathMessages();

  return (
    <div className="App">
      <ReactFlowProvider>
        <GraphView 
          messageGraph={messageGraph}
          selectedMessageId={selectedMessageId}
          handleBranch={handleBranch}
          gridPosition={gridPosition}
          gridScale={gridScale}
          previewMessageId={previewMessageId}
        />
      </ReactFlowProvider>
      <div className={`chat-container ${isChatVisible ? 'visible' : 'hidden'}`}>
        <button 
          className="chat-toggle"
          onClick={() => setIsChatVisible(!isChatVisible)}
          aria-label={isChatVisible ? 'Hide chat' : 'Show chat'}
        >
          {isChatVisible ? '×' : '💬'}
        </button>
        <div className="messages">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message ${msg.role} ${selectedMessageId === msg.id ? 'selected' : ''}`}
              onClick={() => handleBranch(msg.id)}
            >
              <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
              <p>{msg.content}</p>
            </div>
          ))}
        </div>
        <form className="input-form" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'inherit';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            placeholder="Type your message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
      {isLoading && <div className="loading">Thinking...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default App;
