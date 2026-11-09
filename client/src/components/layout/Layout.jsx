import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex flex-col">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-3.5 sm:p-6 animate-fade-in min-w-0 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
