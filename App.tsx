
import React, { useState } from 'react';
import Header from './components/Header';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import VideoCreator from './components/VideoCreator';
import type { ActiveTab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('video');

  const renderContent = () => {
    switch (activeTab) {
      case 'generate':
        return <ImageGenerator />;
      case 'edit':
        return <ImageEditor />;
      case 'video':
        return <VideoCreator />;
      default:
        return <VideoCreator />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
