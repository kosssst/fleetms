import amqp from 'amqplib';

export class RabbitMQService {
  private static instance: RabbitMQService;
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  private constructor() {}

  public static async getInstance(): Promise<RabbitMQService> {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
      await RabbitMQService.instance.connect();
    }
    return RabbitMQService.instance;
  }

  private async connect() {
    try {
      const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
      this.connection = await amqp.connect(RABBITMQ_URL) as any;
      this.channel = await (this.connection as any).createChannel();
      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
    }
  }

  public async sendMessage(queue: string, message: string) {
    if (this.channel) {
      await (this.channel as any).assertQueue(queue, { durable: true });
      (this.channel as any).sendToQueue(queue, Buffer.from(message), { persistent: true });
    }
  }
}
