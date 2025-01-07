import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import GraphView from './components/GraphView';
import './App.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

function App() {
  // Store messages as a graph structure
  const [messageGraph, setMessageGraph] = useState({
    nodes: {}, // Map of message IDs to message objects
    root: null, // ID of the root message
    currentPath: [], // Current conversation path being viewed
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const responseRef = useRef('');
  const [gridPosition, setGridPosition] = useState({ x: 5000, y: 5000 });
  const [gridScale, setGridScale] = useState(1);
  const isDragging = useRef(false);
  const lastPosition = useRef({ x: 0, y: 0 });
  const mouseDownPosition = useRef({ x: 0, y: 0 });
  const clickedNodeId = useRef(null);

  const handleMouseDown = (e, nodeId = null) => {
    e.preventDefault(); // Prevent text selection while dragging
    mouseDownPosition.current = { x: e.clientX, y: e.clientY };
    lastPosition.current = { x: e.clientX, y: e.clientY };
    clickedNodeId.current = nodeId;
  };

  const handleMouseMove = (e) => {
    if (!lastPosition.current) return;
    
    // Calculate distance moved
    const deltaX = e.clientX - mouseDownPosition.current.x;
    const deltaY = e.clientY - mouseDownPosition.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // If moved more than 5 pixels, start dragging
    if (!isDragging.current && distance > 5) {
      isDragging.current = true;
      clickedNodeId.current = null; // Cancel the click
    }
    
    if (!isDragging.current) return;
    e.preventDefault(); // Prevent text selection while dragging
    
    // Calculate the actual movement since last frame
    const moveDeltaX = e.clientX - lastPosition.current.x;
    const moveDeltaY = e.clientY - lastPosition.current.y;
    
    // Update position based on the delta from last frame
    handleUpdatePosition(
      gridPosition.x + moveDeltaX,
      gridPosition.y + moveDeltaY
    );
    
    // Update last position for next frame
    lastPosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e) => {
    if (!isDragging.current && clickedNodeId.current !== null) {
      handleBranch(clickedNodeId.current);
    }
    isDragging.current = false;
    lastPosition.current = null;
    clickedNodeId.current = null;
  };

  const handleUpdatePosition = (x, y) => {
    console.log('App: Updating position to:', { x, y });
    setGridPosition({ x, y });
  };

  const handleUpdateScale = (newScale) => {
    console.log('App: Updating scale to:', newScale);
    setGridScale(newScale);
  };

  useEffect(() => {
    const preventDefault = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', preventDefault, { passive: false });

    // Add global mouse event listeners
    const handleGlobalMouseUp = () => {
      console.log('App: Global mouse up, setting isDragging to:', false);
      isDragging.current = false;
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mouseleave', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('wheel', preventDefault);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, []);

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

    const parentId = selectedMessageId || getCurrentPathMessages().slice(-1)[0]?.id;
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
      const newNodes = { ...prev.nodes, [newMessageId]: userMessage };
      if (parentId) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...newNodes[parentId].children, newMessageId],
          activeChild: newMessageId,
        };
      }
      
      return {
        nodes: newNodes,
        root: prev.root || newMessageId,
        currentPath: [...(prev.currentPath || []), newMessageId],
      };
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

      setMessageGraph(prev => ({
        nodes: { 
          ...prev.nodes, 
          [assistantMessageId]: assistantMessage,
          [newMessageId]: {
            ...prev.nodes[newMessageId],
            children: [...prev.nodes[newMessageId].children, assistantMessageId],
            activeChild: assistantMessageId,
          }
        },
        root: prev.root,
        currentPath: [...prev.currentPath, assistantMessageId],
      }));

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
        if (done) break;

        const text = decoder.decode(value);
        responseRef.current += text;
        
        // Update the assistant's message
        setMessageGraph(prev => ({
          ...prev,
          nodes: {
            ...prev.nodes,
            [assistantMessageId]: {
              ...prev.nodes[assistantMessageId],
              content: responseRef.current,
            },
          },
        }));
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

    // Find path from root to this message
    const newPath = [];
    let currentId = messageId;
    while (currentId) {
      newPath.unshift(currentId);
      currentId = messageGraph.nodes[currentId]?.parentId;
    }

    // Update both currentPath and activeChild for each node in the path
    setMessageGraph(prev => {
      const newNodes = { ...prev.nodes };
      
      // Reset all activeChild pointers
      Object.values(newNodes).forEach(node => {
        node.activeChild = null;
      });
      
      // Set activeChild for each parent in the path
      for (let i = 0; i < newPath.length - 1; i++) {
        const parentId = newPath[i];
        const childId = newPath[i + 1];
        newNodes[parentId] = {
          ...newNodes[parentId],
          activeChild: childId
        };
      }
      
      return {
        ...prev,
        nodes: newNodes,
        currentPath: newPath,
      };
    });
    
    setSelectedMessageId(messageId);
  };

  const messages = getCurrentPathMessages();

  return (
    <div className="App">
      <GraphView 
        messageGraph={messageGraph}
        selectedMessageId={selectedMessageId}
        handleBranch={handleBranch}
        gridPosition={gridPosition}
        gridScale={gridScale}
        isDragging={isDragging}
        handleMouseDown={handleMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        handleUpdatePosition={handleUpdatePosition}
        handleUpdateScale={handleUpdateScale}
      />
      <div className="chat-container">
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
