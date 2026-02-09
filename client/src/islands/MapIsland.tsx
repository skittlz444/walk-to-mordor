import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

// Constants
const HEADER_HEIGHT = 80; // Height of the map page header in pixels

/**
 * MapIsland - Preact island component for the interactive Middle-earth map
 * 
 * This component will eventually use Konva.js to render an interactive map
 * with pan/zoom capabilities. For now, it's a placeholder shell.
 */
export function MapIsland() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    // Calculate responsive dimensions based on viewport
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = window.innerHeight - HEADER_HEIGHT;
        setDimensions({ width, height });
      }
    };

    // Initial sizing
    updateDimensions();

    // Update on resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div ref={containerRef} className="map-island-container">
      <div 
        className="map-placeholder"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
      >
        <div className="map-placeholder-content">
          <i className="fas fa-map fa-3x"></i>
          <h2>Interactive Map</h2>
          <p>Middle-earth map canvas will render here</p>
          <div className="map-info">
            <p><strong>Dimensions:</strong> {dimensions.width} × {dimensions.height}px</p>
            <p><strong>Status:</strong> Ready for Konva integration</p>
          </div>
        </div>
      </div>
    </div>
  );
}
