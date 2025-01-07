import React from 'react';
import Message from './Message';

const MessageNode = ({ data }) => {
  const { message, isSelected, isActive, onBranch } = data;
  const isPreview = message.isPreview;

  return (
    <Message
      message={message}
      isSelected={isSelected}
      isActive={isActive}
      onBranch={onBranch}
      isGraph={true}
      isPreview={isPreview}
    />
  );
};

export default MessageNode; 