import { create } from 'zustand';
import { Module, Product, PlanogramConfig, ExcelProduct, FontSettings } from '../types';
import { generateUpdatedExcel } from '../utils/excelUtils';

interface PlanogramState {
  modules: Module[];
  selectedModule: string | null;
  selectedProduct: string | null;
  scale: number;
  workspace: { width: number; height: number };
  backgroundImage: string | null;
  backgroundDimensions: { width: number; height: number } | null;
  backgroundScale: number;
  excelData: ExcelProduct[] | null;
  originalExcelFile: File | null;
  fontSettings: FontSettings;
  dragMode: 'swap' | 'insert';
  
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
  insertProductAtPosition: (moduleId: string, dragIndex: number, hoverIndex: number) => void;
  moveProductWithinModule: (productId: string, newPosition: { x: number; y: number }) => void;
  
  setScale: (scale: number) => void;
  setWorkspace: (dimensions: { width: number; height: number }) => void;
  setBackgroundImage: (imageUrl: string | null, dimensions?: { width: number; height: number } | null) => void;
  setBackgroundScale: (scale: number) => void;
  setExcelData: (data: ExcelProduct[] | null) => void;
  setOriginalExcelFile: (file: File | null) => void;
  updateExcelData: (data: ExcelProduct[]) => void;
  syncWithExcelData: () => void;
  setFontSettings: (settings: Partial<FontSettings>) => void;
  setDragMode: (mode: 'swap' | 'insert') => void;
  
