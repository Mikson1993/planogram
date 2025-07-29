import React, { useEffect, useRef, useState } from 'react';
import { usePlanogramStore } from '../stores/planogramStore';
import { FileSpreadsheet, Download, Edit3, Save, X, GripHorizontal } from 'lucide-react';
import { generateUpdatedExcel } from '../utils/excelUtils';
import clsx from 'clsx';

interface ExcelViewerProps {
  height: number;
  onHeightChange: (height: number) => void;
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({ height, onHeightChange }) => {
  const { 
    excelData, 
    selectedModule, 
    selectedProduct, 
    modules,
    originalExcelFile,
    updateExcelData,
    syncWithExcelData
  } = usePlanogramStore();
  
  const tableRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isResizing, setIsResizing] = useState(false);

  // Handle resizing
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY; // Inverted because we're resizing from top
      const newHeight = Math.min(Math.max(startHeight + deltaY, 100), window.innerHeight * 0.8); // Min 100px, max 80% of screen
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Auto-scroll to selected product
  useEffect(() => {
    if (!excelData || !selectedProduct || !tableRef.current) return;

    const selectedProductData = modules
      .flatMap(m => m.products)
      .find(p => p.id === selectedProduct);

    if (!selectedProductData?.ean) return;

    const rowIndex = excelData.findIndex(item => 
      item.ean === selectedProductData.ean || 
      item.originalEan === selectedProductData.originalEan
    );
    if (rowIndex === -1) return;

    const rowElement = tableRef.current.querySelector(`[data-row="${rowIndex}"]`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedProduct, excelData, modules]);

  // Auto-scroll to selected module products
  useEffect(() => {
    if (!excelData || !selectedModule || !tableRef.current) return;

    const moduleNumber = selectedModule.replace('module-', '');
    const moduleProducts = excelData.filter(item => item.module === moduleNumber);
    
    if (moduleProducts.length === 0) return;

    // Find first product of the selected module
    const firstProductIndex = excelData.findIndex(item => item.module === moduleNumber);
    if (firstProductIndex === -1) return;

    const rowElement = tableRef.current.querySelector(`[data-row="${firstProductIndex}"]`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedModule, excelData]);

  const handleDownloadUpdatedExcel = async () => {
    if (!originalExcelFile || !excelData) return;

    try {
      const updatedBlob = await generateUpdatedExcel(originalExcelFile, excelData);
      const url = URL.createObjectURL(updatedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `updated_${originalExcelFile.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate updated Excel:', error);
      alert('Failed to generate updated Excel file');
    }
  };

  const handleCellEdit = (rowIndex: number, field: string, currentValue: any) => {
    setEditingCell({ row: rowIndex, field });
    setEditValue(String(currentValue || ''));
  };

  const handleSaveEdit = () => {
    if (!editingCell || !excelData) return;

    const updatedData = [...excelData];
    const item = updatedData[editingCell.row];
    
    if (editingCell.field === 'width' || editingCell.field === 'height' || editingCell.field === 'depth') {
      const numValue = parseFloat(editValue);
      if (!isNaN(numValue) && numValue > 0) {
        (item as any)[editingCell.field] = numValue;
      }
    } else if (editingCell.field === 'position') {
      const numValue = parseFloat(editValue);
      if (!isNaN(numValue) && numValue >= 0) {
        (item as any)[editingCell.field] = numValue;
      }
    } else {
      (item as any)[editingCell.field] = editValue;
    }

    updateExcelData(updatedData);
    
    // Sync changes with workspace
    syncWithExcelData();
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (!excelData || excelData.length === 0) {
    return (
      <div 
        className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 flex flex-col z-50"
        style={{ height: `${height}px` }}
      >
        {/* Resize Handle */}
        <div
          className={clsx(
            'w-full h-2 bg-gray-200 border-b border-gray-300 cursor-row-resize flex items-center justify-center hover:bg-gray-300 transition-colors',
            isResizing && 'bg-blue-300'
          )}
          onMouseDown={handleResizeStart}
        >
          <GripHorizontal className="w-4 h-4 text-gray-500" />
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No Excel data loaded</div>
            <div className="text-xs">Upload an Excel file to see product data</div>
          </div>
        </div>
      </div>
    );
  }

  // Get selected product EAN for highlighting
  const selectedProductData = selectedProduct 
    ? modules.flatMap(m => m.products).find(p => p.id === selectedProduct)
    : null;
  const selectedEAN = selectedProductData?.ean || selectedProductData?.originalEan;

  // Get selected module number for highlighting
  const selectedModuleNumber = selectedModule ? selectedModule.replace('module-', '') : null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex flex-col z-50"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div
        className={clsx(
          'w-full h-2 bg-gray-200 border-b border-gray-300 cursor-row-resize flex items-center justify-center hover:bg-gray-300 transition-colors',
          isResizing && 'bg-blue-300'
        )}
        onMouseDown={handleResizeStart}
      >
        <GripHorizontal className="w-4 h-4 text-gray-500" />
        {isResizing && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full bg-gray-800 text-white px-2 py-1 rounded text-xs">
            {Math.round(height)}px
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            Excel Data ({excelData.length} products) - Editable
          </span>
          {selectedModule && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Showing Module {selectedModuleNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">
            Click any cell to edit • Enter to save • Esc to cancel • Drag top edge to resize
          </div>
          <button
            onClick={handleDownloadUpdatedExcel}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download Updated
          </button>
        </div>
      </div>

      {/* Table */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">EAN</th>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">Module</th>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">Position</th>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">Width (mm)</th>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">Height (mm)</th>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">Depth (mm)</th>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">Name</th>
              <th className="px-2 py-1 text-left border-b border-gray-200 font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {excelData.map((item, index) => {
              const isSelectedProduct = selectedEAN === item.ean || selectedEAN === item.originalEan;
              const isSelectedModuleProduct = selectedModuleNumber === item.module;
              const isDuplicate = item.duplicateIndex && item.duplicateIndex > 0;
              
              return (
                <tr
                  key={`${item.ean}-${index}`}
                  data-row={index}
                  className={clsx(
                    'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                    isSelectedProduct && 'bg-blue-50 border-blue-200 ring-1 ring-blue-300',
                    !isSelectedProduct && isSelectedModuleProduct && 'bg-blue-25 border-blue-100',
                    isDuplicate && 'bg-yellow-25 border-yellow-100'
                  )}
                >
                  <td className="px-2 py-1 font-mono">
                    <div className="flex items-center gap-1">
                      {item.originalEan || item.ean}
                      {isDuplicate && (
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-1 rounded">
                          #{item.duplicateIndex! + 1}
                        </span>
                      )}
                    </div>
                  </td>
                  <td 
                    className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleCellEdit(index, 'module', item.module)}
                  >
                    {editingCell?.row === index && editingCell?.field === 'module' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800">
                          <Save className="w-3 h-3" />
                        </button>
                        <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-800">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-xs font-medium flex items-center gap-1',
                        isSelectedModuleProduct
                          ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300' 
                          : 'bg-gray-100 text-gray-700'
                      )}>
                        {item.module}
                        <Edit3 className="w-2 h-2 opacity-50" />
                      </span>
                    )}
                  </td>
                  <td 
                    className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleCellEdit(index, 'position', item.position)}
                  >
                    {editingCell?.row === index && editingCell?.field === 'position' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800">
                          <Save className="w-3 h-3" />
                        </button>
                        <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-800">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-xs font-medium',
                          item.position && item.position > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        )}>
                          {item.position ? item.position.toFixed(2) : '-'}
                        </span>
                        <Edit3 className="w-2 h-2 opacity-50" />
                      </span>
                    )}
                  </td>
                  <td 
                    className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleCellEdit(index, 'width', item.width)}
                  >
                    {editingCell?.row === index && editingCell?.field === 'width' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800">
                          <Save className="w-3 h-3" />
                        </button>
                        <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-800">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1">
                        {Math.round(item.width)}
                        <Edit3 className="w-2 h-2 opacity-50" />
                      </span>
                    )}
                  </td>
                  <td 
                    className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleCellEdit(index, 'height', item.height)}
                  >
                    {editingCell?.row === index && editingCell?.field === 'height' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800">
                          <Save className="w-3 h-3" />
                        </button>
                        <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-800">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1">
                        {item.height ? Math.round(item.height) : '-'}
                        <Edit3 className="w-2 h-2 opacity-50" />
                      </span>
                    )}
                  </td>
                  <td 
                    className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleCellEdit(index, 'depth', item.depth)}
                  >
                    {editingCell?.row === index && editingCell?.field === 'depth' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800">
                          <Save className="w-3 h-3" />
                        </button>
                        <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-800">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1">
                        {item.depth ? Math.round(item.depth) : '-'}
                        <Edit3 className="w-2 h-2 opacity-50" />
                      </span>
                    )}
                  </td>
                  <td 
                    className="px-2 py-1 truncate max-w-32 cursor-pointer hover:bg-gray-100" 
                    title={item.name}
                    onClick={() => handleCellEdit(index, 'name', item.name)}
                  >
                    {editingCell?.row === index && editingCell?.field === 'name' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800">
                          <Save className="w-3 h-3" />
                        </button>
                        <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-800">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1">
                        {item.name || '-'}
                        <Edit3 className="w-2 h-2 opacity-50" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <span className={clsx(
                      'px-1.5 py-0.5 rounded text-xs font-medium',
                      item.quantity && item.quantity > 1
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-600'
                    )}>
                      {item.quantity || 1}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};