import { Buffer } from 'buffer';

class DataQueue {
  private static instance: DataQueue;
  private queue: Buffer[] = [];

  private constructor() {}

  public static getInstance(): DataQueue {
    if (!DataQueue.instance) {
      DataQueue.instance = new DataQueue();
    }
    return DataQueue.instance;
  }

  public enqueue(data: Buffer) {
    this.queue.push(data);
  }

  public dequeue(): Buffer | undefined {
    return this.queue.shift();
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }
}

export const dataQueue = DataQueue.getInstance();
