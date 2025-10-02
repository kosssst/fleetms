import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'trip_analysis';

let connection: any = null;
let channel: any = null;

export const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
};

export const sendToQueue = (message: string) => {
  if (channel) {
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });
  }
};
