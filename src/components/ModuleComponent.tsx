import React, { useRef, useState, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { clsx } from 'clsx';
import { Move, Maximize2, ArrowRightLeft } from 'lucide-react';
import { usePlanogramStore, calculateFreeSpace, calculateDepthCapacity } from '../stores/planogramStore';
import { Module, ItemTypes, DragItem } from '../types';
import { ProductComponent } from './ProductComponent';

interface ModuleComponentProps {
  module: Module;
}

export const ModuleComponent: React.FC<ModuleComponentProps> = ({ module }) => {
  const moduleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingModule, setIsDraggingModule] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const { 
    updateModule, 
    selectedModule, 
    selectModule, 
    moveProduct, 
    moveProductWithinModule,
    excelData,
    fontSettings 
  } = usePlanogramStore();

  const isSelected = selectedModule === module.id;
  const freeSpace = calculateFreeSpace(module);
  const depthCapacities = calculateDepthCapacity(module, excelData);
  const headerHeight = 40; // Fixed header height

  // Drag functionality for moving modules
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.MODULE,
    item: () => {
      setIsDraggingModule(true);
      return { type: ItemTypes.MODULE, id: module.id };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      setIsDraggingModule(false);
    },
  });

  // Drop functionality for receiving products from other modules
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: [ItemTypes.PRODUCT],
    drop: (item: any, monitor) => {
      // Handle inter-module transfers
      if (item.moduleId !== module.id) {
        // Calculate drop position relative to module content area (below header)
        const dropOffset = monitor.getClientOffset();
        if (dropOffset && moduleRef.current) {
          const moduleRect = moduleRef.current.getBoundingClientRect();
          const relativeX = dropOffset.x - moduleRect.left;
          const relativeY = dropOffset.y - moduleRect.top - headerHeight; // Subtract header height
          
          // Move the product to this module
          moveProduct(item.id, module.id, {
            x: Math.max(0, Math.min(relativeX - (item.product?.scaledWidth || 50) / 2, module.width - (item.product?.scaledWidth || 50))),
            y: Math.max(0, Math.min(relativeY - (item.product?.scaledHeight || 50) / 2, module.height - (item.product?.scaledHeight || 50))),
          });
          
          return { moved: true, type: 'inter-module' };
        } else {
          // Fallback: just move without specific position
          moveProduct(item.id, module.id);
          return { moved: true, type: 'inter-module' };
        }
      } else {
        // Same module - handle repositioning
        const dropOffset = monitor.getClientOffset();
        if (dropOffset && moduleRef.current) {
          const moduleRect = moduleRef.current.getBoundingClientRect();
          const relativeX = dropOffset.x - moduleRect.left;
          const relativeY = dropOffset.y - moduleRect.top - headerHeight;
          
          const newPosition = {
            x: Math.max(0, Math.min(relativeX - (item.product?.scaledWidth || 50) / 2, module.width - (item.product?.scaledWidth || 50))),
            y: Math.max(0, Math.min(relativeY - (item.product?.scaledHeight || 50) / 2, module.height - (item.product?.scaledHeight || 50)))
          };
          
          // Use the store action to update position
          moveProductWithinModule(item.id, newPosition);
          
          return { moved: true, type: 'same-module-reposition' };
        }
        
        return { type: 'same-module-reposition' };
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }), // Only this module, not nested products
      canDrop: monitor.canDrop(),
    }),
  });

  // Optimized module dragging with RAF and offset calculation
  const handleModuleDrag = useCallback((e: React.MouseEvent) => {
    if (isResizing) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startModuleX = module.x;
    const startModuleY = module.y;
    
    // Calculate initial offset from mouse to module top-left
    const rect = moduleRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: startX - rect.left,
        y: startY - rect.top
      });
    }

    let animationFrameId: number;
    let lastUpdateTime = 0;
    const throttleMs = 16; // ~60fps

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime < throttleMs) return;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        updateModule(module.id, {
          x: Math.max(0, startModuleX + deltaX),
          y: Math.max(0, startModuleY + deltaY),
        });
        
        lastUpdateTime = now;
      });
    };

    const handleMouseUp = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDragOffset({ x: 0, y: 0 });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isResizing, module.x, module.y, module.id, updateModule]);

  // Combine drag and drop refs
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    moduleRef.current = node;
    drag(node);
    drop(node);
  }, [drag, drop]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle dragging if clicking on the module itself or header
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || 
        target.classList.contains('module-header') ||
        target.closest('.module-header')) {
      
      selectModule(module.id); // This will trigger auto-scroll in sidebar
      handleModuleDrag(e);
    }
  }, [selectModule, module.id, handleModuleDrag]);

  // MANUAL RESIZE - allows user to override auto-sizing
  const handleResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = module.width;
    const startHeight = module.height;

    console.log('Starting manual resize for module:', module.id, {
      startSize: { width: startWidth, height: startHeight }
    });

    let animationFrameId: number;
    let lastUpdateTime = 0;
    const throttleMs = 8; // Faster updates for smoother resize (120fps)

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime < throttleMs) return;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = Math.max(100, startWidth + deltaX);
        const newHeight = Math.max(50, startHeight + deltaY);
        
        // MANUAL RESIZE: Update module dimensions and rescale products
        // This will trigger the updateModule logic that rescales products
        updateModule(module.id, {
          width: newWidth,
          height: newHeight,
        });
        
        lastUpdateTime = now;
      });
    };

    const handleMouseUp = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setIsResizing(false);
      
      console.log('Manual resize completed for module:', module.id, {
        finalSize: { width: module.width, height: module.height }
      });
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [module.width, module.height, module.id, updateModule]);

  // Check if this module can accept products from other modules
  const canAcceptProducts = isOver && canDrop;

  // Total visual height = header height + content height
  const totalVisualHeight = headerHeight + module.height;

  return (
    <div
      ref={combinedRef}
      className={clsx(
        'absolute', // Remove transition-none to allow smooth updates
        isSelected ? 'z-30' : 'z-20',
        isDragging && 'opacity-50 z-50',
        canAcceptProducts && 'z-40',
        isResizing && 'select-none',
        isDraggingModule && 'z-50'
      )}
      style={{
        left: module.x,
        top: module.y,
        width: module.width,
        height: totalVisualHeight, // Total visual height includes header
        cursor: isDraggingModule ? 'grabbing' : (isResizing ? 'se-resize' : 'grab'),
        overflow: 'visible', // Allow labels to overflow
        willChange: isDraggingModule || isResizing ? 'transform' : 'auto', // Optimize for animations
        transition: isResizing ? 'none' : 'all 0.1s ease-out', // Smooth transitions except during resize
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Module Header - SEPARATE from content area */}
      <div 
        className="module-header absolute top-0 left-0 right-0 bg-gray-50 border-2 border-gray-300 border-b-gray-200 px-3 py-2 rounded-t-lg flex items-center justify-between cursor-grab z-10"
        style={{ 
          height: headerHeight,
          borderBottomWidth: '1px',
          pointerEvents: isResizing ? 'none' : 'auto' // Disable during resize
        }}
      >
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-gray-400" />
          {fontSettings.showModuleName && (
            <span 
              className="font-medium text-gray-700"
              style={{ 
                fontSize: `${fontSettings.moduleNameSize}px`,
                whiteSpace: 'nowrap',
                wordSpacing: '0.1em',
                letterSpacing: '0.02em'
              }}
            >
              {module.name}
            </span>
          )}
        </div>
        {fontSettings.showModuleInfo && (
          <div className="flex items-center gap-3">
            <div 
              className="text-gray-500"
              style={{ fontSize: `${fontSettings.moduleInfoSize}px` }}
            >
              {Math.round(module.width)}×{Math.round(module.height)}mm
            </div>
            {module.products.length > 0 && (
              <div 
                className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
                style={{ fontSize: `${fontSettings.moduleInfoSize}px` }}
              >
                {module.products.length} products
              </div>
            )}
            <div 
              className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-medium"
              style={{ fontSize: `${fontSettings.moduleInfoSize}px` }}
            >
              Free: {Math.round(freeSpace)}mm
            </div>
          </div>
        )}
      </div>

      {/* Module Content Area - TRANSPARENT BACKGROUND */}
      <div 
        className={clsx(
          'absolute border-2 rounded-b-lg shadow-sm bg-transparent', // TRANSPARENT BACKGROUND
          isSelected ? 'border-blue-500 shadow-md' : 'border-gray-300',
          canAcceptProducts && 'border-green-400 shadow-lg ring-2 ring-green-200'
        )}
        style={{ 
          top: headerHeight, // Start after header
          left: 0,
          right: 0,
          height: module.height, // Only content height
          overflow: 'visible', // Allow product labels to overflow
          borderTopWidth: 0, // No top border (connects to header)
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          pointerEvents: isDraggingModule ? 'none' : 'auto', // Disable during module drag
          transition: isResizing ? 'none' : 'all 0.1s ease-out', // Smooth transitions except during resize
          backgroundColor: 'transparent', // Ensure transparency
        }}
      >
        {/* Products Container - NO PADDING, NO SPACING */}
        <div 
          className={clsx(
            'absolute inset-0',
            isDraggingModule && 'dragging' // Only hide labels during module drag, NOT during resize
          )}
          style={{ 
            overflow: 'visible', // Allow product labels to overflow
            padding: 0, // NO PADDING
            margin: 0, // NO MARGIN
            backgroundColor: 'transparent', // Ensure transparency
          }}
        >
          {module.products.map((product, index) => (
            <div key={product.id} className="relative">
              {/* Product Component - NO SPACING */}
              <ProductComponent 
                product={product} 
                index={index}
                moduleBeingDragged={isDraggingModule}
                moduleBeingResized={false} // Don't hide products during resize
              />
              
              {/* Depth Capacity Label - SUMOWANE DLA PRODUKTÓW W TEJ SAMEJ POZYCJI */}
              {fontSettings.showDepthInfo && module.depth && !isDraggingModule && !isResizing && depthCapacities[product.id]?.isVisible && (
                <div 
                  className="absolute bg-gray-100 border border-gray-300 rounded-sm px-1 py-0.5 text-center"
                  style={{ 
                    top: product.y + product.scaledHeight + 2, // 2px below product
                    left: depthCapacities[product.id].x, // Use calculated group position
                    width: depthCapacities[product.id].width, // Use calculated group width
                    fontSize: `${fontSettings.depthInfoSize}px`,
                    zIndex: 40,
                    pointerEvents: 'none', // Don't interfere with product interactions
                  }}
                >
                  <span className="text-gray-700 font-medium">
                    {depthCapacities[product.id].capacity} pcs
                  </span>
                </div>
              )}
            </div>
          ))}
          
          {module.products.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              <div className="text-center bg-white bg-opacity-80 p-2 rounded">
                <div className="mb-2">Drop products here</div>
                <div className="text-xs">or drag from other modules</div>
              </div>
            </div>
          )}
        </div>

        {/* Product Transfer Indicator */}
        {canAcceptProducts && (
          <div className="absolute inset-0 bg-green-100 bg-opacity-90 border-2 border-dashed border-green-500 rounded-b-lg flex items-center justify-center pointer-events-none z-10">
            <div className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg">
              <ArrowRightLeft className="w-5 h-5" />
              Drop Product Here
            </div>
          </div>
        )}

        {/* Resize Handle - ALWAYS VISIBLE for manual override */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-400 hover:bg-gray-600 transition-colors z-20"
          onMouseDown={handleResize}
          style={{
            clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
          }}
          title="Drag to manually resize module (overrides auto-sizing)"
        >
          <Maximize2 className="w-3 h-3 text-white absolute bottom-0.5 right-0.5" />
        </div>
      </div>
      
      {/* Selection Indicator */}
      {isSelected && !isDraggingModule && !isResizing && (
        <div className="absolute -inset-1 border-2 border-blue-500 rounded-lg pointer-events-none z-50">
          <div className="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 rounded text-xs">
            Selected
          </div>
        </div>
      )}

      {/* Resize Indicator */}
      {isResizing && (
        <div className="absolute -top-8 right-0 bg-gray-800 text-white px-2 py-1 rounded text-xs z-50">
          {Math.round(module.width)} × {Math.round(module.height)} mm
          <div className="text-xs text-gray-300">Manual resize</div>
        </div>
      )}
    </div>
  );
};