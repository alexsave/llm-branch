import React from 'react';
import BaseModelHandler from './BaseModelHandler';

export const ANTHROPIC_MODELS = {
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  CLAUDE_2_1: 'claude-2.1',
  CLAUDE_2_0: 'claude-2.0'
};

class AnthropicHandler extends BaseModelHandler {
  static defaultSettings = {
    apiKey: '',
    model: ANTHROPIC_MODELS.CLAUDE_3_OPUS,
    availableModels: Object.values(ANTHROPIC_MODELS)
  };

  static renderSettings(settings, onSettingChange) {
    return (
      <>
        <div className="setting-group">
          <label htmlFor="anthropic-model">Anthropic Model:</label>
          <select
            id="anthropic-model"
            value={settings.model}
            onChange={(e) => onSettingChange('model', e.target.value)}
          >
            {Object.values(ANTHROPIC_MODELS).map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
        <div className="setting-group">
          <label htmlFor="api-key">Anthropic API Key:</label>
          <input
            type="password"
            id="api-key"
            value={settings.apiKey}
            onChange={(e) => onSettingChange('apiKey', e.target.value)}
            placeholder="Enter your Anthropic API key"
          />
          <small className="api-key-note">
            Required for using Anthropic models
          </small>
        </div>
      </>
    );
  }

  constructor(settings = {}) {
    super({
      ...AnthropicHandler.defaultSettings,
      ...settings
    });
  }

  async fetchCompletion(messages) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      'x-api-key': this.modelSettings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }

  getRequestBody(messages) {
    return {
      model: this.modelSettings.model,
      max_tokens: 1024,
      messages: this.formatMessages(messages),
      stream: true,
    };
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  async processLine(line, responseRef) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine === 'data: [DONE]') return false;

    if (trimmedLine.startsWith('data: ')) {
      try {
        const data = JSON.parse(trimmedLine.slice(6));
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          responseRef.current += data.delta.text;
          return true;
        }
      } catch (e) {
        console.error('Error parsing Anthropic response:', e);
      }
    }
    return false;
  }
}

export default AnthropicHandler; 