  exportConfig: () => PlanogramConfig;
  importConfig: (config: PlanogramConfig) => void;
  resetPlanogram: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Centralna funkcja do przeliczania układu produktów w module
const recalculateLayout = (moduleId: string, modules: Module[], excelData: ExcelProduct[] | null): Module[] => {
  const module = modules.find(m => m.id === moduleId);
  if (!module || !excelData) return modules;

  const moduleNumber = moduleId.replace('module-', '');
  
  // KLUCZOWA NAPRAWA: Znajdź produkty tego modułu w excelData z poprawnym dopasowaniem pozycji
  const moduleProducts = module.products.map(product => {
    // NOWA LOGIKA: Dla produktów zdublowanych, znajdź odpowiedni rekord w Excel
    let excelProduct = null;
    
    if (product.ean?.includes('_')) {
      // Produkt zdublowany - znajdź dokładnie odpowiadający rekord w Excel
      excelProduct = excelData.find(ep => ep.ean === product.ean);
    } else {
      // Produkt pojedynczy - znajdź po oryginalnym EAN
      const originalEAN = product.originalEan || product.ean;
      excelProduct = excelData.find(ep => 
        ep.originalEan === originalEAN || 
        ep.ean === originalEAN
      );
    }
    
    console.log(`Produkt ${product.name}:`, {
      productEAN: product.ean,
      originalEAN: product.originalEan,
      foundExcelProduct: excelProduct ? `${excelProduct.ean} pos:${excelProduct.position}` : 'NOT FOUND'
    });
    
    return {
      ...product,
      position: excelProduct?.position || 0, // WAŻNE: Zachowaj oryginalną pozycję z Excel
      excelProduct: excelProduct // Dodaj referencję do danych Excel dla debugowania
    };
  });

  // NAJWAŻNIEJSZA NAPRAWA: Grupowanie według pozycji całkowitej
  // Produkty z pozycjami 6.00, 7.00, 8.00 muszą trafić do osobnych grup!
  const groups: { [key: number]: Product[] } = {};
  
  console.log('=== DEBUGOWANIE GRUPOWANIA ===');
  console.log('Produkty do pogrupowania:', moduleProducts.map(p => ({
    name: p.name,
    ean: p.ean,
    position: p.position,
    floorPosition: Math.floor(p.position || 0),
    excelData: p.excelProduct ? `pos:${p.excelProduct.position}` : 'NO_EXCEL_DATA'
  })));
  
  // NOWA LOGIKA: Przypisz pozycje produktom bez danych Excel
  let autoPosition = 1;
  moduleProducts.forEach(product => {
    let position = product.position || 0;
    
    // WAŻNE: Jeśli produkt nie ma pozycji z Excel, przypisz automatyczną
    if (position === 0) {
      position = autoPosition;
      autoPosition++;
      console.log(`Przypisano automatyczną pozycję ${position} dla produktu ${product.name}`);
    }
    
    // KLUCZOWE: Grupuj według części całkowitej pozycji
    const groupKey = Math.floor(position);
    
    console.log(`GRUPOWANIE: Produkt ${product.name}: pozycja=${position}, grupa=${groupKey}, EAN=${product.ean}`);
    
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push({
      ...product,
      position: position
    });
  });
  
  console.log('Utworzone grupy:', Object.keys(groups).map(key => ({
    grupa: key,
    produkty: groups[parseInt(key)].map(p => `${p.name} (EAN:${p.ean}, pos:${p.position})`)
  })));

  // WAŻNE: Sortowanie grup numerycznie aby zachować kolejność
  const sortedGroupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
  
  console.log('Posortowane klucze grup:', sortedGroupKeys);
  
  // POZYCJONOWANIE POZIOME: Każda grupa obok poprzedniej
  let currentX = 0;
  const updatedProducts: Product[] = [];

  sortedGroupKeys.forEach(groupKey => {
    const groupProducts = groups[groupKey];
    if (groupProducts.length === 0) return;
    
    console.log(`=== GRUPA ${groupKey} ===`);
    console.log('Produkty w grupie:', groupProducts.map(p => `${p.name} (EAN:${p.ean})`));

    // POZYCJONOWANIE PIONOWE: Sortowanie w grupie według części dziesiętnej
    const sortedGroupProducts = groupProducts.sort((a, b) => {
      const aDecimal = (a.position || 0) - Math.floor(a.position || 0);
      const bDecimal = (b.position || 0) - Math.floor(b.position || 0);
      return aDecimal - bDecimal;
    });
    
    // SZEROKOŚĆ GRUPY: Najszerszy produkt w stosie
    const groupWidth = Math.max(...sortedGroupProducts.map(p => p.scaledWidth));

    // POZYCJONOWANIE PIONOWE: Od dołu modułu w górę
    let stackHeight = 0;
    const productsWithY = sortedGroupProducts.map((product, index) => {
      let yPosition;
      
      if (index === 0) {
        // Pierwszy produkt na dole
        yPosition = module.height - product.scaledHeight;
        stackHeight = product.scaledHeight;
      } else {
        // Kolejne produkty na stosie
        yPosition = module.height - stackHeight - product.scaledHeight;
        stackHeight += product.scaledHeight;
      }

      return {
        ...product,
        x: currentX, // WAŻNE: Ta sama pozycja X dla całej grupy
        y: Math.max(0, yPosition)
      };
    });
    
    console.log(`FINALNE POZYCJE dla grupy ${groupKey}:`, productsWithY.map(p => ({
      name: p.name,
      ean: p.ean,
      x: p.x,
      y: p.y,
      position: p.position
    })));

    updatedProducts.push(...productsWithY);
    currentX += groupWidth; // PRZEJŚCIE DO NASTĘPNEJ KOLUMNY
    
    console.log(`Następna kolumna zacznie się na X: ${currentX}`);
  });
  
  console.log('=== FINALNE POZYCJE WSZYSTKICH PRODUKTÓW ===');
  updatedProducts.forEach(p => {
    console.log(`${p.name} (EAN:${p.ean}): x=${p.x}, y=${p.y}, position=${p.position}`);
  });

  // ZWRÓĆ ZAKTUALIZOWANY MODUŁ
  return modules.map(m => 
    m.id === moduleId 
      ? { ...m, products: updatedProducts }
      : m
  );
};
// Helper function to convert File to base64 for serialization
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper function to convert base64 to Blob for reconstruction
const base64ToBlob = (base64: string): Blob => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// Helper function to calculate optimal product layout - NO SPACING BETWEEN PRODUCTS

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
    
