import React from 'react';
import BaseModelHandler from './BaseModelHandler';

export const OLLAMA_MODELS = {
  LLAMA_3_2: 'llama3.2',
  CODE_LLAMA: 'codellama',
  MISTRAL: 'mistral',
  LLAMA_2: 'llama2'
};

class OllamaHandler extends BaseModelHandler {
  static defaultSettings = {
    url: 'http://localhost:11434',
    model: OLLAMA_MODELS.LLAMA_3_2,
    availableModels: Object.values(OLLAMA_MODELS)
  };

  static renderSettings(settings, onSettingChange) {
    return (
      <>
        <div className="setting-group">
          <label htmlFor="ollama-url">Ollama URL:</label>
          <input
            type="text"
            id="ollama-url"
            value={settings.url}
            onChange={(e) => onSettingChange('url', e.target.value)}
            placeholder="http://localhost:11434"
          />
          <small className="api-key-note">
            Ollama runs locally by default at http://localhost:11434
          </small>
        </div>
        <div className="setting-group">
          <label htmlFor="ollama-model">Ollama Model:</label>
          <select
            id="ollama-model"
            value={settings.model}
            onChange={(e) => onSettingChange('model', e.target.value)}
          >
            {Object.values(OLLAMA_MODELS).map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <small className="api-key-note">
            Select your installed Ollama model
          </small>
        </div>
      </>
    );
  }

  constructor(settings = {}) {
    super({
      ...OllamaHandler.defaultSettings,
      ...settings
    });
  }

  async fetchCompletion(messages) {
    const response = await fetch(`${this.modelSettings.url}/api/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.getRequestBody(messages)),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  getRequestBody(messages) {
    return {
      model: this.modelSettings.model,
      messages: this.formatMessages(messages),
      stream: true,
    };
  }

  async processLine(line, responseRef) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return false;

    try {
      const data = JSON.parse(trimmedLine);
      if (!data.done && data.message?.content) {
        responseRef.current += data.message.content;
        return true;
      }
    } catch (e) {
      console.error('Error parsing Ollama response:', e);
    }
    return false;
  }
}

export default OllamaHandler; 