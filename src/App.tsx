import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { ExcelViewer } from './components/ExcelViewer';

function App() {
  const [excelHeight, setExcelHeight] = useState(192); // Default height in pixels

  return (
    <DndProvider backend={HTML5Backend}>
      {/* Main container with two independent scrolling columns */}
      <div className="flex h-screen bg-gray-50">
        {/* Left sidebar - independent scrolling */}
        <div className="sidebar w-80 h-screen overflow-y-auto bg-white border-r border-gray-200 flex-shrink-0">
          <Sidebar />
        </div>
        
        {/* Right workspace - independent scrolling */}
        <div className="workspace flex-1 h-screen overflow-y-auto flex flex-col">
          <Workspace />
        </div>
        
        {/* Excel viewer - overlay at bottom */}
        <ExcelViewer 
          height={excelHeight}
          onHeightChange={setExcelHeight}
        />
      </div>
    </DndProvider>
  );
}

export default App;