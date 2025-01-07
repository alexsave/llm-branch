class BaseModelHandler {
  constructor(modelSettings) {
    this.modelSettings = modelSettings;
  }

  static renderSettings(settings, onSettingChange) {
    throw new Error('renderSettings must be implemented by subclass');
  }

  async fetchCompletion(messages) {
    throw new Error('fetchCompletion must be implemented by subclass');
  }

  async processChunk(chunk, responseRef) {
    throw new Error('processChunk must be implemented by subclass');
  }

  async processLine(line, responseRef) {
    throw new Error('processLine must be implemented by subclass');
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  getRequestBody(messages) {
    return {
      messages: this.formatMessages(messages),
      stream: true,
    };
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  async handleStream(response, responseRef, updateMessage) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      if (buffer.includes('\n')) {
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const updated = await this.processLine(line, responseRef);
          if (updated) {
            updateMessage(responseRef.current);
          }
        }
      } else {
        const updated = await this.processLine(buffer, responseRef);
        if (updated) {
          updateMessage(responseRef.current);
          buffer = '';
        }
      }
    }

    if (buffer) {
      const updated = await this.processLine(buffer, responseRef);
      if (updated) {
        updateMessage(responseRef.current);
      }
    }
  }
}

export default BaseModelHandler; 