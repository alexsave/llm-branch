import { ReactFlowProvider } from 'reactflow';
import { ChatProvider } from './contexts/ChatContext';
import { GraphProvider } from './contexts/GraphContext';
import ChatContainer from './components/ChatContainer';
import GraphView from './components/GraphView';
import './App.css';

function App() {
  return (
    <div className="App">
      <ChatProvider>
        <GraphProvider>
          <ReactFlowProvider>
            <GraphView />
          </ReactFlowProvider>
          <ChatContainer />
        </GraphProvider>
      </ChatProvider>
    </div>
  );
}

export default App;
