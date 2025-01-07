import React from 'react';
import ReactMarkdown from 'react-markdown';

const Message = ({ message, isSelected, onBranch }) => {
  return (
    <div 
      className={`message ${message.role} ${isSelected ? 'selected' : ''}`}
      onClick={() => onBranch(message.id)}
    >
      <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
      <div className="message-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      <div className="message-actions">
        {message.role === 'assistant' && (
          <span className="reply-label">Click to reply</span>
        )}
      </div>
    </div>
  );
};

export default Message; 