import React from 'react';
import { useChat } from '../contexts/ChatContext';
import ModelHandlerFactory from '../models/ModelHandlerFactory';

const ModelSettings = ({ onClose }) => {
  const { selectedModelType, updateModelType, modelSettings, updateModelSettings } = useChat();

  const handleModelTypeChange = (e) => {
    const newType = e.target.value;
    updateModelType(newType);
  };

  const handleSettingChange = (setting, value) => {
    updateModelSettings(selectedModelType, {
      [setting]: value
    });
  };

  return (
    <div className="model-settings">
      <div className="settings-header">
        <h3>Model Settings</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="settings-content">
        <div className="setting-group">
          <label htmlFor="model-select">Provider:</label>
          <select 
            id="model-select" 
            value={selectedModelType} 
            onChange={handleModelTypeChange}
          >
            <option value="default">Default Server (GPT-3.5)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        
        {ModelHandlerFactory.getHandler(selectedModelType).renderSettings(
          modelSettings[selectedModelType],
          handleSettingChange
        )}
      </div>
    </div>
  );
};

export default ModelSettings; 