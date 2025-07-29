import React, { useRef, useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { usePlanogramStore } from '../stores/planogramStore';
import { ModuleComponent } from './ModuleComponent';
import { WorkspaceToolbar } from './WorkspaceToolbar';
import { ItemTypes, DragItem } from '../types';

export const Workspace: React.FC = () => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showHorizontalScrollbar, setShowHorizontalScrollbar] = useState(false);
  
  const { 
    modules, 
    workspace, 
    backgroundImage, 
    backgroundDimensions,
    backgroundScale,
    setWorkspace,
  } = usePlanogramStore();

  const [{ isOver }, drop] = useDrop({
    accept: [ItemTypes.PRODUCT, ItemTypes.MODULE],
    drop: (item: DragItem, monitor) => {
      // Only handle items dropped directly on workspace (not on modules)
      if (!monitor.didDrop()) {
        console.log('Item dropped on workspace:', item);
        // Handle workspace drops if needed
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  // Auto-expand workspace when modules are created outside bounds
  useEffect(() => {
    if (modules.length === 0) return;

    let maxX = 0;
    let maxY = 0;

    modules.forEach(module => {
      const moduleRight = module.x + module.width;
      const moduleBottom = module.y + module.height + 40; // Include header height
      
      if (moduleRight > maxX) maxX = moduleRight;
      if (moduleBottom > maxY) maxY = moduleBottom;
    });

    // Add padding
    const padding = 100;
    const requiredWidth = maxX + padding;
    const requiredHeight = maxY + padding;

    // Use background dimensions if available, otherwise use workspace dimensions
    const currentWidth = backgroundDimensions?.width || workspace.width;
    const currentHeight = backgroundDimensions?.height || workspace.height;

    // Only update if dimensions actually need to change
    if (requiredWidth > currentWidth || requiredHeight > currentHeight) {
      const newWidth = Math.max(requiredWidth, currentWidth);
      const newHeight = Math.max(requiredHeight, currentHeight);
      
      // Only call setWorkspace if the dimensions are actually different
      if (newWidth !== currentWidth || newHeight !== currentHeight) {
        setWorkspace({ width: newWidth, height: newHeight });
      }
    }
  }, [modules, backgroundDimensions, setWorkspace]); // Removed workspace from dependencies to prevent infinite loop

  // Check if horizontal scrollbar should be visible
  useEffect(() => {
    const checkScrollbar = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const needsHorizontalScroll = container.scrollWidth > container.clientWidth;
        setShowHorizontalScrollbar(needsHorizontalScroll);
      }
    };

    checkScrollbar();
    window.addEventListener('resize', checkScrollbar);
    
    return () => window.removeEventListener('resize', checkScrollbar);
  }, [modules, workspace, backgroundDimensions, zoom]);

  // Handle horizontal scroll synchronization
  const handleHorizontalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollLeft = e.currentTarget.scrollLeft;
    setScrollLeft(newScrollLeft);
    
    // Sync with main workspace scroll
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
  };

  const handleWorkspaceScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollLeft = e.currentTarget.scrollLeft;
    setScrollLeft(newScrollLeft);
  };

  // Handle zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 3));
    }
  };

  // Handle panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle mouse or Alt+Left mouse
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Reset zoom and pan
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setScrollLeft(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  };

  // Use background dimensions if available, otherwise use workspace dimensions
  const workspaceWidth = backgroundDimensions?.width || workspace.width;
  const workspaceHeight = backgroundDimensions?.height || workspace.height;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar - Fixed at top */}
      <div className="flex-shrink-0">
        <WorkspaceToolbar 
          workspaceRef={workspaceRef} 
          zoom={zoom}
          onZoomIn={() => setZoom(prev => Math.min(prev * 1.2, 3))}
          onZoomOut={() => setZoom(prev => Math.max(prev * 0.8, 0.1))}
          onResetView={resetView}
        />
      </div>

      {/* Horizontal Scrollbar - Only visible when needed */}
      {showHorizontalScrollbar && (
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
          <div 
            className="overflow-x-auto overflow-y-hidden h-4 bg-white"
            onScroll={handleHorizontalScroll}
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 #f1f5f9'
            }}
          >
            {/* Invisible content to create scrollbar with correct width */}
            <div 
              style={{ 
                width: workspaceWidth * zoom + pan.x,
                height: 1,
                minWidth: '100%'
              }}
            />
          </div>
        </div>
      )}
      
      {/* Scrollable workspace content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onScroll={handleWorkspaceScroll}
        style={{ 
          cursor: isPanning ? 'grabbing' : 'default',
          scrollLeft: scrollLeft
        }}
      >
        <div
          className="mx-auto"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'top left',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <div
            ref={(node) => {
              workspaceRef.current = node;
              drop(node);
            }}
            className="relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            style={{
              width: workspaceWidth,
              height: workspaceHeight,
              minWidth: workspaceWidth,
              minHeight: workspaceHeight,
            }}
          >
            {/* Background Image */}
            {backgroundImage && (
              <div 
                className="absolute bg-no-repeat"
                style={{
                  top: 0,
                  left: 0,
                  backgroundImage: `url(${backgroundImage})`,
                  backgroundSize: backgroundDimensions 
                    ? `${backgroundDimensions.width}px ${backgroundDimensions.height}px`
                    : 'contain',
                  backgroundPosition: 'top left',
                  width: backgroundDimensions ? `${backgroundDimensions.width}px` : '100%',
                  height: backgroundDimensions ? `${backgroundDimensions.height}px` : '100%',
                  imageRendering: 'high-quality',
                  transform: `scale(${backgroundScale})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none', // Nie blokuje interakcji z modułami
                }}
              />
            )}
            
            {/* Grid background (only when no background image) */}
            {!backgroundImage && (
              <div 
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #000 1px, transparent 1px),
                    linear-gradient(to bottom, #000 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px',
                }}
              />
            )}
            
            {/* Modules */}
            {modules.map((module) => (
              <ModuleComponent key={module.id} module={module} />
            ))}
            
            {/* Drop overlay for workspace */}
            {isOver && (
              <div className="absolute inset-0 bg-blue-100 bg-opacity-30 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none">
                <div className="text-blue-600 font-medium">
                  Workspace drop area
                </div>
              </div>
            )}
            
            {/* Empty state */}
            {modules.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-lg font-medium mb-2">Empty Planogram</div>
                  <div className="text-sm">Add modules from the sidebar to get started</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};