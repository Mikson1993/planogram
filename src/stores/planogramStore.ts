import { create } from 'zustand';
import { Module, Product, PlanogramConfig, ExcelProduct, FontSettings } from '../types';
import { updateExcelData as updateExcelDataUtil } from '../utils/excelUtils';

interface PlanogramState {
  modules: Module[];
  selectedModule: string | null;
  selectedProduct: string | null;
  scale: number;
  workspace: { width: number; height: number };
  backgroundImage: string | null;
  backgroundDimensions: { width: number; height: number } | null;
  excelData: ExcelProduct[] | null;
  originalExcelFile: File | null;
  fontSettings: FontSettings;
  
  // Actions
  addModule: (module: Omit<Module, 'id' | 'products'>) => void;
  updateModule: (id: string, updates: Partial<Module>) => void;
  removeModule: (id: string) => void;
  selectModule: (id: string | null) => void;
  selectProduct: (id: string | null) => void;
  ensureModuleExists: (moduleId: string, moduleName: string) => void;
  
  addProduct: (moduleId: string, product: Omit<Product, 'id'>) => void;
  addProductFromExcel: (moduleId: string, product: Omit<Product, 'id' | 'moduleId'>) => void;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  removeProduct: (productId: string) => void;
  moveProduct: (productId: string, toModuleId: string, position?: { x: number; y: number }) => void;
  reorderProductsInModule: (moduleId: string, fromIndex: number, toIndex: number) => void;
  rescaleProductsInModule: (moduleId: string) => void;
  
  setScale: (scale: number) => void;
  setWorkspace: (dimensions: { width: number; height: number }) => void;
  setBackgroundImage: (imageUrl: string | null, dimensions?: { width: number; height: number } | null) => void;
  setExcelData: (data: ExcelProduct[] | null) => void;
  setOriginalExcelFile: (file: File | null) => void;
  updateExcelData: (data: ExcelProduct[]) => void;
  syncWithExcelData: () => void;
  setFontSettings: (settings: Partial<FontSettings>) => void;
  
