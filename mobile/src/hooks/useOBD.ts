import { useState, useEffect } from 'react';
import { obdService } from '../services/obd.service';

export const useOBD = () => {
  const [obdData, setObdData] = useState<any>(null);

  useEffect(() => {
    const handleData = (data: any) => {
      setObdData(data);
    };

    obdService.registerListener(handleData);

    return () => {
      obdService.unregisterListener(handleData);
    };
  }, []);

  return {
    obdData,
  };
};