import React from 'react';
import MessageList from './MessageList';
import InputForm from './InputForm';
import { useChat } from '../contexts/ChatContext';

export const ChatContainer = () => {
  const {
    input,
    setInput,
    isLoading,
    error,
    handleSubmit,
    getCurrentPathMessages,
    selectedMessageId,
    handleBranch
  } = useChat();

  const messages = getCurrentPathMessages();

  return (
    <div className="chat-container">
      <MessageList 
        messages={messages}
        selectedMessageId={selectedMessageId}
        handleBranch={handleBranch}
      />
      <InputForm
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
      />
      {isLoading && <div className="loading">Thinking...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}; 