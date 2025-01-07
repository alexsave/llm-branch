import OpenAIHandler from './OpenAIHandler';
import AnthropicHandler from './AnthropicHandler';
import OllamaHandler from './OllamaHandler';
import DefaultHandler from './DefaultHandler';

class ModelHandlerFactory {
  static createHandler(modelSettings) {
    const modelFamily = modelSettings.selectedModel === 'openai' ? 'openai' :
                       modelSettings.selectedModel === 'anthropic' ? 'anthropic' :
                       modelSettings.selectedModel === 'ollama' ? 'ollama' :
                       'default';

    switch (modelFamily) {
      case 'openai':
        return new OpenAIHandler(modelSettings);
      case 'anthropic':
        return new AnthropicHandler(modelSettings);
      case 'ollama':
        return new OllamaHandler(modelSettings);
      case 'default':
        return new DefaultHandler(modelSettings);
      default:
        throw new Error('Unsupported model family');
    }
  }
}

export default ModelHandlerFactory; 