import OpenAIHandler from './OpenAIHandler';
import AnthropicHandler from './AnthropicHandler';
import OllamaHandler from './OllamaHandler';
import DefaultHandler from './DefaultHandler';

class ModelHandlerFactory {
  static getHandler(type) {
    switch (type) {
      case 'openai':
        return OpenAIHandler;
      case 'anthropic':
        return AnthropicHandler;
      case 'ollama':
        return OllamaHandler;
      case 'default':
      default:
        return DefaultHandler;
    }
  }

  static createHandler(type, settings = {}) {
    const Handler = this.getHandler(type);
    return new Handler(settings);
  }

  static getAvailableModels(type) {
    const Handler = this.getHandler(type);
    return Handler.defaultSettings.availableModels;
  }
}

export default ModelHandlerFactory; 