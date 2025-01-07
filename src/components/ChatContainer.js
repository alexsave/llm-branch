import React from 'react';
import { useChat } from '../contexts/ChatContext';
import ModelSettings from './ModelSettings';
import Message from './Message';

const ChatContainer = () => {
  const {
    input,
    setInput,
    isLoading,
    error,
    isChatVisible,
    setIsChatVisible,
    showSettings,
    setShowSettings,
    handleSubmit,
    selectedMessageId,
    handleBranch,
    getCurrentPathMessages,
  } = useChat();

  const messages = getCurrentPathMessages();

  const handleContainerClick = (e) => {
    if (!isChatVisible) {
      setIsChatVisible(true);
    }
  };

  return (
    <div 
      className={`chat-container ${isChatVisible ? 'visible' : 'hidden'}`}
      onClick={handleContainerClick}
    >
      {isChatVisible && (
        <button 
          className="chat-toggle down-arrow"
          onClick={(e) => {
            e.stopPropagation();
            setIsChatVisible(false);
          }}
          aria-label="Hide chat"
        >
        </button>
      )}
      {!isChatVisible && (
        <button 
          className="chat-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setIsChatVisible(true);
          }}
          aria-label="Show chat"
        >
          💬
        </button>
      )}
      <div className="messages">
        {messages.map((msg) => (
          <Message
            key={msg.id}
            message={msg}
            isSelected={selectedMessageId === msg.id}
            isActive={false}
            onBranch={handleBranch}
            isGraph={false}
          />
        ))}
      </div>
      {showSettings ? (
        <ModelSettings onClose={() => setShowSettings(false)} />
      ) : (
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
          <div className="button-group">
            <button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </button>
            <button
              type="button"
              className="settings-button"
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
            >
              ⚙️
            </button>
          </div>
        </form>
      )}
      {isLoading && <div className="loading">Thinking...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default ChatContainer; 