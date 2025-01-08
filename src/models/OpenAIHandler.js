import React from 'react';
import BaseModelHandler from './BaseModelHandler';

export const OPENAI_MODELS = {
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo',
  O1: 'o1',
  O1_MINI: 'o1-mini',
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini'
};

class OpenAIHandler extends BaseModelHandler {
  static defaultSettings = {
    apiKey: '',
    model: OPENAI_MODELS.GPT_3_5_TURBO,
    availableModels: Object.values(OPENAI_MODELS)
  };

  static renderSettings(settings, onSettingChange) {
    return (
      <>
        <div className="setting-group">
          <label htmlFor="openai-model">OpenAI Model:</label>
          <select
            id="openai-model"
            value={settings.model}
            onChange={(e) => onSettingChange('model', e.target.value)}
          >
            {Object.values(OPENAI_MODELS).map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
        <div className="setting-group">
          <label htmlFor="api-key">OpenAI API Key:</label>
          <input
            type="password"
            id="api-key"
            value={settings.apiKey}
            onChange={(e) => onSettingChange('apiKey', e.target.value)}
            placeholder="Enter your OpenAI API key"
          />
          <small className="api-key-note">
            Required for using OpenAI models directly
          </small>
        </div>
      </>
    );
  }

  constructor(settings = {}) {
    super({
      ...OpenAIHandler.defaultSettings,
      ...settings
    });
  }

  async fetchCompletion(messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.getRequestBody(messages)),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  getHeaders() {
    return {
      ...super.getHeaders(),
      'Authorization': `Bearer ${this.modelSettings.apiKey}`,
    };
  }

  getRequestBody(messages) {
    return {
      ...super.getRequestBody(messages),
      model: this.modelSettings.model,
    };
  }

  async processLine(line, responseRef) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine === 'data: [DONE]') return false;

    if (trimmedLine.startsWith('data: ')) {
      try {
        const data = JSON.parse(trimmedLine.slice(6));
        if (data.choices?.[0]?.delta?.content) {
          responseRef.current += data.choices[0].delta.content;
          return true;
        }
      } catch (e) {
        console.error('Error parsing OpenAI response:', e);
      }
    }
    return false;
  }
}

export default OpenAIHandler; 