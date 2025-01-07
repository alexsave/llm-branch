import React, { createContext, useState, useRef, useContext } from 'react';
import { useMessageGraph } from '../hooks/useMessageGraph';
import { createClient } from '@supabase/supabase-js';
import { validateGraph } from '../utils/graphValidation';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const responseRef = useRef('');

  const {
    messageGraph,
    setMessageGraph,
    selectedMessageId,
    setSelectedMessageId,
    getCurrentPathMessages,
    getLevels,
    handleBranch,
  } = useMessageGraph();

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
        if (done) break;

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

  const value = {
    input,
    setInput,
    isLoading,
    error,
    isChatVisible,
    setIsChatVisible,
    handleSubmit,
    messageGraph,
    selectedMessageId,
    handleBranch,
    getCurrentPathMessages,
    getLevels,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 