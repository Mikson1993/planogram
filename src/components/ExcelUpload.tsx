import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import { usePlanogramStore } from '../stores/planogramStore';
import { parseExcelFile } from '../utils/excelUtils';

export const ExcelUpload: React.FC = () => {
  const { 
    excelData, 
    setExcelData, 
    originalExcelFile, 
    setOriginalExcelFile,
    syncWithExcelData 
  } = usePlanogramStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const products = await parseExcelFile(file);
      setExcelData(products);
      setOriginalExcelFile(file);
      
      // Sync with existing workspace if there are modules
      syncWithExcelData();
      
    } catch (err) {
      console.error('Failed to parse Excel file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
    } finally {
      setIsLoading(false);
    }
  }, [setExcelData, setOriginalExcelFile, syncWithExcelData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeExcelData = () => {
    setExcelData(null);
    setOriginalExcelFile(null);
    setError(null);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Excel Product Data</h3>
      
      {excelData ? (
        <div className="relative">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <div>
                  <div className="text-sm font-medium text-green-800">
                    Excel file loaded & synced
                  </div>
                  <div className="text-xs text-green-600">
                    {excelData.length} products found
                  </div>
                </div>
              </div>
              <button
                onClick={removeExcelData}
                className="text-green-600 hover:text-green-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Module summary */}
            <div className="mt-2 text-xs text-green-700">
              Modules: {[...new Set(excelData.map(p => p.module))].join(', ')}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <div className="text-sm text-gray-600">Processing Excel file...</div>
            </div>
          ) : (
            <>
              <FileSpreadsheet className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <div className="text-sm text-gray-600 mb-2">
                Drop Excel file here or click to upload
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                id="excel-upload"
              />
              <label
                htmlFor="excel-upload"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Choose Excel File
              </label>
            </>
          )}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
        <div className="font-medium mb-1">Excel Requirements:</div>
        <ul className="space-y-1">
          <li>• Column with EAN codes (13 digits)</li>
          <li>• Column named "Module" with module numbers</li>
          <li>• Column named "Szerokość" with product widths in mm</li>
          <li>• Optional: "Wysokość" column for heights</li>
          <li>• <strong>Auto-syncs with existing workspace!</strong></li>
        </ul>
      </div>
    </div>
  );
};