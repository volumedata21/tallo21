import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// --- Error Boundary to catch "White Screen" crashes ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Critical App Error:", error, errorInfo);
  }

  handleHardReset = () => {
    // Nuke local storage to fix "Ghost Session"
    localStorage.clear();
    sessionStorage.clear();
    // Force reload ignoring cache
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          width: '100vw', 
          backgroundColor: '#0f172a', 
          color: '#e2e8f0', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '2rem'
        }}>
          <h1 style={{ color: '#f43f5e', fontSize: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>Application Crashed</h1>
          <p style={{ marginBottom: '2rem', textAlign: 'center', maxWidth: '600px', lineHeight: '1.5' }}>
            The app encountered a critical error. This usually happens when local data is out of sync with the server (e.g., after deleting the /data folder).
          </p>
          
          <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '2rem', maxWidth: '80%', overflow: 'auto' }}>
            <code style={{ color: '#fca5a5' }}>{this.state.error?.message}</code>
          </div>

          <button 
            onClick={this.handleHardReset}
            style={{
              backgroundColor: '#e11d48',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(225, 29, 72, 0.4)'
            }}
          >
            Reset Application Data (Fix Stuck Login)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);