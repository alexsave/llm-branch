import BaseModelHandler from './BaseModelHandler';

class AnthropicHandler extends BaseModelHandler {
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
      model: this.modelSettings.anthropicModel,
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