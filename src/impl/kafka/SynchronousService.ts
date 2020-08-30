import {Entity} from '../../Entity';
import {EntityConsumer} from './Consumer';
import {EntityPublisher} from './Publisher';
import {EntityTopic} from '../../Topic';
import {
  Deferred,
  SynchronousMessage,
  SynchronousProducer as Producer,
  SynchronousConsumer as Consumer
} from '../../SynchronousService';
import * as Kafka from 'node-rdkafka';

export abstract class SynchronousProducer<
  MI,
  MT,
  T,
  E extends Entity<T>,
  M extends SynchronousMessage<MI, MT, T, E>
> extends EntityPublisher<MI, M>
  implements Producer<MI, MT, T, E, M> {
  private returnMap: Map<string, Deferred<MI, MT, T, E, M>>;

  constructor(
    protected readonly topic: EntityTopic<MI, M>,
    protected readonly producer: Kafka.HighLevelProducer,
    protected readonly returnTopic: EntityTopic<MI, M>,
    protected readonly consumer: Kafka.KafkaConsumer
  ) {
    super(topic, producer);
    this.consumer
      .on('data', (msg: Kafka.Message) => {
        this.onData(msg);
      })
      .on('event.error', err => {
        console.log(err);
      });
    this.returnMap = new Map<string, Deferred<MI, MT, T, E, M>>();
  }

  async start(): Promise<void> {
    let producerReady = false;
    let consumerReady = false;
    return new Promise(resolve => {
      const pf = () => {
        this.producer.removeListener('ready', pf);
        producerReady = true;
        if (producerReady && consumerReady) {
          this.consumer.subscribe([this.returnTopic.topicName]);
          this.consumer.consume();
          resolve();
        }
      };
      this.producer.on('ready', pf);
      this.producer.connect();

      const cf = () => {
        this.consumer.removeListener('ready', cf);
        consumerReady = true;
        if (consumerReady && producerReady) {
          this.consumer.subscribe([this.returnTopic.topicName]);
          this.consumer.consume();
          resolve();
        }
      };
      this.consumer.on('ready', cf);
      this.consumer.connect();
    });
  }

  async stop(): Promise<{
    producerMetrics: Kafka.ClientMetrics;
    consumerMetrics: Kafka.ClientMetrics;
  }> {
    let producerMetrics: Kafka.ClientMetrics | null = null;
    let consumerMetrics: Kafka.ClientMetrics | null = null;
    return new Promise(resolve => {
      this.producer.on('disconnected', metrics => {
        producerMetrics = metrics;
        if (producerMetrics && consumerMetrics) {
          resolve({producerMetrics, consumerMetrics});
        }
      });
      this.consumer.on('disconnected', metrics => {
        consumerMetrics = metrics;
        if (producerMetrics && consumerMetrics) {
          resolve({producerMetrics, consumerMetrics});
        }
      });
      this.producer.disconnect();
      this.consumer.disconnect();
    });
  }

  private onData(incoming: Kafka.Message): void {
    if (incoming.value === null) {
      return;
    }
    const str = incoming.value.toString();
    let key: MI | undefined = undefined;
    if (incoming.key) {
      key = this.topic.serializer.deserializeKey(incoming.key.toString());
    }
    const msg: M = this.topic.serializer.deserialize(str);
    this.dispatch(msg, key);
  }

  abstract newOutboundMessage(messageType: MT, entity: E): M;

  async produce(messageType: MT, entity: E): Promise<E> {
    const msg = this.newOutboundMessage(messageType, entity);

    // The promise we want to block on is the promise which resolves
    // when the return response is received. Keep references to the
    // constructor params so that we can resolve or reject the promise
    // when the timeout fires or the response arrives.
    const deferred: Deferred<MI, MT, T, E, M> = {
      out: msg,
      resolve: () => {},
      reject: () => {},
    };
    const p = new Promise<E>((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    this.returnMap.set((msg.id as unknown) as string, deferred);

    // now send the message
    try {
      await super.publish(msg);
    } catch (err) {
      // send failed, so clear the returnMap to avoid leak
      console.log('error sending synchronous message: ' + err);
      this.returnMap.delete((msg.id as unknown) as string);
      throw err;
    }

    // set a response timeout which rejects the promise.  This is a terrible way to
    // solve this.  Should have single timer firing every second, blowing away all
    // deferreds which have expired but not been blown away - timerwheel style
    setTimeout(() => {
      const deferred = this.returnMap.get((msg.id as unknown) as string);
      if (deferred) {
        console.log('timeout found deferred, rejecting');
        this.returnMap.delete((msg.id as unknown) as string);
        deferred.reject(new Error('response timed out'));
      }
    }, 5000);

    // return the promise.
    return p;
  }

  dispatch(msg: M, key?: MI): void {
    console.log('publisher received response: ' + JSON.stringify(msg));
    const deferred = this.returnMap.get((key as unknown) as string);
    if (deferred) {
      console.log('found deferred promise');
      this.returnMap.delete((key as unknown) as string);
      deferred.resolve(msg.entity);
    } else {
      console.log('no deferred promise. Old message or timedout response');
    }
  }
}

export class SynchronousConsumer<
  MI,
  MT,
  T,
  E extends Entity<T>,
  M extends SynchronousMessage<MI, MT, T, E>
> extends EntityConsumer<MI, M>
  implements Consumer<MI, MT, T, E, M> {
  constructor(
    protected readonly topic: EntityTopic<MI, M>,
    protected readonly consumer: Kafka.KafkaConsumer,
    protected readonly producer: Kafka.HighLevelProducer
  ) {
    super(topic, consumer);
  }

  async start(): Promise<void> {
    let producerReady = false;
    let consumerReady = false;
    return new Promise(resolve => {
      const pf = () => {
        this.producer.removeListener('ready', pf);
        producerReady = true;
        if (producerReady && consumerReady) {
          this.consumer.subscribe([this.topic.topicName]);
          this.consumer.consume();
          resolve();
        }
      };
      this.producer.on('ready', pf);
      this.producer.connect();

      const cf = () => {
        this.consumer.removeListener('ready', cf);
        consumerReady = true;
        if (consumerReady && producerReady) {
          this.consumer.subscribe([this.topic.topicName]);
          this.consumer.consume();
          resolve();
        }
      };
      this.consumer.on('ready', cf);
      this.consumer.connect();
    });
  }

  async stop(): Promise<{
    producerMetrics: Kafka.ClientMetrics;
    consumerMetrics: Kafka.ClientMetrics;
  }> {
    let producerMetrics: Kafka.ClientMetrics | null = null;
    let consumerMetrics: Kafka.ClientMetrics | null = null;
    return new Promise(resolve => {
      this.producer.on('disconnected', metrics => {
        producerMetrics = metrics;
        if (producerMetrics && consumerMetrics) {
          resolve({producerMetrics, consumerMetrics});
        }
      });
      this.consumer.on('disconnected', metrics => {
        consumerMetrics = metrics;
        if (producerMetrics && consumerMetrics) {
          resolve({producerMetrics, consumerMetrics});
        }
      });
      this.producer.disconnect();
      this.consumer.disconnect();
    });
  }

  async publish(msg: M): Promise<number> {
    const topicName = msg.returnTopic;
    msg.returnTopic = '';
    console.log('publishing response: ' + JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      this.producer.produce(
        // use the specified return topic, not the incoming topic
        topicName,
        null,
        // use the serializer from the incoming topic, since they must be compatible
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

  dispatch(msg: M, key?: MI): void {
    console.log('received msg: ' + JSON.stringify(msg));
    this.publish(msg).then(
      offset => {
        console.log('published response to offset: ' + offset);
      },
      error => {
        console.log(
          'error publishing response with key: ' +
            key +
            ' to topic: ' +
            msg.returnTopic +
            ' error: ' +
            error
        );
      }
    );
  }
}
