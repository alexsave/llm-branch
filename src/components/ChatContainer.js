import React from 'react';
import { useChat } from '../contexts/ChatContext';

const ChatContainer = () => {
  const {
    input,
    setInput,
    isLoading,
    error,
    isChatVisible,
    setIsChatVisible,
    handleSubmit,
    selectedMessageId,
    handleBranch,
    getCurrentPathMessages,
  } = useChat();

  const messages = getCurrentPathMessages();

  return (
    <>
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
    </>
  );
};

export default ChatContainer; 