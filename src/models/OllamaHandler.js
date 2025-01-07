import BaseModelHandler from './BaseModelHandler';

class OllamaHandler extends BaseModelHandler {
  async fetchCompletion(messages) {
    const response = await fetch(`${this.modelSettings.ollamaUrl}/api/chat`, {
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
      model: this.modelSettings.ollamaModelName || 'llama2',
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