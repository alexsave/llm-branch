import React from 'react';

const Message = ({ message, isSelected, onBranch }) => {
  return (
    <div 
      className={`message ${message.role} ${isSelected ? 'selected' : ''}`}
      onClick={() => onBranch(message.id)}
    >
      <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
      <p>{message.content}</p>
      <div className="message-actions">
        {message.role === 'assistant' && (
          <span className="reply-label">Click to reply</span>
        )}
      </div>
    </div>
  );
};

export default Message; 