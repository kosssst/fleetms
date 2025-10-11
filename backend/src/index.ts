import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { connectDB } from './db/mongoose';
import { notFound, errorHandler } from './middleware/error.middleware';
import { initWebSocketServer } from './websockets/socket';

import authRoutes from './routes/auth.routes';
import companyRoutes from './routes/company.routes';
import userRoutes from './routes/user.routes';
import vehicleRoutes from './routes/vehicle.routes';
import tripRoutes from './routes/trip.routes';
import dashboardRoutes from './routes/dashboard.routes';

dotenv.config();

connectDB();

const app: Express = express();
const port = process.env.PORT || 8000;

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/company', companyRoutes);
app.use('/users', userRoutes);
app.use('/vehicles', vehicleRoutes);
app.use('/trips', tripRoutes);
app.use('/dashboard', dashboardRoutes)

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server');
});

app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});

initWebSocketServer(server);
