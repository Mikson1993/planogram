import React, { useState } from 'react';
import { Download, FileImage, FileText, ZoomIn, ZoomOut, RotateCcw, Loader2, Archive } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { usePlanogramStore } from '../stores/planogramStore';

interface WorkspaceToolbarProps {
  workspaceRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({ 
  workspaceRef, 
  zoom, 
  onZoomIn, 
  onZoomOut, 
  onResetView 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'png' | 'pdf' | 'zip' | null>(null);
  const { modules, fontSettings } = usePlanogramStore();

  // Helper function to convert dataURL to Blob
  const dataURLToBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Helper function to get file extension from MIME type
  const getFileExtension = (mimeType: string): string => {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg'
    };
    return mimeToExt[mimeType] || 'jpg';
  };

  // Check if there are any modules with images
  const hasModulesWithImages = modules.some(module => 
    module.products.some(product => product.imageUrl || product.originalFile)
  );

  // Helper function to apply font settings to cloned document for export
  const applyFontSettingsToClone = (clonedDoc: Document) => {
    const style = clonedDoc.createElement('style');
    style.textContent = `
      /* PRESERVE FONT SETTINGS FROM APPLICATION */
      .module-header span[style*="fontSize"] {
        font-size: ${fontSettings.moduleNameSize}px !important;
      }
      .module-header div[style*="fontSize"] {
        font-size: ${fontSettings.moduleInfoSize}px !important;
      }
      div[style*="fontSize"][class*="bg-gray-100"] {
        font-size: ${fontSettings.depthInfoSize}px !important;
      }
      
      /* ENSURE HIGH QUALITY RENDERING */
      * {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        image-rendering: -webkit-optimize-contrast !important;
      }
      img {
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
        image-rendering: high-quality !important;
        -webkit-image-smoothing: true !important;
        image-smoothing: true !important;
        object-fit: contain !important;
      }
      
      /* PRESERVE EXACT FONT SIZES */
      [style*="fontSize"] {
        font-size: inherit !important;
      }
    `;
    clonedDoc.head.appendChild(style);
  };

  const handleExportZIP = async () => {
    if (!hasModulesWithImages || isExporting) return;
    
    setIsExporting(true);
    setExportType('zip');
    
    try {
      const zip = new JSZip();
      let fileCount = 0;
      
      // Process each module
      for (const module of modules) {
        if (module.products.length === 0) continue;
        
        // Create a folder for each module
        const moduleFolder = zip.folder(`Module_${module.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
        
        if (!moduleFolder) continue;
        
        // Process each product in the module
        for (let i = 0; i < module.products.length; i++) {
          const product = module.products[i];
          
          try {
            let blob: Blob;
            let fileName: string;
            
            // Use original file if available (best quality)
            if (product.originalFile) {
              blob = product.originalFile;
              const originalName = product.originalFile.name;
              const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
              const ext = originalName.split('.').pop() || 'jpg';
              fileName = `${i + 1}_${nameWithoutExt}.${ext}`;
            } 
            // Otherwise use imageUrl (dataURL)
            else if (product.imageUrl) {
              blob = dataURLToBlob(product.imageUrl);
              const mimeType = product.imageUrl.split(',')[0].split(':')[1].split(';')[0];
              const ext = getFileExtension(mimeType);
              const safeName = product.name.replace(/[^a-zA-Z0-9]/g, '_');
              fileName = `${i + 1}_${safeName}.${ext}`;
            } else {
              continue; // Skip products without images
            }
            
            // Add EAN to filename if available
            if (product.ean) {
              const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
              const ext = fileName.split('.').pop();
              fileName = `${nameWithoutExt}_EAN${product.ean}.${ext}`;
            }
            
            // Add file to module folder
            moduleFolder.file(fileName, blob);
            fileCount++;
            
          } catch (error) {
            console.error(`Failed to process product ${product.name}:`, error);
          }
        }
      }
      
      if (fileCount === 0) {
        alert('Nie znaleziono żadnych zdjęć do pobrania.');
        return;
      }
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      // Save ZIP file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      saveAs(zipBlob, `planogram_images_${timestamp}.zip`);
      
      // Success message
      alert(`Pomyślnie pobrano ${fileCount} zdjęć w archiwum ZIP!`);
      
    } catch (error) {
      console.error('Failed to create ZIP:', error);
      alert('Błąd podczas tworzenia archiwum ZIP. Spróbuj ponownie.');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportPNG = async () => {
    if (!workspaceRef.current || isExporting) return;
    
    setIsExporting(true);
    setExportType('png');
    
    try {
      const canvas = await html2canvas(workspaceRef.current, {
        backgroundColor: '#ffffff',
        scale: window.devicePixelRatio * 2, // HIGHER SCALE FOR BETTER FONT QUALITY
        useCORS: true,
        allowTaint: false,
        imageTimeout: 45000,
        logging: false,
        foreignObjectRendering: false,
        removeContainer: true,
        onclone: applyFontSettingsToClone, // APPLY FONT SETTINGS TO CLONE
      });
      
      const link = document.createElement('a');
      link.download = 'planogram.png';
      link.href = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Failed to export PNG:', error);
      alert('Failed to export PNG. Try reducing the workspace size.');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportPDF = async () => {
    if (!workspaceRef.current || isExporting) return;
    
    setIsExporting(true);
    setExportType('pdf');
    
    try {
      // Use html2canvas with high resolution and font preservation
      const canvas = await html2canvas(workspaceRef.current, {
        backgroundColor: '#ffffff',
        scale: window.devicePixelRatio * 2, // HIGHER SCALE FOR BETTER FONT QUALITY
        useCORS: true,
        allowTaint: false,
        imageTimeout: 90000,
        logging: false,
        foreignObjectRendering: false,
        removeContainer: true,
        onclone: applyFontSettingsToClone, // APPLY FONT SETTINGS TO CLONE
      });
      
      // Convert to high-quality JPEG
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const canvasAspectRatio = canvas.width / canvas.height;
      const maxDimension = 500;
      
      let pdfWidth, pdfHeight;
      
      if (canvasAspectRatio > 1) {
        pdfWidth = Math.min(maxDimension, canvas.width * 0.264583);
        pdfHeight = pdfWidth / canvasAspectRatio;
      } else {
        pdfHeight = Math.min(maxDimension, canvas.height * 0.264583);
        pdfWidth = pdfHeight * canvasAspectRatio;
      }
      
      const doc = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
        compress: false,
        precision: 16,
      });
      
      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      
      // Download PDF
      try {
        const pdfBlob = doc.output('blob');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = 'planogram.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        // Success message
        alert('PDF został pomyślnie wygenerowany z zachowaniem ustawień czcionek!');
        
      } catch (err) {
        console.error('Błąd podczas generowania PDF:', err);
        alert('Błąd podczas pobierania PDF. Spróbuj ponownie.');
      }
      
      // Memory cleanup
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, 1, 1);
      
    } catch (error) {
      console.error('Failed to export PDF:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('memory') || error.message.includes('canvas')) {
          alert('Obraz jest zbyt duży do eksportu. Spróbuj zmniejszyć rozmiar tła lub obszaru roboczego.');
        } else if (error.message.includes('timeout')) {
          alert('Przekroczono czas eksportu. Spróbuj zmniejszyć liczbę produktów lub rozmiar tła.');
        } else {
          alert(`Błąd eksportu PDF: ${error.message}`);
        }
      } else {
        alert('Nie udało się wyeksportować PDF. Spróbuj zmniejszyć rozmiar tła.');
      }
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 relative z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
          <div className="text-sm text-gray-500">
            Drag modules and products to arrange your planogram
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export Options */}
          <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
            <button
              onClick={handleExportPNG}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting && exportType === 'png' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileImage className="w-4 h-4" />
              )}
              PNG
            </button>
            
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting && exportType === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              PDF
            </button>
            
            {/* ZIP Download Button - only show if there are modules with images */}
            {hasModulesWithImages && (
              <button
                onClick={handleExportZIP}
                disabled={isExporting}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Pobierz wszystkie zdjęcia produktów w archiwum ZIP"
              >
                {isExporting && exportType === 'zip' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                ZIP
              </button>
            )}
          </div>
          
          {/* View Controls */}
          <div className="flex items-center gap-1">
            <button 
              onClick={onZoomOut}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <div className="px-3 py-1 text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </div>
            
            <button 
              onClick={onZoomIn}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            
            <button 
              onClick={onResetView}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-2"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Export Status */}
      {isExporting && (
        <div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {exportType === 'zip' && 'Tworzenie archiwum ZIP...'}
          {exportType === 'png' && 'Eksportowanie PNG z zachowaniem ustawień czcionek...'}
          {exportType === 'pdf' && 'Eksportowanie PDF z zachowaniem ustawień czcionek...'}
        </div>
      )}
    </div>
  );
};