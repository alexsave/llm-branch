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
    root: 'preview', // Set preview as root initially
    currentPath: ['preview'], // Include preview in current path
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

    // Get the parent ID before removing preview
    const parentId = messageGraph.nodes.preview.parentId;
    
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
      const { preview, ...otherNodes } = prev.nodes;
      const newNodes = { ...otherNodes, [newMessageId]: userMessage };
      
      if (parentId) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...newNodes[parentId].children, newMessageId],
          activeChild: newMessageId,
        };
      }
      
      return {
        nodes: newNodes,
        root: prev.root === 'preview' ? newMessageId : prev.root,
        currentPath: prev.currentPath.map(id => id === 'preview' ? newMessageId : id),
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

      // Add assistant message and new preview node
      setMessageGraph(prev => {
        const newPath = [...prev.currentPath.filter(id => id !== 'preview'), assistantMessageId];
        const newNodes = {
          ...prev.nodes,
          [assistantMessageId]: assistantMessage,
          [newMessageId]: {
            ...prev.nodes[newMessageId],
            children: [...prev.nodes[newMessageId].children, assistantMessageId],
            activeChild: assistantMessageId,
          }
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

        return {
          ...prev,
          nodes: newNodes,
          root: prev.root,
          currentPath: newPath,
        };
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
            console.log('Assistant node:', prev.nodes[assistantMessageId]);
            
            while (currentId) {
              newPath.unshift(currentId);
              console.log('Added to path:', currentId);
              const node = prev.nodes[currentId];
              console.log('Current node:', node);
              currentId = node?.parentId;
              console.log('Next parent:', currentId);
            }
            
            console.log('Final path before preview:', newPath);
            newPath.push('preview');
            console.log('Path after adding preview:', newPath);
            
            const newNodes = { ...prev.nodes };
            
            console.log('Resetting activeChild pointers');
            // Reset all activeChild pointers
            Object.values(newNodes).forEach(node => {
              node.activeChild = null;
            });
            
            console.log('Setting new activeChild pointers');
            // Set activeChild for each parent in the path
            for (let i = 0; i < newPath.length - 1; i++) {
              const parentId = newPath[i];
              const childId = newPath[i + 1];
              console.log(`Setting ${parentId}'s activeChild to ${childId}`);
              if (parentId && childId) {
                newNodes[parentId] = {
                  ...newNodes[parentId],
                  activeChild: childId
                };
              }
            }
            
            // Ensure preview node exists and is properly connected
            const result = {
              ...prev,
              nodes: {
                ...newNodes,
                [assistantMessageId]: {
                  ...newNodes[assistantMessageId],
                  children: [...(newNodes[assistantMessageId]?.children || []), 'preview'],
                  activeChild: 'preview'
                },
                preview: {
                  id: 'preview',
                  role: 'user',
                  content: '',
                  parentId: assistantMessageId,
                  children: [],
                  activeChild: null,
                }
              },
              currentPath: newPath,
            };
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

    // Show chat when a node is clicked
    setIsChatVisible(true);

    // Find path from root to this message
    const newPath = [];
    let currentId = messageId;
    while (currentId) {
      newPath.unshift(currentId);
      currentId = messageGraph.nodes[currentId]?.parentId;
    }

    // Add preview node to path if clicking an assistant message
    if (node.role === 'assistant') {
      newPath.push('preview');
      // Update preview node's parent
      setMessageGraph(prev => ({
        ...prev,
        nodes: {
          ...prev.nodes,
          preview: {
            ...prev.nodes.preview,
            parentId: messageId,
          }
        }
      }));
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