  exportConfig: () => PlanogramConfig;
  importConfig: (config: PlanogramConfig) => void;
  resetPlanogram: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper function to calculate optimal product layout - NO SPACING BETWEEN PRODUCTS
const calculateProductLayoutFromExcel = (module: Module, products: Product[]) => {
  if (products.length === 0) return [];

  const moduleWidth = module.width;
  const moduleHeight = module.height;
  const padding = 8; // 8px padding from edges
  
  // Available area for products
  const availableWidth = moduleWidth - (padding * 2);
  const availableHeight = moduleHeight - (padding * 2);
  
  // Sort products by position if available
  const sortedProducts = [...products].sort((a, b) => {
    const posA = a.position || 0;
    const posB = b.position || 0;
    return posA - posB;
  });
  
  // Group products by integer part of position (horizontal groups)
  const groups: { [key: number]: Product[] } = {};
  sortedProducts.forEach(product => {
    const position = product.position || 0;
    const groupKey = Math.floor(position);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(product);
  });
  
  const groupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
  let currentX = padding;
  
  return sortedProducts.map((product, index) => {
    const position = product.position || 0;
    const groupKey = Math.floor(position);
    const decimalPart = position - groupKey;
    
    // Find which group this product belongs to
    const groupIndex = groupKeys.indexOf(groupKey);
    const productsInGroup = groups[groupKey] || [];
    const productIndexInGroup = productsInGroup.findIndex(p => p.id === product.id);
    
    // Calculate dimensions
    const productWidth = product.realWidth || product.scaledWidth;
    const productHeight = product.realHeight || product.scaledHeight;
    
    // Calculate X position (horizontal placement by group) - NO SPACING BETWEEN PRODUCTS
    let x = padding;
    for (let i = 0; i < groupIndex; i++) {
      const groupProducts = groups[groupKeys[i]] || [];
      if (groupProducts.length > 0) {
        const maxWidthInGroup = Math.max(...groupProducts.map(p => p.realWidth || p.scaledWidth));
        x += maxWidthInGroup; // NO SPACING - products are adjacent
      }
    }
    
    // Calculate Y position (vertical stacking within group) - NO SPACING BETWEEN PRODUCTS
    let y = availableHeight - productHeight - padding; // Start from bottom
    
    // If there's a decimal part, stack vertically
    if (decimalPart > 0) {
      // Find products below this one in the same group
      const productsBelow = productsInGroup.filter(p => {
        const pPos = p.position || 0;
        const pDecimal = pPos - Math.floor(pPos);
        return pDecimal < decimalPart && pDecimal > 0;
      });
      
      // Stack above products below - NO SPACING BETWEEN PRODUCTS
      productsBelow.forEach(p => {
        y -= (p.realHeight || p.scaledHeight); // NO SPACING - products are stacked directly
      });
    }
    
    // Ensure product stays within module bounds
    x = Math.max(padding, Math.min(x, moduleWidth - productWidth - padding));
    y = Math.max(padding, Math.min(y, moduleHeight - productHeight - padding));
    
    return {
      ...product,
      x,
      y,
      scaledWidth: productWidth,
      scaledHeight: productHeight,
    };
  });
};

// Calculate free space in module
export const calculateFreeSpace = (module: Module): number => {
  const moduleWidth = module.width;
  
  const usedWidth = module.products.reduce((total, product) => {
    return total + (product.realWidth || product.scaledWidth);
  }, 0);
  
  return Math.max(0, moduleWidth - usedWidth);
};

// Calculate depth capacity for stacked products - SUMOWANIE DLA PRODUKTÓW W TEJ SAMEJ POZYCJI
export const calculateDepthCapacity = (module: Module, excelData: ExcelProduct[] | null): Record<string, { capacity: number; isVisible: boolean; x: number; width: number }> => {
  const capacities: Record<string, { capacity: number; isVisible: boolean; x: number; width: number }> = {};
  
  if (!module.depth) return capacities;
  
  // Group products by their horizontal position (integer part of position)
  const positionGroups: { [key: number]: Product[] } = {};
  
  module.products.forEach(product => {
    const position = product.position || 0;
    const groupKey = Math.floor(position);
    if (!positionGroups[groupKey]) positionGroups[groupKey] = [];
    positionGroups[groupKey].push(product);
  });
  
  // Calculate capacity for each position group
  Object.entries(positionGroups).forEach(([positionKey, productsInPosition]) => {
    if (productsInPosition.length === 0) return;
    
    // Find Excel data for products in this position
    let totalCapacity = 0;
    let groupWidth = 0;
    let groupX = 0;
    
    productsInPosition.forEach((product, index) => {
      const excelProduct = excelData?.find(ep => 
        ep.ean === product.ean || 
        ep.originalEan === product.originalEan ||
        ep.ean === product.originalEan
      );
      
      const productDepth = excelProduct?.depth || 100; // Default 100mm if no depth specified
      
      if (productDepth > 0 && module.depth) {
        const layersOnDepth = Math.floor(module.depth / productDepth);
        totalCapacity += layersOnDepth; // SUMOWANIE dla produktów w tej samej pozycji
      } else {
        totalCapacity += 1;
      }
      
      // Calculate group dimensions for label positioning
      if (index === 0) {
        groupX = product.x;
        groupWidth = product.scaledWidth;
      } else {
        // Extend width to cover all products in the stack
        const rightEdge = Math.max(groupX + groupWidth, product.x + product.scaledWidth);
        groupWidth = rightEdge - Math.min(groupX, product.x);
        groupX = Math.min(groupX, product.x);
      }
    });
    
    // Set capacity for all products in this position group
    // Only the first product in the group will be visible (to avoid duplicate labels)
    productsInPosition.forEach((product, index) => {
      capacities[product.id] = {
        capacity: totalCapacity,
        isVisible: index === 0, // Only show label for the first product in the stack
        x: groupX,
        width: groupWidth
      };
    });
  });
  
  return capacities;
};

// Auto-resize module to fit products perfectly - NO SPACING BETWEEN PRODUCTS
const autoResizeModuleToFitProducts = (module: Module): Partial<Module> => {
  if (module.products.length === 0) {
    return { 
      width: 200, 
      height: 150
    };
  }

  const padding = 16; // 8px on each side
  
  // Group products by position for width calculation
  const groups: { [key: number]: Product[] } = {};
  module.products.forEach(product => {
    const position = product.position || 0;
    const groupKey = Math.floor(position);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(product);
  });
  
  // Calculate total width needed - NO SPACING BETWEEN GROUPS
  let totalWidth = padding;
  Object.values(groups).forEach((groupProducts) => {
    if (groupProducts.length > 0) {
      const maxWidthInGroup = Math.max(...groupProducts.map(p => p.realWidth || p.scaledWidth));
      totalWidth += maxWidthInGroup; // NO SPACING - groups are adjacent
    }
  });
  totalWidth += padding;
  
  // Calculate height needed (tallest stack) - NO SPACING BETWEEN STACKED PRODUCTS
  let maxHeight = 0;
  Object.values(groups).forEach(groupProducts => {
    let groupHeight = padding;
    
    // Sort by decimal part to stack properly
    const sortedInGroup = groupProducts.sort((a, b) => {
      const aDecimal = (a.position || 0) - Math.floor(a.position || 0);
      const bDecimal = (b.position || 0) - Math.floor(b.position || 0);
      return aDecimal - bDecimal;
    });
    
    sortedInGroup.forEach((product) => {
      groupHeight += (product.realHeight || product.scaledHeight); // NO SPACING - products are stacked directly
    });
    
    groupHeight += padding;
    maxHeight = Math.max(maxHeight, groupHeight);
  });
  
  return {
    width: Math.max(totalWidth, 100),
    height: Math.max(maxHeight, 50)
  };
};

const initialState = {
  modules: [],
  selectedModule: null,
  selectedProduct: null,
  scale: 1,
  workspace: { width: 1200, height: 800 },
  backgroundImage: null,
  backgroundDimensions: null,
  excelData: null,
  originalExcelFile: null,
  fontSettings: {
    moduleNameSize: 14,
    moduleInfoSize: 11,
    depthInfoSize: 10,
  },
};

export const usePlanogramStore = create<PlanogramState>((set, get) => ({
  ...initialState,
  
  addModule: (moduleData) => set((state) => ({
    modules: [...state.modules, {
      ...moduleData,
      id: generateId(),
      products: [],
    }],
  })),
  
  ensureModuleExists: (moduleId, moduleName) => set((state) => {
    const existingModule = state.modules.find(m => m.id === moduleId);
    if (existingModule) return state;
    
    return {
      modules: [...state.modules, {
        id: moduleId,
        name: moduleName,
        width: 200,
        height: 150,
        depth: 300, // Default depth
        x: 50 + state.modules.length * 50,
        y: 50 + state.modules.length * 50,
        products: [],
      }],
    };
  }),
  
  updateModule: (id, updates) => set((state) => {
    const updatedModules = state.modules.map((module) => {
      if (module.id === id) {
        const updatedModule = { ...module, ...updates };
        
        // If dimensions changed, recalculate product layout
        if ((updates.width && updates.width !== module.width) || 
            (updates.height && updates.height !== module.height)) {
          
          const rescaledProducts = calculateProductLayoutFromExcel(updatedModule, module.products);
          return { ...updatedModule, products: rescaledProducts };
        }
        
        return updatedModule;
      }
      return module;
    });
    
    return { modules: updatedModules };
  }),
  
  removeModule: (id) => set((state) => ({
    modules: state.modules.filter((module) => module.id !== id),
    selectedModule: state.selectedModule === id ? null : state.selectedModule,
  })),
  
  selectModule: (id) => set({ selectedModule: id }),
  selectProduct: (id) => set({ selectedProduct: id }),
  
  addProduct: (moduleId, productData) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return state;

    const newProduct = {
      ...productData,
      id: generateId(),
      moduleId,
    };

    const updatedProducts = [...module.products, newProduct];
    
    // AUTO-RESIZE MODULE TO FIT ALL PRODUCTS
    const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: updatedProducts });
    const updatedModule = { ...module, ...moduleUpdates, products: updatedProducts };
    
    // Calculate product layout with new module dimensions
    const arrangedProducts = calculateProductLayoutFromExcel(updatedModule, updatedProducts);

    return {
      modules: state.modules.map((m) =>
        m.id === moduleId
          ? { ...m, ...moduleUpdates, products: arrangedProducts }
          : m
      ),
    };
  }),
  
  addProductFromExcel: (moduleId, productData) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return state;

    const newProduct = {
      ...productData,
      id: generateId(),
      moduleId,
    };

    const updatedProducts = [...module.products, newProduct];
    
    // AUTO-RESIZE MODULE TO FIT ALL PRODUCTS
    const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: updatedProducts });
    const updatedModule = { ...module, ...moduleUpdates, products: updatedProducts };
    
    // Calculate product layout with new module dimensions
    const arrangedProducts = calculateProductLayoutFromExcel(updatedModule, updatedProducts);

    return {
      modules: state.modules.map((m) =>
        m.id === moduleId
          ? { ...m, ...moduleUpdates, products: arrangedProducts }
          : m
      ),
    };
  }),
  
  updateProduct: (productId, updates) => set((state) => ({
    modules: state.modules.map((module) => ({
      ...module,
      products: module.products.map((product) =>
        product.id === productId ? { ...product, ...updates } : product
      ),
    })),
  })),
  
  removeProduct: (productId) => set((state) => {
    let targetModuleId: string | null = null;
    
    // Find which module contains the product
    for (const module of state.modules) {
      if (module.products.some(p => p.id === productId)) {
        targetModuleId = module.id;
        break;
      }
    }
    
    if (!targetModuleId) return state;
    
    const updatedModules = state.modules.map((module) => {
      if (module.id === targetModuleId) {
        const remainingProducts = module.products.filter((product) => product.id !== productId);
        
        // AUTO-RESIZE MODULE AFTER REMOVING PRODUCT
        const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: remainingProducts });
        const updatedModule = { ...module, ...moduleUpdates, products: remainingProducts };
        
        // Calculate product layout with new module dimensions
        const rescaledProducts = calculateProductLayoutFromExcel(updatedModule, remainingProducts);
        
        return { ...module, ...moduleUpdates, products: rescaledProducts };
      }
      return module;
    });
    
    return { 
      modules: updatedModules,
      selectedProduct: state.selectedProduct === productId ? null : state.selectedProduct
    };
  }),
  
  moveProduct: (productId, toModuleId, position) => set((state) => {
    let product: Product | null = null;
    let fromModuleId: string | null = null;
    
    // Find and remove product from current module
    const updatedModules = state.modules.map((module) => {
      const productIndex = module.products.findIndex((p) => p.id === productId);
      if (productIndex !== -1) {
        product = module.products[productIndex];
        fromModuleId = module.id;
        const remainingProducts = module.products.filter((p) => p.id !== productId);
        
        // AUTO-RESIZE SOURCE MODULE AFTER REMOVING PRODUCT
        const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: remainingProducts });
        const updatedModule = { ...module, ...moduleUpdates, products: remainingProducts };
        const rescaledProducts = calculateProductLayoutFromExcel(updatedModule, remainingProducts);
        
        return { ...module, ...moduleUpdates, products: rescaledProducts };
      }
      return module;
    });
    
    if (!product || !fromModuleId) return state;
    
    // Update Excel data if available
    let updatedExcelData = state.excelData;
    if (updatedExcelData && product.ean) {
      const toModuleNumber = toModuleId.replace('module-', '');
      updatedExcelData = updateExcelDataUtil(updatedExcelData, product.ean, toModuleNumber);
    }
    
    // Add product to new module and auto-resize
    const finalModules = updatedModules.map((module) => {
      if (module.id === toModuleId) {
        const newProducts = [...module.products, {
          ...product!,
          moduleId: toModuleId,
        }];
        
        // AUTO-RESIZE TARGET MODULE AFTER ADDING PRODUCT
        const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: newProducts });
        const updatedModule = { ...module, ...moduleUpdates, products: newProducts };
        const rescaledProducts = calculateProductLayoutFromExcel(updatedModule, newProducts);
        
        return { ...module, ...moduleUpdates, products: rescaledProducts };
      }
      return module;
    });
    
    return { 
      modules: finalModules,
      excelData: updatedExcelData
    };
  }),

  reorderProductsInModule: (moduleId, fromIndex, toIndex) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return state;

    const newProducts = [...module.products];
    const [movedProduct] = newProducts.splice(fromIndex, 1);
    newProducts.splice(toIndex, 0, movedProduct);

    // Recalculate layout after reordering
    const rescaledProducts = calculateProductLayoutFromExcel(module, newProducts);

    return {
      modules: state.modules.map((m) =>
        m.id === moduleId ? { ...m, products: rescaledProducts } : m
      ),
    };
  }),

  rescaleProductsInModule: (moduleId) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return state;

    // MANUAL RESCALE: Auto-resize module to fit products perfectly
    const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: module.products });
    const updatedModule = { ...module, ...moduleUpdates };
    const rescaledProducts = calculateProductLayoutFromExcel(updatedModule, module.products);

    return {
      modules: state.modules.map((m) =>
        m.id === moduleId ? { ...m, ...moduleUpdates, products: rescaledProducts } : m
      ),
    };
  }),
  
  setScale: (scale) => set({ scale }),
  setWorkspace: (dimensions) => set({ workspace: dimensions }),
  setBackgroundImage: (imageUrl, dimensions) => set({ 
    backgroundImage: imageUrl,
    backgroundDimensions: dimensions,
    workspace: dimensions && dimensions.width > 0 && dimensions.height > 0 
      ? dimensions 
      : { width: 1200, height: 800 }
  }),
  
  setExcelData: (data) => set({ excelData: data }),
  setOriginalExcelFile: (file) => set({ originalExcelFile: file }),
  
  updateExcelData: (data) => set({ excelData: data }),
  
  syncWithExcelData: () => set((state) => {
    if (!state.excelData) return state;

    const updatedModules = state.modules.map(module => {
      // Update module name based on Excel data
      const moduleNumber = module.id.replace('module-', '');
      const moduleProducts = state.excelData!.filter(item => item.module === moduleNumber);
      
      if (moduleProducts.length > 0) {
        // Update products in this module
        const updatedProducts = module.products.map(product => {
          if (product.ean || product.originalEan) {
            const excelProduct = state.excelData!.find(item => 
              item.ean === product.ean || 
              item.originalEan === product.originalEan ||
              item.ean === product.originalEan
            );
            if (excelProduct) {
              return {
                ...product,
                name: excelProduct.name || product.name,
                realWidth: excelProduct.width,
                realHeight: excelProduct.height || product.realHeight,
                realDepth: excelProduct.depth || product.realDepth,
                scaledWidth: excelProduct.width,
                scaledHeight: excelProduct.height || product.scaledHeight,
                position: excelProduct.position || product.position,
              };
            }
          }
          return product;
        });

        // AUTO-RESIZE MODULE AFTER SYNCING WITH EXCEL
        const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: updatedProducts });
        const updatedModule = { ...module, ...moduleUpdates, products: updatedProducts };
        const rescaledProducts = calculateProductLayoutFromExcel(updatedModule, updatedProducts);

        return {
          ...module,
          ...moduleUpdates,
          name: `Module ${moduleNumber}`,
          products: rescaledProducts,
        };
      }
      
      return module;
    });

    return { modules: updatedModules };
  }),
  
  setFontSettings: (settings) => set((state) => ({
    fontSettings: { ...state.fontSettings, ...settings }
  })),
  
  exportConfig: () => {
    const state = get();
    return {
      modules: state.modules,
      scale: state.scale,
      workspace: state.workspace,
      backgroundImage: state.backgroundImage,
      backgroundDimensions: state.backgroundDimensions,
      excelData: state.excelData,
      fontSettings: state.fontSettings,
    };
  },
  
  importConfig: (config) => set({
    modules: config.modules,
    scale: config.scale,
    workspace: config.workspace,
    backgroundImage: config.backgroundImage || null,
    backgroundDimensions: (config as any).backgroundDimensions || null,
    excelData: (config as any).excelData || null,
    fontSettings: config.fontSettings || initialState.fontSettings,
  }),
  
  resetPlanogram: () => set({
    ...initialState,
    backgroundImage: null,
    backgroundDimensions: null,
    excelData: null,
    originalExcelFile: null,
  }),
}));