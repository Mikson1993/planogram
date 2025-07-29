import React from 'react';
import { Type } from 'lucide-react';
import { usePlanogramStore } from '../stores/planogramStore';

export const FontSettings: React.FC = () => {
  const { fontSettings, setFontSettings } = usePlanogramStore();

  const handleFontSizeChange = (setting: keyof typeof fontSettings, value: number) => {
    setFontSettings({ [setting]: value });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Type className="w-4 h-4" />
        Font Settings
      </h3>
      
      <div className="space-y-3">
        {/* Module Name Font Size */}
        <div>
          <label className="text-xs text-gray-600 block mb-1">
            Module Name Size
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="2"
              max="30"
              value={fontSettings.moduleNameSize}
              onChange={(e) => handleFontSizeChange('moduleNameSize', parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {fontSettings.moduleNameSize}px
            </span>
          </div>
        </div>

        {/* Module Info Font Size */}
        <div>
          <label className="text-xs text-gray-600 block mb-1">
            Module Info Size (dimensions, products, free space)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="2"
              max="30"
              value={fontSettings.moduleInfoSize}
              onChange={(e) => handleFontSizeChange('moduleInfoSize', parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {fontSettings.moduleInfoSize}px
            </span>
          </div>
        </div>

        {/* Depth Info Font Size */}
        <div>
          <label className="text-xs text-gray-600 block mb-1">
            Depth Capacity Size
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="2"
              max="30"
              value={fontSettings.depthInfoSize}
              onChange={(e) => handleFontSizeChange('depthInfoSize', parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {fontSettings.depthInfoSize}px
            </span>
          </div>
        </div>
      </div>

      {/* Visibility Controls */}
      <div className="space-y-3 border-t border-gray-200 pt-3">
        <h4 className="text-xs font-medium text-gray-600">Visibility Controls</h4>
        
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fontSettings.showModuleName}
              onChange={(e) => setFontSettings({ showModuleName: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">Show Module Names</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fontSettings.showModuleInfo}
              onChange={(e) => setFontSettings({ showModuleInfo: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">Show Module Info (dimensions, products, free space)</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fontSettings.showDepthInfo}
              onChange={(e) => setFontSettings({ showDepthInfo: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">Show Depth Capacity Info</span>
          </label>
        </div>
      </div>
      {/* Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded p-2">
        <div className="text-xs text-gray-500 mb-1">Preview:</div>
        <div 
          className="font-medium text-gray-700 mb-1"
          style={{ fontSize: `${fontSettings.moduleNameSize}px` }}
        >
          {fontSettings.showModuleName ? 'Module 1' : ''}
        </div>
        <div 
          className="text-gray-500 mb-1"
          style={{ fontSize: `${fontSettings.moduleInfoSize}px` }}
        >
          {fontSettings.showModuleInfo ? '250×180mm • 3 products • Free: 50mm' : ''}
        </div>
        <div 
          className="text-gray-700"
          style={{ fontSize: `${fontSettings.depthInfoSize}px` }}
        >
          {fontSettings.showDepthInfo ? 'Depth Capacity: Product1 6pcs' : ''}
        </div>
      </div>
    </div>
  );
};