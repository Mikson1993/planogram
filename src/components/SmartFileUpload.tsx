import React, { useCallback, useState } from 'react';
import { Upload, Image as ImageIcon, CheckCircle, AlertTriangle } from 'lucide-react';
import { usePlanogramStore } from '../stores/planogramStore';
import { extractEAN } from '../utils/excelUtils';

export const SmartFileUpload: React.FC = () => {
  const { 
    excelData, 
    modules, 
    addProductFromExcel, 
    ensureModuleExists 
  } = usePlanogramStore();
  
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    duplicated: number;
    failed: Array<{ filename: string; reason: string }>;
  } | null>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || !excelData) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const results = {
      success: 0,
      duplicated: 0,
      failed: [] as Array<{ filename: string; reason: string }>
    };

    for (const file of imageFiles) {
      try {
        // Extract EAN from filename
        const ean = extractEAN(file.name);
        if (!ean) {
          results.failed.push({
            filename: file.name,
            reason: 'No 13-digit EAN found in filename'
          });
          continue;
        }

        // Find all products with this EAN (including duplicates)
        const matchingProducts = excelData.filter(p => 
          p.originalEan === ean || p.ean === ean || p.ean.startsWith(ean + '_')
        );
        
        if (matchingProducts.length === 0) {
          results.failed.push({
            filename: file.name,
            reason: `EAN ${ean} not found in Excel data`
          });
          continue;
        }

        // Process each matching product (handles duplicates)
        for (const productData of matchingProducts) {
          // Ensure module exists
          const moduleId = `module-${productData.module}`;
          ensureModuleExists(moduleId, `Module ${productData.module}`);

          // Create image URL
          const imageUrl = URL.createObjectURL(file);
          
          // Create image to get dimensions
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });

          // Calculate scaled dimensions based on real width from Excel
          const realWidthMm = productData.width;
          const aspectRatio = img.width / img.height;
          const realHeightMm = productData.height || (realWidthMm / aspectRatio);
          
          // Scale to pixels (1mm = 1px for now)
          const scaledWidth = realWidthMm;
          const scaledHeight = realHeightMm;

          // Add product to module with position from Excel
          addProductFromExcel(moduleId, {
            name: productData.name || file.name.replace(/\.[^/.]+$/, ''),
            imageUrl,
            originalWidth: img.width,
            originalHeight: img.height,
            scaledWidth,
            scaledHeight,
            ean: productData.ean, // Use the EAN with duplicate suffix if applicable
            originalEan: productData.originalEan || ean, // Store original EAN
            realWidth: realWidthMm,
            realHeight: realHeightMm,
            position: productData.position, // Include position for vertical stacking
            quantity: productData.quantity,
          });

          if (productData.duplicateIndex && productData.duplicateIndex > 0) {
            results.duplicated++;
          } else {
            results.success++;
          }
        }
        
      } catch (error) {
        console.error('Failed to process file:', file.name, error);
        results.failed.push({
          filename: file.name,
          reason: 'Failed to process image'
        });
      }
    }

    setUploadResults(results);
    
    // Clear results after 5 seconds
    setTimeout(() => setUploadResults(null), 5000);
    
  }, [excelData, addProductFromExcel, ensureModuleExists]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (!excelData) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <div className="text-sm text-amber-800">
            Upload Excel file first to enable smart product assignment
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Smart Product Upload</h3>
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-green-300 rounded-lg p-4 text-center hover:border-green-400 transition-colors cursor-pointer bg-green-50"
      >
        <Upload className="w-6 h-6 text-green-600 mx-auto mb-2" />
        <div className="text-sm text-green-800 mb-2">
          Drop product images here for automatic assignment
        </div>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          id="smart-file-upload"
        />
        <label
          htmlFor="smart-file-upload"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" />
          Choose Product Images
        </label>
      </div>

      {/* Upload Results */}
      {uploadResults && (
        <div className="space-y-2">
          {(uploadResults.success > 0 || uploadResults.duplicated > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <div className="text-sm text-green-800">
                  Successfully processed {uploadResults.success} unique products
                  {uploadResults.duplicated > 0 && ` + ${uploadResults.duplicated} duplicates`}
                  {' '}(positioned vertically by decimal values)
                </div>
              </div>
            </div>
          )}
          
          {uploadResults.failed.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <div className="text-sm text-red-800 font-medium mb-1">
                Failed to process {uploadResults.failed.length} files:
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {uploadResults.failed.map((failure, index) => (
                  <div key={index} className="text-xs text-red-700">
                    <span className="font-medium">{failure.filename}:</span> {failure.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Instructions */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
        <div className="font-medium mb-1">Smart Upload Features:</div>
        <ul className="space-y-1">
          <li>• Automatically extracts 13-digit EAN from filenames</li>
          <li>• Assigns products to correct modules based on Excel data</li>
          <li>• Scales products to real dimensions from Excel</li>
          <li>• <strong>Auto-duplicates products based on quantity column</strong></li>
          <li>• <strong>Vertical stacking: .1 = bottom, .2 = above .1, etc.</strong></li>
          <li>• <strong>Horizontal grouping by integer part (1.x, 2.x, etc.)</strong></li>
          <li>• Creates missing modules automatically</li>
        </ul>
      </div>
    </div>
  );
};