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
              min="10"
              max="20"
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
              min="8"
              max="16"
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
              min="8"
              max="14"
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

      {/* Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded p-2">
        <div className="text-xs text-gray-500 mb-1">Preview:</div>
        <div 
          className="font-medium text-gray-700 mb-1"
          style={{ fontSize: `${fontSettings.moduleNameSize}px` }}
        >
          Module 1
        </div>
        <div 
          className="text-gray-500 mb-1"
          style={{ fontSize: `${fontSettings.moduleInfoSize}px` }}
        >
          250×180mm • 3 products • Free: 50mm
        </div>
        <div 
          className="text-gray-700"
          style={{ fontSize: `${fontSettings.depthInfoSize}px` }}
        >
          Depth Capacity: Product1 6pcs
        </div>
      </div>
    </div>
  );
};