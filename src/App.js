import logo from './logo.svg';
import './App.css';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

function App() {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const callFunction = async () => {
      const { data, error } = await supabase.functions.invoke('hello-world', {
        body: { name: 'Deez Nuts' }
      });

      if (error) {
        setError(error.message);
      } else {
        setResponse(data);
      }
    };

    // Call the function after 3 seconds
    const timer = setTimeout(() => {
      callFunction();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {error ? (
          <p style={{ color: 'red' }}>Error: {error}</p>
        ) : response ? (
          <div>
            <h2>Function Response:</h2>
            <pre style={{ textAlign: 'left', maxWidth: '80%', overflow: 'auto' }}>
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        ) : (
          <p>Loading function response...</p>
        )}
      </header>
    </div>
  );
}

export default App;
