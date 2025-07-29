import React, { useCallback } from 'react';
import { Upload, Image as ImageIcon, X, AlertTriangle } from 'lucide-react';
import { usePlanogramStore } from '../stores/planogramStore';

export const BackgroundUpload: React.FC = () => {
  const { backgroundImage, backgroundScale, setBackgroundImage, setBackgroundScale } = usePlanogramStore();

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with good quality for smaller file size
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(resizedDataUrl);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    // Check file size (warn if > 5MB)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const shouldResize = file.size > maxFileSize;
    
    if (shouldResize) {
      const userConfirm = confirm(
        'The background image is quite large and may cause export issues. Would you like to automatically optimize it for better performance?'
      );
      
      if (userConfirm) {
        try {
          // Resize to max 2000x2000 for better performance
          const resizedImageUrl = await resizeImage(file, 2000, 2000);
          
          // Get dimensions of resized image
          const img = new Image();
          img.onload = () => {
            setBackgroundImage(resizedImageUrl, {
              width: img.naturalWidth,
              height: img.naturalHeight
            });
          };
          img.src = resizedImageUrl;
          
        } catch (error) {
          console.error('Failed to resize image:', error);
          alert('Failed to process image. Please try a smaller file.');
        }
        return;
      }
    }

    // Use original image
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      
      // Create an image to get original dimensions
      const img = new Image();
      img.onload = () => {
        setBackgroundImage(imageUrl, {
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.src = imageUrl;
    };
    reader.readAsDataURL(file);
  }, [setBackgroundImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeBackground = () => {
    setBackgroundImage(null);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Workspace Background</h3>
      
      {backgroundImage ? (
        <div className="relative">
          <div className="w-full h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
            <img
              src={backgroundImage}
              alt="Background preview"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={removeBackground}
            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
          <div className="text-xs text-gray-500 mt-1">
            Background image loaded
          </div>
          
          {/* SUWAK SKALOWANIA TŁA */}
          <div className="mt-3">
            <label className="text-xs text-gray-600 block mb-1">
              Background Scale: {Math.round(backgroundScale * 100)}%
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={backgroundScale}
                onChange={(e) => setBackgroundScale(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-12 text-right">
                {backgroundScale.toFixed(1)}x
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
        >
          <Upload className="w-5 h-5 text-gray-400 mx-auto mb-2" />
          <div className="text-sm text-gray-600 mb-2">
            Drop background image here
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="background-upload"
          />
          <label
            htmlFor="background-upload"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            Choose Background
          </label>
          
          {/* Performance tip */}
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3" />
              <span className="font-medium">Performance Tip</span>
            </div>
            For best export performance, use images smaller than 5MB or 2000x2000 pixels.
          </div>
        </div>
      )}
    </div>
  );
};