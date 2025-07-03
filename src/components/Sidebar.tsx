import React, { useEffect, useRef } from 'react';
import { Plus, Upload, Download, RotateCcw, Settings } from 'lucide-react';
import { usePlanogramStore } from '../stores/planogramStore';
import { ModuleList } from './ModuleList';
import { FileUpload } from './FileUpload';
import { BackgroundUpload } from './BackgroundUpload';
import { ExcelUpload } from './ExcelUpload';
import { SmartFileUpload } from './SmartFileUpload';
import { FontSettings } from './FontSettings';

export const Sidebar: React.FC = () => {
  const scrollableRef = useRef<HTMLDivElement>(null);
  
  const { 
    modules, 
    selectedModule, 
    addModule, 
    exportConfig, 
    importConfig, 
    resetPlanogram,
    excelData
  } = usePlanogramStore();

  // Test scrolling functionality
  useEffect(() => {
    if (!scrollableRef.current) return;

    const scrollableElement = scrollableRef.current;
    
    // Log scroll properties for debugging
    console.log('Sidebar scroll properties:', {
      scrollHeight: scrollableElement.scrollHeight,
      clientHeight: scrollableElement.clientHeight,
      scrollTop: scrollableElement.scrollTop,
      overflowY: window.getComputedStyle(scrollableElement).overflowY,
      canScroll: scrollableElement.scrollHeight > scrollableElement.clientHeight
    });
  }, [modules.length, excelData]);

  const handleAddModule = () => {
    addModule({
      name: `Module ${modules.length + 1}`,
      width: 250,
      height: 180,
      depth: 300, // Default depth
      x: 50 + modules.length * 50,
      y: 50 + modules.length * 50,
    });
  };

  const handleExportConfig = () => {
    const config = exportConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planogram-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        importConfig(config);
      } catch (error) {
        console.error('Failed to import configuration:', error);
        alert('Invalid configuration file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div 
      ref={scrollableRef}
      className="h-full flex flex-col"
    >
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          Planogram Designer
        </h1>
        
        {/* Action Buttons - Always visible */}
        <div className="space-y-2">
          <button
            onClick={handleAddModule}
            className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Module
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportConfig}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-sm">
              <Upload className="w-4 h-4" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportConfig}
                className="hidden"
              />
            </label>
          </div>
          
          <button
            onClick={resetPlanogram}
            className="w-full flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Excel Upload */}
        <div className="border-b border-gray-200 p-4">
          <ExcelUpload />
        </div>

        {/* Smart File Upload */}
        <div className="border-b border-gray-200 p-4">
          <SmartFileUpload />
        </div>

        {/* Background Upload */}
        <div className="border-b border-gray-200 p-4">
          <BackgroundUpload />
        </div>

        {/* Font Settings */}
        <div className="border-b border-gray-200 p-4">
          <FontSettings />
        </div>

        {/* Module List */}
        <div className="p-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Modules ({modules.length})
          </h2>
          <ModuleList />
        </div>

        {/* Manual File Upload Section - only show if no Excel data or module selected */}
        {(!excelData && selectedModule) && (
          <div className="border-t border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Manual Upload
            </h3>
            <FileUpload moduleId={selectedModule} />
          </div>
        )}

        {/* Extra space to ensure scrolling works */}
        <div className="h-32 flex-shrink-0"></div>
      </div>
      
      {/* Footer - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Settings className="w-4 h-4" />
          Scale: 1px = 1mm
          {excelData && (
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded">
              Excel: {excelData.length} products
            </span>
          )}
        </div>
      </div>
    </div>
  );
};