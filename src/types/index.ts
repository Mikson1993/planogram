export interface Module {
  id: string;
  name: string;
  width: number; // in mm
  height: number; // in mm
  depth?: number; // in mm - new depth parameter
  x: number; // position in px
  y: number; // position in px
  products: Product[];
}

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  originalWidth: number;
  originalHeight: number;
  scaledWidth: number;
  scaledHeight: number;
  x: number; // position within module
  y: number; // position within module
  moduleId: string;
  originalFile?: File; // Store original file for maximum quality exports
  ean?: string; // EAN code extracted from filename
  originalEan?: string; // Original EAN before duplication suffix
  realWidth?: number; // Real width from Excel in mm
  realHeight?: number; // Real height from Excel in mm
  realDepth?: number; // Real depth from Excel in mm
  position?: number; // Position from Excel for sorting
  quantity?: number; // Quantity from Excel
  duplicateIndex?: number; // Index for duplicated products
  // Serialization properties for JSON export/import
  serializedImageData?: string; // Base64 encoded image data
  originalFileData?: {
    name: string;
    type: string;
    size: number;
    data: string; // Base64 encoded file data
  };
}

export interface ExcelProduct {
  ean: string;
  originalEan?: string; // Original EAN before duplication
  module: string;
  width: number; // width in mm
  height?: number; // height in mm (optional)
  depth?: number; // depth in mm (optional)
  name?: string;
  position?: number; // Position for sorting products in module
  quantity?: number; // Quantity of products to create
  duplicateIndex?: number; // Index for duplicated products
  [key: string]: any; // Allow additional properties
}

export interface FontSettings {
  moduleNameSize: number; // Font size for module name
  moduleInfoSize: number; // Font size for module info (size, products, free space)
  depthInfoSize: number; // Font size for depth capacity info
  showModuleName: boolean; // Show/hide module name
  showModuleInfo: boolean; // Show/hide module info
  showDepthInfo: boolean; // Show/hide depth capacity info
}

export interface PlanogramConfig {
  modules: Module[];
  scale: number; // mm to px conversion factor
  workspace: {
    width: number;
    height: number;
  };
  backgroundImage?: string | null;
  backgroundDimensions?: { width: number; height: number } | null;
  excelData?: ExcelProduct[];
  fontSettings?: FontSettings;
  // Metadata for image serialization
  _hasSerializedImages?: boolean;
  _exportTimestamp?: string;
  _serializeImages?: () => Promise<Module[]>;
}

export interface DragItem {
  type: string;
  id: string;
  moduleId?: string;
  index?: number;
}

export const ItemTypes = {
  PRODUCT: 'product',
  MODULE: 'module',
  PRODUCT_REORDER: 'product_reorder',
} as const;