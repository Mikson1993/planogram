import * as XLSX from 'xlsx';
import { ExcelProduct } from '../types';

// Extract 13-digit EAN from filename
export const extractEAN = (filename: string): string | null => {
  // Look for 13 consecutive digits in the filename
  const eanMatch = filename.match(/\d{13}/);
  return eanMatch ? eanMatch[0] : null;
};

// Parse Excel file and extract product data
export const parseExcelFile = async (file: File): Promise<ExcelProduct[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          throw new Error('Excel file must have at least a header row and one data row');
        }
        
        // Find column indices
        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
        const eanIndex = headers.findIndex(h => h.includes('ean') || h.includes('kod'));
        const moduleIndex = headers.findIndex(h => h.includes('module') || h.includes('moduł'));
        const widthIndex = headers.findIndex(h => h.includes('szerokość') || h.includes('width'));
        const heightIndex = headers.findIndex(h => h.includes('wysokość') || h.includes('height'));
        const depthIndex = headers.findIndex(h => h.includes('głębokość') || h.includes('depth'));
        const nameIndex = headers.findIndex(h => h.includes('nazwa') || h.includes('name') || h.includes('produkt'));
        const positionIndex = headers.findIndex(h => h.includes('pozycja') || h.includes('position'));
        const quantityIndex = headers.findIndex(h => h.includes('ilość') || h.includes('quantity') || h.includes('qty') || h.includes('sztuk'));
        
        if (eanIndex === -1) {
          throw new Error('Could not find EAN column in Excel file');
        }
        
        if (moduleIndex === -1) {
          throw new Error('Could not find Module column in Excel file');
        }
        
        if (widthIndex === -1) {
          throw new Error('Could not find Width column in Excel file');
        }
        
        // Parse data rows
        const products: ExcelProduct[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          if (!row || row.length === 0) continue;
          
          const ean = String(row[eanIndex] || '').trim();
          const module = String(row[moduleIndex] || '').trim();
          const width = parseFloat(row[widthIndex]) || 0;
          const height = heightIndex !== -1 ? parseFloat(row[heightIndex]) || 0 : 0;
          const depth = depthIndex !== -1 ? parseFloat(row[depthIndex]) || 0 : 0;
          const name = nameIndex !== -1 ? String(row[nameIndex] || '').trim() : '';
          const position = positionIndex !== -1 ? parseFloat(row[positionIndex]) || 0 : 0;
          const quantity = quantityIndex !== -1 ? parseInt(row[quantityIndex]) || 1 : 1; // Default to 1 if no quantity specified
          
          if (ean && module && width > 0) {
            // Create multiple entries for quantity > 1
            for (let q = 0; q < quantity; q++) {
              // Calculate position for duplicates
              let duplicatePosition = position;
              if (quantity > 1 && position > 0) {
                // If quantity > 1, create positions like 1.1, 1.2, 1.3 for horizontal placement
                // or 1.11, 1.12, 1.13 for vertical stacking
                const basePosition = Math.floor(position);
                const decimalPart = position - basePosition;
                
                if (decimalPart === 0) {
                  // No decimal part, create horizontal sequence: 1.1, 2.1, 3.1
                  duplicatePosition = basePosition + q + 0.1;
                } else {
                  // Has decimal part, create vertical sequence within same column
                  duplicatePosition = position + (q * 0.01); // 1.1 -> 1.11, 1.12, 1.13
                }
              }
              
              products.push({
                ean: `${ean}${quantity > 1 ? `_${q + 1}` : ''}`, // Add suffix for duplicates
                originalEan: ean, // Keep original EAN for reference
                module,
                width,
                height,
                depth,
                name: `${name}${quantity > 1 ? ` (${q + 1}/${quantity})` : ''}`,
                position: duplicatePosition,
                quantity,
                duplicateIndex: q,
                rowIndex: i // Store original row index for updates
              });
            }
          }
        }
        
        resolve(products);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
};

// Update Excel data when products are moved between modules
export const updateExcelData = (
  originalData: ExcelProduct[],
  productEAN: string,
  newModule: string,
  newPosition?: number
): ExcelProduct[] => {
  return originalData.map(product => {
    // Handle both original EAN and EAN with duplicate suffix
    const matchesEAN = product.ean === productEAN || 
                      product.originalEan === productEAN.split('_')[0];
    
    if (matchesEAN) {
      return { 
        ...product, 
        module: newModule,
        position: newPosition !== undefined ? newPosition : product.position
      };
    }
    return product;
  });
};

// Generate updated Excel file
export const generateUpdatedExcel = (
  originalFile: File,
  updatedData: ExcelProduct[]
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON to modify
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Find column indices
        const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
        const eanIndex = headers.findIndex(h => h.includes('ean') || h.includes('kod'));
        const moduleIndex = headers.findIndex(h => h.includes('module') || h.includes('moduł'));
        
        // Update data
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;
          
          const ean = String(row[eanIndex] || '').trim();
          const updatedProduct = updatedData.find(p => p.originalEan === ean || p.ean === ean);
          
          if (updatedProduct) {
            row[moduleIndex] = updatedProduct.module;
          }
        }
        
        // Create new worksheet
        const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
        workbook.Sheets[worksheetName] = newWorksheet;
        
        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read original Excel file'));
    reader.readAsArrayBuffer(originalFile);
  });
};