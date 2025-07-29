import React, { useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { usePlanogramStore } from '../stores/planogramStore';

interface FileUploadProps {
  moduleId: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ moduleId }) => {
  const { addProduct, modules } = usePlanogramStore();
  
  const module = modules.find(m => m.id === moduleId);

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || !module) return;

    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    // Calculate available space for products
    const moduleWidth = module.width;
    const moduleHeight = module.height;
    const padding = 16; // 8px on each side
    const spacing = 8; // Space between products
    const headerHeight = 40; // Height of module header (from ModuleComponent)
    
    const availableWidth = moduleWidth - padding;
    const availableHeight = moduleHeight - headerHeight - padding; // Subtract header height
    const totalSpacing = (fileArray.length - 1) * spacing;
    const availableWidthForProducts = availableWidth - totalSpacing;
    
    // Calculate maximum width per product
    const maxProductWidth = availableWidthForProducts / fileArray.length;
    const maxProductHeight = availableHeight; // Use full available height
    
    fileArray.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate scaled dimensions while maintaining aspect ratio
          const aspectRatio = img.width / img.height;
          
          let scaledWidth, scaledHeight;
          
          // Scale based on which constraint is more limiting
          if (maxProductWidth / aspectRatio <= maxProductHeight) {
            // Width is the limiting factor
            scaledWidth = maxProductWidth;
            scaledHeight = maxProductWidth / aspectRatio;
          } else {
            // Height is the limiting factor
            scaledHeight = maxProductHeight;
            scaledWidth = maxProductHeight * aspectRatio;
          }
          
          // Calculate position - arrange products in a row
          const existingProducts = module.products.length;
          const xPosition = 8 + (existingProducts + index) * (maxProductWidth + spacing) + (maxProductWidth - scaledWidth) / 2;
          
          // Position at bottom of available area (accounting for header)
          const yPosition = availableHeight - scaledHeight; // Bottom align within available space
          
          addProduct(moduleId, {
            name: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: e.target?.result as string,
            originalWidth: img.width,
            originalHeight: img.height,
            scaledWidth,
            scaledHeight,
            x: xPosition,
            y: yPosition,
            moduleId,
            // Store original file for maximum quality exports
            originalFile: file,
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, [moduleId, module, addProduct]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
      >
        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        <div className="text-sm text-gray-600 mb-2">
          Drop images here or click to upload
        </div>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          id={`file-upload-${moduleId}`}
        />
        <label
          htmlFor={`file-upload-${moduleId}`}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" />
          Choose Files
        </label>
      </div>
      
      {module && module.products.length > 0 && (
        <div className="text-xs text-gray-500">
          {module.products.length} product{module.products.length !== 1 ? 's' : ''} added
        </div>
      )}
      
      {/* Quality tip */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
        <strong>Tip:</strong> Upload high-resolution images (300+ DPI) for best PDF export quality
      </div>
    </div>
  );
};