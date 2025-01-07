import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Handle, Position } from 'reactflow';

const Message = ({ message, isSelected, isActive, onBranch, isGraph = false, isPreview = false }) => {
  const isAssistant = message.role === 'assistant';
  const modelFamily = isAssistant ? message.modelFamily || 'default' : 'user';
  const isClickable = isAssistant && !isSelected && !isPreview;

  return (
    <div 
      className={`message ${message.role} ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''} ${isPreview ? 'preview' : ''} ${isClickable ? 'clickable' : ''}`}
      onClick={() => isClickable && onBranch && onBranch(message.id)}
      style={{
        cursor: isClickable ? 'pointer' : 'default',
        opacity: isPreview ? 0.7 : 1,
      }}
      data-model-family={modelFamily}
    >
      {isGraph && <Handle type="target" position={Position.Top} />}
      <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
      <div className="message-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {!isPreview && isAssistant && (
        <>
          {isClickable && (
            <div className="message-actions">
              <span className="reply-label">Click to reply</span>
            </div>
          )}
          <div className="model-info">{message.model}</div>
        </>
      )}
      {isGraph && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
};

export default Message; 