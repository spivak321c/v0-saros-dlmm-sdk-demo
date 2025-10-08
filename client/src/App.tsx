import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppWalletProvider } from '../lib/wallet-provider';
import { queryClient } from '../lib/queryClient';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '../components/app-sidebar';
import Dashboard from '../pages/dashboard';
import Positions from '../pages/positions';
import Analytics from '../pages/analytics';
import Simulator from '../pages/simulator';
import Settings from '../pages/settings';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppWalletProvider>
        <BrowserRouter>
          <SidebarProvider>
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <main className="flex-1 bg-gray-50">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/positions" element={<Positions />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/simulator" element={<Simulator />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </div>
          </SidebarProvider>
        </BrowserRouter>
      </AppWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
