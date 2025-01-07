import React from 'react';
import { Handle, Position } from 'reactflow';

const MessageNode = ({ data }) => {
  const { message, isSelected, isActive, onBranch } = data;
  const isAssistant = message.role === 'assistant';
  const isPreview = message.isPreview;

  return (
    <div
      className={`message ${message.role} ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''} ${isPreview ? 'preview' : ''}`}
      onClick={() => isAssistant && onBranch(message.id)}
      style={{
        cursor: isAssistant ? 'pointer' : 'default',
        opacity: isPreview ? 0.7 : 1,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
      <p>{message.content}</p>
      {!isPreview && isAssistant && (
        <div className="message-actions">
          <span className="reply-label">Click to reply</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default MessageNode; 