    const padding = 8; // Small padding from left edge
    let currentX = padding; // Pozycja startowa
    productsInPosition.forEach((product, index) => {
    // Tworzy zaktualizowane produkty z kompaktowymi pozycjami
      capacities[product.id] = {
      // Ustawia pozycję X dla bieżącego produktu
        capacity: totalCapacity,
        isVisible: index === 0, // Only show label for the first product in the stack
        x: groupX,
        width: groupWidth,
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
  backgroundScale: 1,
  excelData: null,
  originalExcelFile: null,
  dragMode: 'swap' as 'swap' | 'insert',
  fontSettings: {
    moduleNameSize: 14,
    moduleInfoSize: 11,
    depthInfoSize: 10,
    showModuleName: true,
    showModuleInfo: true,
    showDepthInfo: true,
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
          
          return updatedModule;
        }
        
        return updatedModule;
      }
      return module;
    });
    
    // Jeśli zmieniono wymiary, wywołaj recalculateLayout
    if ((updates.width && updates.width !== state.modules.find(m => m.id === id)?.width) || 
        (updates.height && updates.height !== state.modules.find(m => m.id === id)?.height)) {
      const finalModules = recalculateLayout(id, updatedModules, state.excelData);
      return { modules: finalModules };
    }
    
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
    
    // Aktualizuj moduły z nowym produktem
    const updatedModules = state.modules.map((m) =>
      m.id === moduleId
        ? { ...m, ...moduleUpdates, products: updatedProducts }
        : m
    );

    // Wywołaj recalculateLayout na końcu
    const finalModules = recalculateLayout(moduleId, updatedModules, state.excelData);

    return { modules: finalModules };
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
    
    // Update Excel data - remove product and reorder positions
    let updatedExcelData = state.excelData;
    if (updatedExcelData) {
      const productToRemove = state.modules
        .find(m => m.id === targetModuleId)
        ?.products.find(p => p.id === productId);
      
      if (productToRemove?.ean) {
        // Remove product from Excel data
        updatedExcelData = updatedExcelData.filter(item => 
          item.ean !== productToRemove.ean && item.originalEan !== productToRemove.originalEan
        );
      }
    }
    
    const updatedModules = state.modules.map((module) => {
      if (module.id === targetModuleId) {
        const remainingProducts = module.products.filter((product) => product.id !== productId);
        
        // AUTO-RESIZE MODULE AFTER REMOVING PRODUCT
        const moduleUpdates = autoResizeModuleToFitProducts({ ...module, products: remainingProducts });
        
        return { ...module, ...moduleUpdates, products: remainingProducts };
      }
      return module;
    });
    
    // Wywołaj recalculateLayout po usunięciu produktu
    const finalModules = targetModuleId ? recalculateLayout(targetModuleId, updatedModules, updatedExcelData) : updatedModules;
    
    const newState = { 
      modules: finalModules,
      excelData: updatedExcelData,
      selectedProduct: state.selectedProduct === productId ? null : state.selectedProduct
    };
    
