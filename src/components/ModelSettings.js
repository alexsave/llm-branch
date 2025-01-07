import React from 'react';
import { useChat } from '../contexts/ChatContext';

const ModelSettings = ({ onClose }) => {
  const { modelSettings, updateModelSettings } = useChat();

  const handleModelChange = (e) => {
    updateModelSettings({
      ...modelSettings,
      selectedModel: e.target.value,
      // Reset API key and URL when changing models
      apiKey: '',
      ollamaUrl: e.target.value === 'ollama' ? 'http://localhost:11434' : '',
      ollamaModelName: e.target.value === 'ollama' ? 'llama3.2' : '',
      openaiModel: e.target.value === 'openai' ? 'gpt-3.5-turbo' : '',
      anthropicModel: e.target.value === 'anthropic' ? 'claude-3-opus-20240229' : '',
    });
  };

  const handleApiKeyChange = (e) => {
    updateModelSettings({
      ...modelSettings,
      apiKey: e.target.value,
    });
  };

  const handleOllamaUrlChange = (e) => {
    updateModelSettings({
      ...modelSettings,
      ollamaUrl: e.target.value,
    });
  };

  const handleOllamaModelChange = (e) => {
    updateModelSettings({
      ...modelSettings,
      ollamaModelName: e.target.value,
    });
  };

  const handleOpenAIModelChange = (e) => {
    updateModelSettings({
      ...modelSettings,
      openaiModel: e.target.value,
    });
  };

  const handleAnthropicModelChange = (e) => {
    updateModelSettings({
      ...modelSettings,
      anthropicModel: e.target.value,
    });
  };

  return (
    <div className="model-settings">
      <div className="settings-header">
        <h3>Model Settings</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="settings-content">
        <div className="setting-group">
          <label htmlFor="model-select">Provider:</label>
          <select 
            id="model-select" 
            value={modelSettings.selectedModel} 
            onChange={handleModelChange}
          >
            <option value="gpt-3.5-turbo">Default Server (GPT-3.5)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        
        {modelSettings.selectedModel === 'ollama' ? (
          <>
            <div className="setting-group">
              <label htmlFor="ollama-url">Ollama URL:</label>
              <input
                type="text"
                id="ollama-url"
                value={modelSettings.ollamaUrl || 'http://localhost:11434'}
                onChange={handleOllamaUrlChange}
                placeholder="http://localhost:11434"
              />
              <small className="api-key-note">
                Ollama runs locally by default at http://localhost:11434
              </small>
            </div>
            <div className="setting-group">
              <label htmlFor="ollama-model">Ollama Model:</label>
              <input
                type="text"
                id="ollama-model"
                value={modelSettings.ollamaModelName || 'llama3.2'}
                onChange={handleOllamaModelChange}
                placeholder="llama3.2"
              />
              <small className="api-key-note">
                Enter the name of your installed Ollama model (e.g., llama3.2, codellama, mistral)
              </small>
            </div>
          </>
        ) : modelSettings.selectedModel === 'openai' ? (
          <>
            <div className="setting-group">
              <label htmlFor="openai-model">OpenAI Model:</label>
              <select
                id="openai-model"
                value={modelSettings.openaiModel}
                onChange={handleOpenAIModelChange}
              >
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
            <div className="setting-group">
              <label htmlFor="api-key">OpenAI API Key:</label>
              <input
                type="password"
                id="api-key"
                value={modelSettings.apiKey || ''}
                onChange={handleApiKeyChange}
                placeholder="Enter your OpenAI API key"
              />
              <small className="api-key-note">
                Required for using OpenAI models directly
              </small>
            </div>
          </>
        ) : modelSettings.selectedModel === 'anthropic' && (
          <>
            <div className="setting-group">
              <label htmlFor="anthropic-model">Anthropic Model:</label>
              <select
                id="anthropic-model"
                value={modelSettings.anthropicModel}
                onChange={handleAnthropicModelChange}
              >
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                <option value="claude-2.1">Claude 2.1</option>
                <option value="claude-2.0">Claude 2.0</option>
              </select>
            </div>
            <div className="setting-group">
              <label htmlFor="api-key">Anthropic API Key:</label>
              <input
                type="password"
                id="api-key"
                value={modelSettings.apiKey || ''}
                onChange={handleApiKeyChange}
                placeholder="Enter your Anthropic API key"
              />
              <small className="api-key-note">
                Required for using Anthropic models
              </small>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelSettings; 