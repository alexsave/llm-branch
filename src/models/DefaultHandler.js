import BaseModelHandler from './BaseModelHandler';

class DefaultHandler extends BaseModelHandler {
  async fetchCompletion(messages) {
    const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/chat-stream`, {
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
      'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_KEY}`,
    };
  }

  getRequestBody(messages) {
    return {
      messages: this.formatMessages(messages),
    };
  }

  async handleStream(response, responseRef, updateMessage) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (chunk.trim()) {
        responseRef.current += chunk;
        updateMessage(responseRef.current);
      }
    }
  }
}

export default DefaultHandler; 