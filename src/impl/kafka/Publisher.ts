import {Entity} from '../../Entity';
import {EntityPublisher as Publisher} from '../../Publisher';
import {EntityTopic} from '../';
import * as Kafka from 'node-rdkafka';

export class EntityPublisher<T, E extends Entity<T>>
  implements Publisher<T, E> {
  constructor(
    protected readonly topic: EntityTopic<T, E>,
    protected readonly producer: Kafka.HighLevelProducer
  ) {}

  async start(): Promise<void> {
    return new Promise(resolve => {
      this.producer.on('ready', () => {
        resolve();
      });
      this.producer.connect();
    });
  }

  async stop(): Promise<{producerMetrics: Kafka.ClientMetrics}> {
    return new Promise(resolve => {
      this.producer.on('disconnected', metrics => {
        resolve({producerMetrics: metrics});
      });
      this.producer.disconnect();
    });
  }

  async publish(msg: E): Promise<number> {
    return new Promise((resolve, reject) => {
      this.producer.produce(
        this.topic.topicName,
        null,
        Buffer.from(this.topic.serializer.serialize(msg)),
        Buffer.from(this.topic.serializer.serializeKey(msg)),
        Date.now(),
        (err, offset) => {
          if (err || offset === null || offset === undefined) {
            reject(err);
          } else {
            resolve(offset);
          }
        }
      );
    });
  }
}
