import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
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
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
  const [gridScale, setGridScale] = useState(1);
  const isDragging = useRef(false);
  const lastPosition = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastPosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    
    const deltaX = e.clientX - lastPosition.current.x;
    const deltaY = e.clientY - lastPosition.current.y;
    
    setGridPosition(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
    
    lastPosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setGridScale(prev => Math.min(Math.max(0.5, prev * delta), 2));
    }
  };

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Get messages in the current conversation path
  const getCurrentPathMessages = () => {
    const messages = [];
    let currentId = messageGraph.root;
    
    // If a message is selected, only show messages up to that point
    const endId = selectedMessageId || Object.keys(messageGraph.nodes).find(id => {
      const node = messageGraph.nodes[id];
      return messageGraph.currentPath.includes(id) && !node.activeChild;
    });
    
    while (currentId) {
      const node = messageGraph.nodes[currentId];
      if (!node) break;
      messages.push(node);
      if (currentId === endId) break;
      currentId = node.activeChild;
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
        const history = [];
        let currentId = messageGraph.root;
        
        while (currentId) {
          const node = messageGraph.nodes[currentId];
          if (!node) break;
          
          history.push({ role: node.role, content: node.content });
          
          // Stop if we've reached the new user message
          if (currentId === newMessageId) break;
          
          currentId = node.activeChild;
        }
        
        // Add the new user message if it's not already included
        if (history[history.length - 1]?.content !== input) {
          history.push({ role: 'user', content: input });
        }
        
        return history;
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
    if (!node || node.role === 'user') return; // Prevent selecting user messages

    // Find path from root to this message
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

  const messages = getCurrentPathMessages();

  // Group messages by their parent to create levels
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
      
      // Add all children to the next level
      message.children.forEach(childId => {
        addToLevel(childId, level + 1);
      });
    };
    
    addToLevel(messageGraph.root, 0);
    return levels;
  };

  const levels = getLevels();

  return (
    <div className="App">
      <div 
        className="grid-background" 
        style={{
          transform: `translate(${gridPosition.x}px, ${gridPosition.y}px) scale(${gridScale})`,
          transformOrigin: 'center',
          cursor: isDragging.current ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="graph-container">
        {levels.map((level, levelIndex) => (
          <div key={levelIndex} className="graph-level">
            {level.map((msg) => (
              <div 
                key={msg.id} 
                className={`message ${msg.role} ${selectedMessageId === msg.id ? 'selected' : ''} ${messageGraph.currentPath.includes(msg.id) ? 'active' : ''}`}
                onClick={() => handleBranch(msg.id)}
              >
                <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
                <p>{msg.content}</p>
                <div className="message-actions">
                  {msg.role === 'assistant' && (
                    <span className="reply-label">Click to reply</span>
                  )}
                  {msg.children.length > 1 && (
                    <span className="branch-indicator">
                      {msg.children.length} branches
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
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
              // Auto-resize
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
