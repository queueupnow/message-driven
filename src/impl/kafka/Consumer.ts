import {Entity} from '../../Entity';
import {EntityConsumer as Consumer} from '../../Consumer';
import {EntityTopic} from '../Topic';
import * as Kafka from 'node-rdkafka';

export abstract class EntityConsumer<T, E extends Entity<T>>
  implements Consumer<T, E> {
  constructor(
    protected readonly topic: EntityTopic<T, E>,
    protected readonly consumer: Kafka.KafkaConsumer
  ) {
    this.consumer
      .on('data', (msg: Kafka.Message) => {
        this.onData(msg);
      })
      .on('event.error', err => {
        console.log(err);
      });
  }

  async start(): Promise<void> {
    return new Promise(resolve => {
      const f = () => {
        this.consumer.removeListener('ready', f);
        this.consumer.subscribe([this.topic.topicName]);
        this.consumer.consume();
        resolve();
      };
      this.consumer.on('ready', f);
      this.consumer.connect();
    });
  }

  async stop(): Promise<{consumerMetrics: Kafka.ClientMetrics}> {
    return new Promise(resolve => {
      this.consumer.once('disconnected', metrics => {
        resolve({consumerMetrics: metrics});
      });
      this.consumer.disconnect();
    });
  }

  commit(): void {
    this.consumer.commit();
  }

  protected onData(incoming: Kafka.Message): void {
    if (incoming.value === null) {
      return;
    }
    const str = incoming.value.toString();
    let key: T | undefined = undefined;
    if (incoming.key) {
      key = this.topic.serializer.deserializeKey(incoming.key.toString());
    }
    const msg: E = this.topic.serializer.deserialize(str);
    this.dispatch(msg, key);
  }

  abstract dispatch(msg: E, key?: T): void;
}
