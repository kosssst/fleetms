
'use client';

import React, { useState, useEffect } from 'react';
import { Vehicle } from '@/types/vehicle.types';

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  onSubmit: (vehicle: Omit<Vehicle, 'id' | 'companyId' | 'driverId' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

const VehicleForm: React.FC<VehicleFormProps> = ({ vehicle, onSubmit, onClose }) => {
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [number, setNumber] = useState('');
  const [engineVolume, setEngineVolume] = useState(0);

  useEffect(() => {
    if (vehicle) {
      setManufacturer(vehicle.manufacturer);
      setModel(vehicle.model);
      setNumber(vehicle.number);
      setEngineVolume(vehicle.engineVolume);
    }
  }, [vehicle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ manufacturer, model, number, engineVolume });
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Manufacturer</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Model</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Number</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Engine Volume</span>
            </label>
            <input
              type="number"
              className="input input-bordered"
              value={engineVolume}
              onChange={(e) => setEngineVolume(Number(e.target.value))}
              required
            />
          </div>
          <div className="modal-action">
            <button type="submit" className="btn btn-primary">
              {vehicle ? 'Update' : 'Create'}
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

export default VehicleForm;
