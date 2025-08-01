import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { X, GripVertical, ArrowRightLeft, Tag, RefreshCw } from 'lucide-react';
import { Product, ItemTypes, DragItem } from '../types';
import { usePlanogramStore } from '../stores/planogramStore';
import { clsx } from 'clsx';

interface ProductComponentProps {
  product: Product;
  index: number;
  moduleBeingDragged?: boolean;
  moduleBeingResized?: boolean;
}

export const ProductComponent: React.FC<ProductComponentProps> = ({ 
  product, 
  index, 
  moduleBeingDragged = false,
  moduleBeingResized = false 
}) => {
  const productRef = useRef<HTMLDivElement>(null);
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { 
    removeProduct, 
    moveProductWithinModule,
    modules, 
    selectProduct, 
    selectedProduct,
    dragMode
  } = usePlanogramStore();

  const module = modules.find(m => m.id === product.moduleId);
  const isSelected = selectedProduct === product.id;

  // Hide labels during module operations
  const shouldHideLabels = moduleBeingDragged || moduleBeingResized || isBeingDragged;

  // Drop functionality for product swapping within same module
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.PRODUCT,
    drop: (item: DragItem) => {
      // Sprawdź, czy produkt upuszczono w tym samym module
      if (item.moduleId === product.moduleId) {
        const dragIndex = item.index!;
        const hoverIndex = index;

        // Nie rób nic, jeśli to ten sam element
        if (dragIndex === hoverIndex) {
          return;
        }
        
        // TRYB PRZECIĄGANIA: Sprawdź aktualny dragMode ze stanu
        if (dragMode === 'swap') {
          // Tryb zamiany: Wywołaj istniejącą akcję reorderProductsInModule
          usePlanogramStore.getState().reorderProductsInModule(product.moduleId, dragIndex, hoverIndex);
        } else if (dragMode === 'insert') {
          // Tryb wstawiania: Wywołaj nową akcję insertProductAtPosition
          usePlanogramStore.getState().insertProductAtPosition(product.moduleId, dragIndex, hoverIndex);
        }

        // Zaktualizuj indeks przeciąganego elementu
        item.index = hoverIndex;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Drag functionality for moving products
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.PRODUCT,
    item: () => {
      setIsBeingDragged(true);
      return { 
        type: ItemTypes.PRODUCT, 
        id: product.id, 
        moduleId: product.moduleId,
        index,
        product: product,
        originalPosition: { x: product.x, y: product.y }
      };
    },
    end: (item, monitor) => {
      setIsBeingDragged(false);
      
      const dropResult = monitor.getDropResult();
      const clientOffset = monitor.getClientOffset();
      
      // Handle drop scenarios based on dropResult
      if (dropResult) {
        // Drop was handled by a specific drop target
        if (dropResult.type === 'same-module-reposition' ||
            dropResult.type === 'inter-module') {
          // Drop was handled by the drop target
          return;
        }
        return;
      }
      
      // Handle free positioning within module (dropped on empty space)
      if (!dropResult && clientOffset && module) {
        // Find the module element by traversing up the DOM
        let moduleElement = productRef.current?.parentElement;
        while (moduleElement && !moduleElement.classList.contains('module-content')) {
          moduleElement = moduleElement.parentElement;
        }
        
        if (moduleElement) {
          const moduleRect = moduleElement.getBoundingClientRect();
          
          // Calculate relative position within module content area
          const relativeX = clientOffset.x - moduleRect.left;
          const relativeY = clientOffset.y - moduleRect.top;
          
          // Calculate new position with bounds checking
          const newPosition = {
            x: Math.max(0, Math.min(relativeX - product.scaledWidth / 2, module.width - product.scaledWidth)),
            y: Math.max(0, Math.min(relativeY - product.scaledHeight / 2, module.height - product.scaledHeight))
          };
          
          // Update product position within module
          moveProductWithinModule(product.id, newPosition);
        }
      }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Combine refs
  const combinedRef = (node: HTMLDivElement | null) => {
    productRef.current = node;
    drag(drop(node));
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeProduct(product.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectProduct(product.id);
  };

  const handleMouseEnter = () => {
    if (!isBeingDragged && !shouldHideLabels) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const isSwapTarget = isOver && !isDragging && product.moduleId === modules.find(m => m.products.some(p => p.id === product.id))?.id;

  // Calculate label positions to stack them vertically below the product
  const labelBaseY = product.scaledHeight + 4; // Start 4px below the product
  const labelHeight = 20; // Approximate height of each label
  const labelSpacing = 2; // Space between labels

  return (
    <div
      ref={combinedRef}
      className={clsx(
        'absolute transition-none cursor-move', // Remove transitions for better performance
        isDragging && 'opacity-50 z-50',
        isSwapTarget && 'scale-105',
        isDragging && 'shadow-2xl',
        isSelected && 'ring-2 ring-blue-500'
      )}
      style={{
        left: product.x,
        top: product.y,
        width: product.scaledWidth,
        height: product.scaledHeight,
        overflow: 'visible', // Allow labels to overflow
        willChange: isDragging ? 'transform' : 'auto', // Optimize for dragging
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Product Image - NO BORDER/PADDING/MARGIN */}
      <img
        src={product.imageUrl}
        alt={product.name}
        className={clsx(
          'w-full h-full object-contain transition-none', // Remove transitions
          isSwapTarget ? 'ring-2 ring-blue-400' : '',
          isDragging && 'shadow-lg',
          isSelected && 'ring-2 ring-blue-500',
          isHovered && !isBeingDragged && !shouldHideLabels && 'scale-105'
        )}
        draggable={false}
        style={{
          // Maximum quality rendering settings
          imageRendering: '-webkit-optimize-contrast',
          WebkitImageSmoothing: true,
          imageSmoothing: true,
          // Enhanced quality filters for better visibility and sharpness
          filter: 'contrast(1.08) saturate(1.1) brightness(1.03)',
          // Force hardware acceleration for better rendering
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          // Ensure crisp edges
          objectFit: 'contain',
          objectPosition: 'center',
          // NO MARGINS OR PADDING
          margin: 0,
          padding: 0,
          border: 'none',
        }}
        loading="eager"
        decoding="sync"
        crossOrigin="anonymous"
        onLoad={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.naturalWidth > 0) {
            img.style.imageRendering = '-webkit-optimize-contrast';
          }
        }}
      />

      {/* LABELS - Only show when hovering over the IMAGE itself, positioned below product */}
      {isHovered && !shouldHideLabels && (
        <div className="absolute z-50" style={{ top: labelBaseY, left: 0, right: 0 }}>
          {/* Product Name Label */}
          <div 
            className="bg-white bg-opacity-95 border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 font-bold shadow-lg"
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              textRendering: 'optimizeLegibility',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              zIndex: 60,
            }}
          >
            {product.name}
          </div>

          {/* EAN Label */}
          {product.ean && (
            <div 
              className="bg-green-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 shadow-lg"
              style={{
                position: 'absolute',
                top: labelHeight + labelSpacing,
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                zIndex: 60,
              }}
            >
              <Tag className="w-2 h-2" />
              EAN: {product.ean}
            </div>
          )}

          {/* Dimensions Label */}
          {(product.realWidth || product.realHeight) && (
            <div 
              className="bg-purple-600 text-white px-2 py-1 rounded text-xs shadow-lg"
              style={{
                position: 'absolute',
                top: (labelHeight + labelSpacing) * (product.ean ? 2 : 1),
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                zIndex: 60,
              }}
            >
              {Math.round(product.realWidth || 0)}×{Math.round(product.realHeight || 0)}mm
            </div>
          )}

          {/* Drag Handle */}
          <div 
            className="bg-gray-800 text-white px-2 py-1 rounded text-xs flex items-center gap-1 shadow-lg"
            style={{
              position: 'absolute',
              top: (labelHeight + labelSpacing) * (product.ean && (product.realWidth || product.realHeight) ? 3 : product.ean || (product.realWidth || product.realHeight) ? 2 : 1),
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              zIndex: 60,
            }}
          >
            <GripVertical className="w-3 h-3" />
            Drag to move
          </div>
        </div>
      )}

      {/* Selection indicator - only show when not dragging and not during module operations */}
      {isSelected && !isBeingDragged && !shouldHideLabels && (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium z-50 whitespace-nowrap">
          Selected
        </div>
      )}

      {/* Transfer Indicator - only show when dragging */}
      {isDragging && (
        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs flex items-center gap-1 z-50 whitespace-nowrap">
          <ArrowRightLeft className="w-3 h-3" />
          Moving Product
        </div>
      )}
      
      {/* Product Overlay - only show when hovering and not dragging and not during module operations */}
      {isHovered && !isBeingDragged && !shouldHideLabels && (
        <div className="absolute inset-0 bg-black bg-opacity-20 transition-all flex items-center justify-center">
          <button
            onClick={handleRemove}
            className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-all transform scale-75 hover:scale-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Swap indicator - only for same module */}
      {isSwapTarget && (
        <div className="absolute inset-0 border-2 border-green-400 bg-green-100 bg-opacity-30 flex items-center justify-center">
          <div className="text-green-600 font-medium text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Swap positions
          </div>
        </div>
      )}

      {/* Scaling indicator - only show when dragging */}
      {isDragging && (
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-40">
          Real dimensions scaling
        </div>
      )}
    </div>
  );
};