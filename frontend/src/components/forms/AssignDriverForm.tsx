
'use client';

import React, { useState, useEffect } from 'react';
import { Vehicle } from '@/types/vehicle.types';
import { User } from '@/types/user.types';
import { getCompanyUsers } from '@/services/company.service';
import { useAuth } from '@/context/AuthContext';

interface AssignDriverFormProps {
  vehicle: Vehicle;
  onSubmit: (vehicleId: string, driverId: string) => void;
  onClose: () => void;
}

const AssignDriverForm: React.FC<AssignDriverFormProps> = ({ vehicle, onSubmit, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      if (user?.companyId) {
        try {
          const companyUsers = await getCompanyUsers(user.companyId);
          setUsers(companyUsers);
        } catch (error) {
          console.error('Failed to fetch company users', error);
        }
      }
    };

    fetchUsers();
  }, [user?.companyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDriver) {
      onSubmit(vehicle.id, selectedDriver);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Assign Driver for {vehicle.manufacturer} {vehicle.modelName}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Driver</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              required
            >
              <option value="" disabled>Select a driver</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-action">
            <button type="submit" className="btn btn-primary">
              Assign
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignDriverForm;
