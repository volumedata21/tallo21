import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Import as sibling

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);