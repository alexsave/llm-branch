import OpenAIClient from './OpenAIClient';
import AnthropicClient from './AnthropicClient';
import OllamaClient from './OllamaClient';
import DefaultClient from './DefaultClient';

class ModelFactory {
  static createClient(type, settings = {}) {
    switch (type) {
      case 'openai':
        return new OpenAIClient(settings);
      case 'anthropic':
        return new AnthropicClient(settings);
      case 'ollama':
        return new OllamaClient(settings);
      case 'default':
      default:
        return new DefaultClient(settings);
    }
  }

  static getAvailableModels(type) {
    switch (type) {
      case 'openai':
        return OpenAIClient.defaultSettings.availableModels;
      case 'anthropic':
        return AnthropicClient.defaultSettings.availableModels;
      case 'ollama':
        return OllamaClient.defaultSettings.availableModels;
      case 'default':
      default:
        return [DefaultClient.defaultSettings.model];
    }
  }
}

export default ModelFactory; 