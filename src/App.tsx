import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { Layout } from './components/Layout';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { BoardsIndexPage } from './pages/BoardsIndexPage';
import { BoardPage } from './pages/BoardPage';
import { CollectionPage } from './pages/CollectionPage';
import { DiscoveryPage } from './pages/DiscoveryPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <Routes>
            <Route element={<Layout />}>
              
              {/* Main Feeds */}
              <Route path="/" element={<DashboardPage view="all" />} />
              <Route path="/community" element={<DashboardPage view="community" />} />
              <Route path="/favorites" element={<DashboardPage view="favorites" />} />
              
              {/* Boards */}
              <Route path="/boards" element={<BoardsIndexPage />} />
              <Route path="/board/:boardId" element={<BoardPage />} />
              
              {/* Collections */}
              <Route path="/collection/:collectionId" element={<CollectionPage />} />
              
              {/* Discovery */}
              <Route path="/discovery" element={<DiscoveryPage />} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
              
            </Route>
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;