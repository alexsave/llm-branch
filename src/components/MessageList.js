import React from 'react';
import Message from './Message';

const MessageList = ({ messages, selectedMessageId, handleBranch }) => {
  return (
    <div className="messages">
      {messages.map((msg) => (
        <Message
          key={msg.id}
          message={msg}
          isSelected={selectedMessageId === msg.id}
          onBranch={handleBranch}
        />
      ))}
    </div>
  );
};

export default MessageList; 