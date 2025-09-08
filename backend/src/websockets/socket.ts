
import { Server } from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { User } from '../types/user.types';
import {CompanyModel} from "../models/company.model";

export const createWebSocketServer = (server: Server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws: WebSocket, req) => {
    const token = req.url?.split('token=')[1];

    if (!token) {
      ws.close(1008, 'Token not provided');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
      const user = await UserModel.findById(decoded.id).select('-password') as User;

      if (!user) {
        ws.close(1008, 'Invalid token');
        return;
      }

      const company = await CompanyModel.findById(user.companyId);
      if (!company) {
        ws.close(1008, 'Company not found');
        return;
      }

      ws.on('message', (message: string) => {
        console.log('received: %s', message);
      });

      ws.send('authenticated');
    } catch (error) {
      ws.close(1008, 'Authentication failed');
    }
  });
};
