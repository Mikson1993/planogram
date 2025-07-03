import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Edit3, Eye, RefreshCw, Ruler } from 'lucide-react';
import { usePlanogramStore } from '../stores/planogramStore';
import { clsx } from 'clsx';

export const ModuleList: React.FC = () => {
  const { 
    modules, 
    selectedModule, 
    selectModule, 
    removeModule, 
    updateModule,
    rescaleProductsInModule 
  } = usePlanogramStore();
  
  // Refs for each module element
  const moduleRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Auto-scroll to selected module
  useEffect(() => {
    if (!selectedModule) return;

    console.log('Auto-scrolling to selected module:', selectedModule);

    const selectedElement = moduleRefs.current[selectedModule];
    if (!selectedElement) {
      console.log('Selected module element not found in refs');
      return;
    }

    console.log('Found selected module element:', selectedElement);

    // Find the scrollable container (sidebar)
    let scrollableContainer = selectedElement.parentElement;
    let attempts = 0;
    const maxAttempts = 10;

    while (scrollableContainer && attempts < maxAttempts) {
      const computedStyle = window.getComputedStyle(scrollableContainer);
      const hasOverflowY = computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll';
      const hasSidebarClass = scrollableContainer.classList.contains('sidebar');
      
      console.log(`Checking element (attempt ${attempts + 1}):`, {
        className: scrollableContainer.className,
        overflowY: computedStyle.overflowY,
        hasOverflowY,
        hasSidebarClass,
        scrollHeight: scrollableContainer.scrollHeight,
        clientHeight: scrollableContainer.clientHeight
      });
      
      if (hasOverflowY && scrollableContainer.scrollHeight > scrollableContainer.clientHeight) {
        console.log('Found scrollable container:', scrollableContainer);
        break;
      }
      
      scrollableContainer = scrollableContainer.parentElement;
      attempts++;
    }

    if (!scrollableContainer) {
      console.log('No scrollable container found after', attempts, 'attempts');
      return;
    }

    // Calculate positions for smooth scrolling
    const containerRect = scrollableContainer.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();
    
    // Calculate the element's position relative to the scrollable container
    const elementTop = elementRect.top - containerRect.top + scrollableContainer.scrollTop;
    const elementHeight = elementRect.height;
    const containerHeight = containerRect.height;
    
    // Calculate target scroll position to center the element
    const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
    
    console.log('Scrolling calculation:', {
      elementTop,
      elementHeight,
      containerHeight,
      currentScrollTop: scrollableContainer.scrollTop,
      targetScrollTop: Math.max(0, targetScrollTop)
    });

    // Smooth scroll to the target position
    scrollableContainer.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });

  }, [selectedModule]);

  // Set ref for each module
  const setModuleRef = (moduleId: string) => (element: HTMLDivElement | null) => {
    moduleRefs.current[moduleId] = element;
  };

  const handleModuleNameChange = (id: string, name: string) => {
    updateModule(id, { name });
  };

  const handleModuleDimensionChange = (id: string, field: 'width' | 'height' | 'depth', value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateModule(id, { [field]: numValue });
    }
  };

  const handleRescaleProducts = (e: React.MouseEvent, moduleId: string) => {
    e.stopPropagation();
    rescaleProductsInModule(moduleId);
  };

  const handleModuleClick = (moduleId: string) => {
    console.log('Module clicked in sidebar:', moduleId);
    selectModule(moduleId);
  };

  return (
    <div className="space-y-2">
      {modules.map((module) => (
        <div
          key={module.id}
          ref={setModuleRef(module.id)}
          data-module-id={module.id}
          className={clsx(
            'border rounded-lg p-3 transition-all cursor-pointer',
            selectedModule === module.id
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          )}
          onClick={() => handleModuleClick(module.id)}
        >
          <div className="flex items-center justify-between mb-2">
            <input
              type="text"
              value={module.name}
              onChange={(e) => handleModuleNameChange(module.id, e.target.value)}
              className="font-medium text-sm bg-transparent border-none outline-none flex-1"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-1">
              {module.products.length > 0 && (
                <button
                  onClick={(e) => handleRescaleProducts(e, module.id)}
                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                  title="Rescale products to fit module"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectModule(selectedModule === module.id ? null : module.id);
                }}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeModule(module.id);
                }}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Module Dimensions */}
          <div className="space-y-2 mb-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block">Width (mm)</label>
                <input
                  type="number"
                  value={Math.round(module.width)}
                  onChange={(e) => handleModuleDimensionChange(module.id, 'width', e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block">Height (mm)</label>
                <input
                  type="number"
                  value={Math.round(module.height)}
                  onChange={(e) => handleModuleDimensionChange(module.id, 'height', e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block">Depth (mm)</label>
              <input
                type="number"
                value={Math.round(module.depth || 300)}
                onChange={(e) => handleModuleDimensionChange(module.id, 'depth', e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            <div>Position: ({Math.round(module.x)}, {Math.round(module.y)}) px</div>
            <div className="flex items-center justify-between">
              <span>Products: {module.products.length}</span>
              {selectedModule === module.id && (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
                  Selected
                </span>
              )}
            </div>
            {module.products.length > 0 && (
              <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                ✓ Auto-scaling enabled
              </div>
            )}
          </div>
        </div>
      ))}
      
      {modules.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-sm">No modules added yet</div>
          <div className="text-xs mt-1">Click "Add Module" to get started</div>
        </div>
      )}
    </div>
  );
};