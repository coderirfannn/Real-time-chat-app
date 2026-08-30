import mongoose, { type ConnectOptions } from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const dbLogger = logger.child('Database');

export type MongoConnectionState =
  'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'uninitialized';

const READY_STATES: Record<number, MongoConnectionState> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

class MongoConnectionManager {
  private isConnecting = false;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      dbLogger.info('MongoDB connection established successfully', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        db: mongoose.connection.name,
      });
    });

    mongoose.connection.on('error', (err: Error) => {
      dbLogger.error('MongoDB connection encountered an error', err);
    });

    mongoose.connection.on('disconnected', () => {
      dbLogger.warn('MongoDB connection lost / disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      dbLogger.info('MongoDB connection re-established');
    });

    mongoose.connection.on('close', () => {
      dbLogger.info('MongoDB connection closed');
    });
  }

  public async connect(uri: string = config.mongo.uri): Promise<typeof mongoose> {
    if (this.isReady()) {
      return mongoose;
    }

    if (this.isConnecting) {
      dbLogger.warn('MongoDB connection attempt already in progress');
      return mongoose;
    }

    this.isConnecting = true;

    const options: ConnectOptions = {
      dbName: config.mongo.dbName,
      maxPoolSize: config.mongo.maxPoolSize,
      minPoolSize: config.mongo.minPoolSize,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: config.app.isDevelopment,
    };

    try {
      dbLogger.info('Connecting to MongoDB...', {
        dbName: config.mongo.dbName,
        maxPoolSize: config.mongo.maxPoolSize,
      });

      const instance = await mongoose.connect(uri, options);
      this.isConnecting = false;
      return instance;
    } catch (error) {
      this.isConnecting = false;
      dbLogger.error('Failed to connect to MongoDB', error as Error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState === 0) {
      return;
    }

    try {
      dbLogger.info('Closing MongoDB connection...');
      await mongoose.disconnect();
      dbLogger.info('MongoDB disconnected cleanly');
    } catch (error) {
      dbLogger.error('Error during MongoDB disconnect', error as Error);
      throw error;
    }
  }

  public getStatus(): MongoConnectionState {
    const stateNumber = mongoose.connection.readyState;
    return READY_STATES[stateNumber] || 'uninitialized';
  }

  public isReady(): boolean {
    return mongoose.connection.readyState === 1;
  }
}

export const mongoManager = new MongoConnectionManager();
export const connectMongo = mongoManager.connect.bind(mongoManager);
export const disconnectMongo = mongoManager.disconnect.bind(mongoManager);
export const getMongoStatus = mongoManager.getStatus.bind(mongoManager);
export const isMongoReady = mongoManager.isReady.bind(mongoManager);