    return newState;
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
        return { ...module, products: remainingProducts };
      }
      return module;
    });
    
    if (!product || !fromModuleId) return state;
    
    // Find target module and calculate next position
    const targetModule = updatedModules.find(m => m.id === toModuleId);
    let nextPosition = 1;
    
    if (targetModule && state.excelData) {
      // Find highest position in target module for Excel data
      const targetModuleNumber = toModuleId.replace('module-', '');
      const moduleProducts = state.excelData.filter(item => item.module === targetModuleNumber);
      if (moduleProducts.length > 0) {
        const maxPosition = Math.max(...moduleProducts.map(p => Math.floor(p.position || 0)));
        nextPosition = maxPosition + 1;
      }
    }
    
    // Update Excel data with new module and position
    let updatedExcelData = state.excelData;
    if (updatedExcelData && product.ean) {
      const toModuleNumber = toModuleId.replace('module-', '');
      updatedExcelData = updatedExcelData.map(item => {
        if (item.ean === product!.ean || item.originalEan === product!.originalEan) {
          return { ...item, module: toModuleNumber, position: nextPosition };
        }
        return item;
      });
    }
    
    // Add product to new module and auto-resize
    const finalModules = updatedModules.map((module) => {
      if (module.id === toModuleId) {
        const newProducts = [...module.products, {
          ...product!,
          moduleId: toModuleId,
          position: nextPosition,
          x: position?.x || 8, // Use provided position or default
          y: position?.y || 8,
        }];
        return { ...module, products: newProducts };
      }
      return module;
    });
    
    // Wywołaj recalculateLayout dla obu modułów
    let recalculatedModules = finalModules;
    if (fromModuleId) {
      recalculatedModules = recalculateLayout(fromModuleId, recalculatedModules, updatedExcelData);
    }
    recalculatedModules = recalculateLayout(toModuleId, recalculatedModules, updatedExcelData);
    
    const newState = { 
      modules: recalculatedModules,
      excelData: updatedExcelData
    };
    
    return newState;
  }),

  reorderProductsInModule: (moduleId, fromIndex, toIndex) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return state;

    // Zamień miejscami produkty w tablicy
    const newProducts = [...module.products];
    const [draggedProduct] = newProducts.splice(fromIndex, 1);
    newProducts.splice(toIndex, 0, draggedProduct);

    // Aktualizuj moduł z nową kolejnością produktów
    const updatedModules = state.modules.map((m) =>
      m.id === moduleId ? { ...m, products: newProducts } : m
    );

    // Zamień pozycje w excelData
    let updatedExcelData = state.excelData;
    if (updatedExcelData) {
      const moduleNumber = moduleId.replace('module-', '');
      
      // Znajdź produkty do zamiany w excelData
      const draggedProductEan = draggedProduct.ean || draggedProduct.originalEan;
      const targetProduct = newProducts[toIndex === 0 ? 1 : toIndex - 1];
      const targetProductEan = targetProduct?.ean || targetProduct?.originalEan;
      
      if (draggedProductEan && targetProductEan) {
        updatedExcelData = updatedExcelData.map(item => {
          if ((item.ean === draggedProductEan || item.originalEan === draggedProductEan) && item.module === moduleNumber) {
            const targetItem = updatedExcelData!.find(target => 
              (target.ean === targetProductEan || target.originalEan === targetProductEan) && target.module === moduleNumber
            );
            return targetItem ? { ...item, position: targetItem.position } : item;
          }
          if ((item.ean === targetProductEan || item.originalEan === targetProductEan) && item.module === moduleNumber) {
            const draggedItem = state.excelData!.find(dragged => 
              (dragged.ean === draggedProductEan || dragged.originalEan === draggedProductEan) && dragged.module === moduleNumber
            );
            return draggedItem ? { ...item, position: draggedItem.position } : item;
          }
          return item;
        });
      }
    }

    // Wywołaj recalculateLayout na końcu
    const finalModules = recalculateLayout(moduleId, updatedModules, updatedExcelData);
    
    return { 
      modules: finalModules,
      excelData: updatedExcelData
    };
  }),

  insertProductAtPosition: (moduleId, dragIndex, hoverIndex) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module) return state;

    // Usuń przeciągany produkt z oryginalnej pozycji
    const newProducts = [...module.products];
    const [draggedProduct] = newProducts.splice(dragIndex, 1);
    
    // Wstaw go na nową pozycję
    const adjustedHoverIndex = hoverIndex > dragIndex ? hoverIndex - 1 : hoverIndex;
    newProducts.splice(adjustedHoverIndex, 0, draggedProduct);

    // Aktualizuj moduł z nową kolejnością produktów
    const updatedModules = state.modules.map((m) =>
      m.id === moduleId ? { ...m, products: newProducts } : m
    );

    // Zaktualizuj numery position w excelData dla wszystkich przesuniętych produktów
    let updatedExcelData = state.excelData;
    if (updatedExcelData) {
      const moduleNumber = moduleId.replace('module-', '');
      
      // Znajdź wszystkie produkty tego modułu w excelData i zaktualizuj ich pozycje
      const moduleProductsInExcel = updatedExcelData.filter(item => item.module === moduleNumber);
      
      // Sortuj według nowej kolejności i przypisz nowe pozycje
      newProducts.forEach((product, index) => {
        const productEan = product.ean || product.originalEan;
        const excelIndex = updatedExcelData!.findIndex(item => 
          (item.ean === productEan || item.originalEan === productEan) && item.module === moduleNumber
        );
        
        if (excelIndex !== -1) {
          updatedExcelData![excelIndex] = {
            ...updatedExcelData![excelIndex],
            position: index + 1 // Pozycje zaczynają się od 1
          };
        }
      });
    }

    // Wywołaj recalculateLayout na końcu
    const finalModules = recalculateLayout(moduleId, updatedModules, updatedExcelData);
    
    return { 
      modules: finalModules,
      excelData: updatedExcelData
    };
  }),
  moveProductWithinModule: (productId, newPosition) => set((state) => {
    let targetModuleId: string | null = null;
    
    // Find which module contains the product
    for (const module of state.modules) {
      if (module.products.some(p => p.id === productId)) {
        targetModuleId = module.id;
        break;
      }
    }
    
    if (!targetModuleId) {
      return state;
    }
    
    const updatedModules = state.modules.map((module) => {
      if (module.id === targetModuleId) {
        const updatedProducts = module.products.map((product) => {
          if (product.id === productId) {
            return { 
              ...product, 
              x: newPosition.x,
              y: newPosition.y
            };
          }
          return product;
        });
        
        return { ...module, products: updatedProducts };
      }
      return module;
    });
    
    return { ...state, modules: updatedModules };
  }),

  updateProductPositionsInExcel: (moduleId) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module || !state.excelData) return state;
    
    const moduleNumber = moduleId.replace('module-', '');
    let updatedExcelData = [...state.excelData];
    
    // Update positions based on current product order in module
    module.products.forEach((product, index) => {
      if (product.ean) {
        const excelIndex = updatedExcelData.findIndex(item => 
          item.ean === product.ean || item.originalEan === product.originalEan
        );
        if (excelIndex !== -1) {
          updatedExcelData[excelIndex] = { 
            ...updatedExcelData[excelIndex], 
            position: index + 1 
          };
        }
      }
    });
    
    return { excelData: updatedExcelData };
  }),

  updatePositionsInModule: (moduleId) => set((state) => {
    const module = state.modules.find(m => m.id === moduleId);
    if (!module || !state.excelData) return state;
    
    // Sort products visually from left to right, then top to bottom
    const sortedProducts = [...module.products].sort((a, b) => {
      // First sort by Y position (top to bottom)
      if (Math.abs(a.y - b.y) > 10) { // 10px tolerance for same row
        return a.y - b.y;
      }
      // Then sort by X position (left to right) for same row
      return a.x - b.x;
    });
    
    const moduleNumber = moduleId.replace('module-', '');
    let updatedExcelData = [...state.excelData];
    
    // Update positions based on visual order
    sortedProducts.forEach((product, index) => {
      if (product.ean || product.originalEan) {
        const excelIndex = updatedExcelData.findIndex(row => {
          const productEan = product.originalEan || product.ean;
          const rowEan = row.originalEan || row.ean;
          return (rowEan === productEan || row.ean === product.ean) && 
                 row.module === moduleNumber;
        });
        
        if (excelIndex !== -1) {
          updatedExcelData[excelIndex] = {
            ...updatedExcelData[excelIndex],
            position: index + 1
          };
        }
      }
    });
    
    return { excelData: updatedExcelData };
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
  
  setBackgroundScale: (scale) => set({ backgroundScale: scale }),
  
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

        return {
          ...module,
          ...moduleUpdates,
          name: `Module ${moduleNumber}`,
          products: updatedProducts,
        };
      }
      
      return module;
    });

    // Wywołaj recalculateLayout dla wszystkich modułów z produktami
    let finalModules = updatedModules;
    updatedModules.forEach(module => {
      if (module.products.length > 0) {
        finalModules = recalculateLayout(module.id, finalModules, state.excelData);
      }
    });

    return { modules: finalModules };
  }),
  
  setFontSettings: (settings) => set((state) => ({
    fontSettings: { ...state.fontSettings, ...settings }
  })),
  
  setDragMode: (mode) => set({ dragMode: mode }),
  
  exportConfig: () => {
    const state = get();
    
    // SERIALIZE IMAGES TO BASE64 FOR JSON EXPORT
    const serializeModules = async (): Promise<Module[]> => {
      const serializedModules = await Promise.all(
        state.modules.map(async (module) => {
          const serializedProducts = await Promise.all(
            module.products.map(async (product) => {
              let serializedImageData = null;
              let originalFileData = null;
              
              // Serialize original file if available (best quality)
              if (product.originalFile) {
                try {
                  originalFileData = {
                    name: product.originalFile.name,
                    type: product.originalFile.type,
                    size: product.originalFile.size,
                    data: await fileToBase64(product.originalFile)
                  };
                } catch (error) {
                  console.warn('Failed to serialize original file for product:', product.name, error);
                }
              }
              
              // Always serialize imageUrl as fallback
              if (product.imageUrl) {
                serializedImageData = product.imageUrl;
              }
              
              return {
                ...product,
                serializedImageData,
                originalFileData,
                // Keep imageUrl for immediate use but mark it as potentially temporary
                imageUrl: product.imageUrl
              };
            })
          );
          
          return {
            ...module,
            products: serializedProducts
          };
        })
      );
      
      return serializedModules;
    };
    
    // Return a promise-based config for async serialization
    return {
      ...state,
      modules: state.modules, // Will be replaced with serialized version
      scale: state.scale,
      workspace: state.workspace,
      backgroundImage: state.backgroundImage,
      backgroundDimensions: state.backgroundDimensions,
      excelData: state.excelData,
      fontSettings: state.fontSettings,
      // Add metadata to indicate this config contains serialized images
      _hasSerializedImages: true,
      _exportTimestamp: new Date().toISOString(),
      // Add async serialization method
      _serializeImages: serializeModules
    };
  },
  
  importConfig: async (config) => {
    // DESERIALIZE IMAGES FROM BASE64 WHEN IMPORTING JSON
    const deserializeModules = async (modules: Module[]): Promise<Module[]> => {
      return Promise.all(
        modules.map(async (module) => {
          const deserializedProducts = await Promise.all(
            module.products.map(async (product: any) => {
              let imageUrl = product.imageUrl;
              let originalFile = product.originalFile;
              
              // Restore original file from serialized data
              if (product.originalFileData) {
                try {
                  const blob = base64ToBlob(product.originalFileData.data);
                  originalFile = new File([blob], product.originalFileData.name, {
                    type: product.originalFileData.type
                  });
                  
                  // Create new object URL for the restored file
                  imageUrl = URL.createObjectURL(originalFile);
                } catch (error) {
                  console.warn('Failed to restore original file for product:', product.name, error);
                }
              }
              
              // Restore imageUrl from serialized data if no original file
              if (!originalFile && product.serializedImageData) {
                imageUrl = product.serializedImageData;
              }
              
              // Clean up serialization properties
              const cleanProduct = { ...product };
              delete cleanProduct.serializedImageData;
              delete cleanProduct.originalFileData;
              
              return {
                ...cleanProduct,
                imageUrl,
                originalFile
              };
            })
          );
          
          return {
            ...module,
            products: deserializedProducts
          };
        })
      );
    };
    
    // Check if config has serialized images
    const hasSerializedImages = (config as any)._hasSerializedImages;
    
    let deserializedModules = config.modules;
    if (hasSerializedImages) {
      try {
        deserializedModules = await deserializeModules(config.modules);
        console.log('Successfully restored images from JSON import');
      } catch (error) {
        console.error('Failed to deserialize images:', error);
        alert('Ostrzeżenie: Nie udało się przywrócić niektórych zdjęć z importowanego pliku. Może być konieczne ponowne wgranie obrazów.');
      }
    } else {
      console.warn('Imported config does not contain serialized images');
      alert('Ostrzeżenie: Importowany plik nie zawiera zapisanych zdjęć. Będzie konieczne ponowne wgranie obrazów produktów.');
    }
    
    set({
      modules: deserializedModules,
      scale: config.scale,
      workspace: config.workspace,
      backgroundImage: config.backgroundImage || null,
      backgroundDimensions: (config as any).backgroundDimensions || null,
      excelData: (config as any).excelData || null,
      fontSettings: config.fontSettings || initialState.fontSettings,
    });
  },
  
  resetPlanogram: () => set({
    ...initialState,
    backgroundImage: null,
    backgroundDimensions: null,
    excelData: null,
    originalExcelFile: null,
  }),
}));