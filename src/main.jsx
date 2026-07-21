import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initSentry } from './observability/sentry';
import { installChunkReloadHandler } from './observability/chunkReload';
import { WebVitals } from './observability/analytics';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';

initSentry();
installChunkReloadHandler();

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary variant="full">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WebVitals />
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
