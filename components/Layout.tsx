import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative transition-all duration-300 ease-in-out antialiased">
        <MobileHeader onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-12 lg:py-14 scroll-smooth">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
