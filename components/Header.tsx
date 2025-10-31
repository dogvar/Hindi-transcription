
import React from 'react';
import type { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'video', label: 'Video Creator' },
    { id: 'generate', label: 'Image Generator' },
    { id: 'edit', label: 'Image Editor' },
  ];

  return (
    <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-between h-16 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.7,12.5a1,1,0,0,0,0-1.4l-3-3a1,1,0,0,0-1.4,1.4L10.59,12,8.3,14.29a1,1,0,0,0,0,1.4,1,1,0,0,0,1.4,0ZM12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"/>
            </svg>
            <h1 className="text-xl font-bold text-white">Creative Suite AI</h1>
          </div>
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <nav className="md:hidden border-t border-gray-700">
         <div className="flex justify-around p-2">
             {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 text-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
         </div>
      </nav>
    </header>
  );
};

export default Header;
