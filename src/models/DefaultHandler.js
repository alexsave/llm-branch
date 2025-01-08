import BaseModelHandler from './BaseModelHandler';

export const DEFAULT_MODELS = {
  GPT_3_5_TURBO: 'gpt-3.5-turbo'
};

class DefaultHandler extends BaseModelHandler {
  static defaultSettings = {
    model: DEFAULT_MODELS.GPT_3_5_TURBO,
    availableModels: Object.values(DEFAULT_MODELS)
  };

  static renderSettings(settings, onSettingChange) {
    // Default server has no settings to configure
    return null;
  }

  constructor(settings = {}) {
    super({
      ...DefaultHandler.defaultSettings,
      ...settings
    });
  }

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

  async processLine(line, responseRef) {
    if (!line) return false;
    responseRef.current += line;
    return true;
  }
}

export default DefaultHandler; 