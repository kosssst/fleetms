'use client';

import { VehiclesTable } from '@/components/tables/VehiclesTable';

const VehiclesPage = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Vehicles</h1>
      <VehiclesTable />
    </div>
  );
};

export default VehiclesPage;