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
  const [showSettings, setShowSettings] = useState(false);
  const [modelSettings, setModelSettings] = useState({
    selectedModel: 'gpt-3.5-turbo',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModelName: 'llama3.2',
    openaiModel: 'gpt-3.5-turbo',
    anthropicModel: 'claude-3-opus-20240229',
  });
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

  const updateModelSettings = (newSettings) => {
    setModelSettings(newSettings);
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
        modelFamily: modelSettings.selectedModel === 'openai' ? 'openai' :
                    modelSettings.selectedModel === 'anthropic' ? 'anthropic' :
                    modelSettings.selectedModel === 'ollama' ? 'ollama' :
                    'default',
        model: modelSettings.selectedModel === 'openai' ? modelSettings.openaiModel :
               modelSettings.selectedModel === 'anthropic' ? modelSettings.anthropicModel :
               modelSettings.selectedModel === 'ollama' ? modelSettings.ollamaModelName :
               'gpt-3.5-turbo'
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

      const messages = getMessageHistory();

      let response;
      
      const modelFamily = modelSettings.selectedModel === 'openai' ? 'openai' :
                         modelSettings.selectedModel === 'anthropic' ? 'anthropic' :
                         modelSettings.selectedModel === 'ollama' ? 'ollama' :
                         'default';

      switch (modelFamily) {
        case 'default':
          // Use default server
          response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/chat-stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_KEY}`,
            },
            body: JSON.stringify({ messages }),
          });
          break;

        case 'openai':
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${modelSettings.apiKey}`,
            },
            body: JSON.stringify({
              model: modelSettings.openaiModel,
              messages,
              stream: true,
            }),
          });
          break;

        case 'anthropic':
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': modelSettings.apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
              model: modelSettings.anthropicModel,
              max_tokens: 1024,
              messages: messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
              })),
              stream: true
            }),
          });
          break;

        case 'ollama':
          response = await fetch(`${modelSettings.ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelSettings.ollamaModelName || 'llama2',
              messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
              })),
              stream: true
            }),
          });
          break;

        default:
          throw new Error('Unsupported model family');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Response received:', response);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new data to buffer and split into lines
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        console.log('Received chunk:', chunk);
        
        // For default server, process the chunk directly
        if (modelFamily === 'default') {
          responseRef.current += chunk;
          console.log('Server response:', chunk);
          
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
          continue;
        }

        const lines = buffer.split('\n');
        console.log('Split lines:', lines);
        
        // Process all complete lines
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        console.log('Remaining buffer:', buffer);
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          
          try {
            if (trimmedLine.startsWith('data: ')) {
              const data = JSON.parse(trimmedLine.slice(6));
              const modelFamily = modelSettings.selectedModel === 'openai' ? 'openai' :
                                modelSettings.selectedModel === 'anthropic' ? 'anthropic' :
                                modelSettings.selectedModel === 'ollama' ? 'ollama' :
                                'default';

              console.log('Processing line:', { modelFamily, data, trimmedLine });

              switch (modelFamily) {
                case 'anthropic':
                  // Handle Anthropic's streaming format
                  if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                    responseRef.current += data.delta.text;
                    console.log('Anthropic delta:', data.delta.text);
                  }
                  break;

                case 'openai':
                  // Handle OpenAI format
                  if (data.choices?.[0]?.delta?.content) {
                    responseRef.current += data.choices[0].delta.content;
                    console.log('OpenAI delta:', data.choices[0].delta.content);
                  }
                  break;

                case 'default':
                  // Server sends raw text chunks directly
                  responseRef.current += trimmedLine;
                  console.log('Server response:', trimmedLine);
                  break;
              }
            } else if (modelSettings.selectedModel === 'ollama') {
              // Parse Ollama's JSON response directly (no data: prefix)
              const data = JSON.parse(trimmedLine);
              if (!data.done && data.message?.content) {
                responseRef.current += data.message.content;
                console.log('Ollama content:', data.message.content);
              }
            } else if (modelFamily === 'default') {
              // Handle raw text for default server
              responseRef.current += trimmedLine;
              console.log('Server response:', trimmedLine);
            }
          } catch (e) {
            if (modelFamily === 'default') {
              // For default server, handle raw text even if JSON parsing fails
              responseRef.current += trimmedLine;
              console.log('Server raw text (fallback):', trimmedLine);
            } else {
              console.error('Error parsing streaming response:', e, { line: trimmedLine });
            }
          }

          // Log the state update
          console.log('Updating message graph with:', responseRef.current);

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
      }

      // Handle any remaining data in the buffer
      if (buffer) {
        try {
          if (modelSettings.selectedModel !== 'gpt-3.5-turbo') {
            if (buffer.startsWith('data: ')) {
              const data = JSON.parse(buffer.slice(6));
              if (data.choices?.[0]?.delta?.content) {
                responseRef.current += data.choices[0].delta.content;
              }
            }
          } else {
            responseRef.current += buffer;
          }
        } catch (e) {
          console.error('Error parsing final buffer:', e);
        }
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
    showSettings,
    setShowSettings,
    modelSettings,
    updateModelSettings,
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