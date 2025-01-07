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
      const { preview, ...otherNodes } = JSON.parse(JSON.stringify(prev.nodes));
      const newNodes = { ...otherNodes, [newMessageId]: userMessage };
      
      if (parentId) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...(newNodes[parentId]?.children?.filter(id => id !== 'preview') || []), newMessageId],
          activeChild: newMessageId,
        };
      }
      
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

    const assistantMessageId = (Date.now() + 1).toString();

    try {
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

      setMessageGraph(prev => {
        const newPath = [...prev.currentPath.filter(id => id !== 'preview'), assistantMessageId];
        const newNodes = JSON.parse(JSON.stringify(prev.nodes));
        newNodes[assistantMessageId] = assistantMessage;
        newNodes[newMessageId] = {
          ...newNodes[newMessageId],
          children: [...newNodes[newMessageId].children, assistantMessageId],
          activeChild: assistantMessageId,
        };

        return validateGraph(prev, newNodes, newPath);
      });

      const messages = getCurrentPathMessages();
      if (messages[messages.length - 1]?.content !== input) {
        messages.push({ role: 'user', content: input });
      }

      const modelHandler = ModelHandlerFactory.createHandler(modelSettings);
      const response = await modelHandler.fetchCompletion(messages);

      const updateMessage = (content) => {
        setMessageGraph(prev => {
          const newNodes = {
            ...prev.nodes,
            [assistantMessageId]: {
              ...prev.nodes[assistantMessageId],
              content,
            },
          };
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