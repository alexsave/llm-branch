import BaseModelHandler from './BaseModelHandler';

class OpenAIHandler extends BaseModelHandler {
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
      model: this.modelSettings.openaiModel,
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