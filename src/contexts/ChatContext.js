import React, { createContext, useState, useRef, useContext } from 'react';
import { useMessageGraph } from '../hooks/useMessageGraph';
import { validateGraph } from '../utils/graphValidation';
import ModelHandlerFactory from '../models/ModelHandlerFactory';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModelType, setSelectedModelType] = useState('default');
  const [modelSettings, setModelSettings] = useState({
    openai: {
      apiKey: '',
      model: 'gpt-3.5-turbo'
    },
    anthropic: {
      apiKey: '',
      model: 'claude-3-opus-20240229'
    },
    ollama: {
      url: 'http://localhost:11434',
      model: 'llama3.2'
    },
    default: {
      model: 'gpt-3.5-turbo'
    }
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

  const updateModelType = (type) => {
    setSelectedModelType(type);
  };

  const updateModelSettings = (type, settings) => {
    setModelSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        ...settings
      }
    }));
  };

  const getAvailableModels = (type) => {
    return ModelHandlerFactory.getAvailableModels(type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const parentId = selectedMessageId || messageGraph.nodes.preview?.parentId;
    const newMessageId = Date.now().toString();
    const userMessage = { 
      id: newMessageId,
      role: 'user', 
      content: input,
      parentId,
      children: [],
      activeChild: null,
    };

    setMessageGraph(prev => {
      console.log('User message - Before filtering:', JSON.stringify(prev.nodes, null, 2));
      const otherNodes = Object.fromEntries(
        Object.entries(JSON.parse(JSON.stringify(prev.nodes)))
          .filter(([id]) => !id.startsWith('preview'))
      );
      console.log('User message - After filtering previews:', JSON.stringify(otherNodes, null, 2));
      const newNodes = { ...otherNodes, [newMessageId]: userMessage };
      
      if (parentId) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...(newNodes[parentId]?.children?.filter(id => !id.startsWith('preview')) || []), newMessageId],
          activeChild: newMessageId,
        };
      }
      
      const newPath = [];
      let currentId = newMessageId;
      while (currentId) {
        newPath.unshift(currentId);
        currentId = newNodes[currentId]?.parentId;
      }
      
      console.log('User message - Final nodes:', JSON.stringify(newNodes, null, 2));
      return validateGraph(prev, newNodes, newPath);
    });

    setInput('');
    setIsLoading(true);
    setError(null);
    responseRef.current = '';

    const assistantMessageId = (Date.now() + 1).toString();

    try {
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        parentId: newMessageId,
        children: [],
        activeChild: null,
        modelFamily: selectedModelType,
        model: modelSettings[selectedModelType].model
      };

      setMessageGraph(prev => {
        console.log('Assistant message - Before filtering:', JSON.stringify(prev.nodes, null, 2));
        const newPath = [...prev.currentPath.filter(id => !id.startsWith('preview')), assistantMessageId];
        const newNodes = JSON.parse(JSON.stringify(prev.nodes));
        
        // Filter out all preview nodes
        const filteredNodes = Object.fromEntries(
          Object.entries(newNodes).filter(([id]) => !id.startsWith('preview'))
        );
        console.log('Assistant message - After filtering previews:', JSON.stringify(filteredNodes, null, 2));
        
        filteredNodes[assistantMessageId] = assistantMessage;
        filteredNodes[newMessageId] = {
          ...filteredNodes[newMessageId],
          children: [...(filteredNodes[newMessageId]?.children || []), assistantMessageId],
          activeChild: assistantMessageId,
        };

        console.log('Assistant message - Final nodes:', JSON.stringify(filteredNodes, null, 2));
        return validateGraph(prev, filteredNodes, newPath);
      });

      const messages = getCurrentPathMessages();
      if (messages[messages.length - 1]?.content !== input) {
        messages.push({ role: 'user', content: input });
      }

      const modelHandler = ModelHandlerFactory.createHandler(selectedModelType, modelSettings[selectedModelType]);
      const response = await modelHandler.fetchCompletion(messages);

      const updateMessage = (content) => {
        setMessageGraph(prev => {
          console.log('Update content - Before:', JSON.stringify(prev.nodes, null, 2));
          const newNodes = {
            ...prev.nodes,
            [assistantMessageId]: {
              ...prev.nodes[assistantMessageId],
              content,
            },
          };
          console.log('Update content - After:', JSON.stringify(newNodes, null, 2));
          return validateGraph(prev, newNodes, prev.currentPath);
        });
      };

      await modelHandler.handleStream(response, responseRef, updateMessage);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setSelectedMessageId(assistantMessageId);
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
    selectedModelType,
    updateModelType,
    modelSettings,
    updateModelSettings,
    getAvailableModels,
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