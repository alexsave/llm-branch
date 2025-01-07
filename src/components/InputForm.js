import React from 'react';

const InputForm = ({ input, setInput, handleSubmit, isLoading }) => {
  return (
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
  );
};

export default InputForm; 