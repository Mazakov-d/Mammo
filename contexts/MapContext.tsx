import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MapCoordinates {
  latitude: number;
  longitude: number;
  userName?: string;
}

interface MapContextType {
  targetLocation: MapCoordinates | null;
  setTargetLocation: (location: MapCoordinates | null) => void;
  clearTargetLocation: () => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [targetLocation, setTargetLocation] = useState<MapCoordinates | null>(null);

  const clearTargetLocation = () => {
    setTargetLocation(null);
  };

  return (
    <MapContext.Provider value={{
      targetLocation,
      setTargetLocation,
      clearTargetLocation,
    }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};