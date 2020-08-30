import {expect} from 'chai';
import {JsonProperty, Serializable} from 'typescript-json-serializer';
import * as PubSub from '../src';
import * as Kafka from 'node-rdkafka';
import {v4 as uuidv4} from 'uuid';

const Impl = PubSub.Impl;
const KafkaImpl = PubSub.Impl.Kafka;

type QueueId = string & 'Queue';
@Serializable()
class Queue implements PubSub.Entity<string> {
  @JsonProperty()
  id: QueueId;
  @JsonProperty()
  name: string;
  @JsonProperty()
  description?: string;
  constructor(id: QueueId, name: string, description?: string) {
    this.id = id;
    this.name = name;
    this.description = description;
  }
}

class QueueSerializer extends Impl.EntitySerializer<QueueId, Queue> {
  deserializeKey(str: string): QueueId {
    return str as QueueId;
  }
  classConstructor(): new (...params: any[]) => Queue {
    return Queue;
  }
}

class QueueTopic extends Impl.EntityTopic<QueueId, Queue> {}

class QueuePublisher extends KafkaImpl.EntityPublisher<QueueId, Queue> {}

class QueueConsumer extends KafkaImpl.EntityConsumer<QueueId, Queue> {
  dispatch(msg: Queue, key?: QueueId): void {
    console.log(this.topic.serializer.serialize(msg));
    if (key) {
      console.log(
        'received key: ' +
          key +
          ' key: ' +
          this.topic.serializer.serializeKey(msg)
      );
    }
  }
}

type ServiceMethod = 'CREATE' | 'UPDATE' | 'READ' | 'DELETE';

@Serializable()
class QueueMessage
  implements PubSub.SynchronousMessage<string, ServiceMethod, QueueId, Queue> {
  @JsonProperty()
  id: string;
  @JsonProperty()
  messageType: ServiceMethod;
  @JsonProperty()
  returnTopic: string;
  @JsonProperty()
  entity: Queue;
  constructor(messageType: ServiceMethod, returnTopic: string, entity: Queue) {
    this.id = uuidv4();
    this.messageType = messageType;
    this.returnTopic = returnTopic;
    this.entity = entity;
  }
}

class QueueMessageSerializer extends Impl.EntitySerializer<
  string,
  QueueMessage
> {
  deserializeKey(str: string): string {
    return str;
  }

  classConstructor(): new (...params: any[]) => QueueMessage {
    return QueueMessage;
  }
}

class QueueMessageTopic extends Impl.EntityTopic<string, QueueMessage> {}

class QueueService extends KafkaImpl.SynchronousProducer<
  string,
  ServiceMethod,
  QueueId,
  Queue,
  QueueMessage
> {
  constructor(
    topic: QueueMessageTopic,
    producer: Kafka.HighLevelProducer,
    returnTopic: QueueMessageTopic,
    consumer: Kafka.KafkaConsumer
  ) {
    super(topic, producer, returnTopic, consumer);
  }

  newOutboundMessage(messageType: ServiceMethod, entity: Queue): QueueMessage {
    return new QueueMessage(messageType, this.returnTopic.topicName, entity);
  }
}

class QueueMessageConsumer extends KafkaImpl.SynchronousConsumer<
  string,
  ServiceMethod,
  QueueId,
  Queue,
  QueueMessage
> {
  constructor(
    topic: QueueMessageTopic,
    consumer: Kafka.KafkaConsumer,
    producer: Kafka.HighLevelProducer
  ) {
    super(topic, consumer, producer);
  }
}

describe('kafka test suite', () => {
  describe('async tests', () => {
    it('serializes a queue', async () => {
      const qs = new QueueSerializer();
      const q = new Queue('blah' as QueueId, 'myQueue');
      const q2 = qs.deserialize(qs.serialize(q));
      expect(qs.serialize(q)).to.equal('{"id":"blah","name":"myQueue"}');
      expect(q).to.be.instanceOf(Queue);
      expect(q2).to.be.instanceOf(Queue);
      expect(q2).to.eql({id: 'blah', name: 'myQueue', description: undefined});
      expect(q2).to.eql(q);
    });

    it('publishes a queue', async () => {
      const qs = new QueueSerializer();
      const q = new Queue('blah' as QueueId, 'myQueue');
      const q2 = new Queue('blah2' as QueueId, 'myQueue2');
      const qt = new QueueTopic('test', qs);
      const qp = new QueuePublisher(
        qt,
        new Kafka.HighLevelProducer(
          {
            'metadata.broker.list': '192.168.1.6:9092',
          },
          {}
        )
      );
      await qp.start();
      console.log('publish1');
      await qp.publish(q);
      console.log('publish2');
      await qp.publish(q2);
      await qp.stop();
    });

    it('consumes a queue', async () => {
      const qs = new QueueSerializer();
      const qt = new QueueTopic('test', qs);
      const qc = new QueueConsumer(
        qt,
        new Kafka.KafkaConsumer(
          {
            'metadata.broker.list': '192.168.1.6:9092',
            'group.id': 'queue',
            'enable.auto.commit': true,
          },
          {
            'auto.offset.reset': 'earliest',
          }
        )
      );
      await qc.start();
      setTimeout(async () => {
        await qc.stop();
      }, 3000);
    }).timeout(5000);
  });

  describe('sync tests', () => {
    it('can send a synchronous message', async () => {
      const qs = new QueueMessageSerializer();
      const q = new Queue('blah' as QueueId, 'myQueue');
      const qt = new QueueMessageTopic('queues', qs);
      const qrt = new QueueMessageTopic('queueReturn', qs);
      const qsvc = new QueueService(
        qt,
        new Kafka.HighLevelProducer(
          {
            'metadata.broker.list': '192.168.1.6:9092',
          },
          {}
        ),
        qrt,
        new Kafka.KafkaConsumer(
          {
            'metadata.broker.list': '192.168.1.6:9092',
            'group.id': 'queueReturn',
            'enable.auto.commit': true,
          },
          {
            'auto.offset.reset': 'earliest',
          }
        )
      );
      const qmc = new QueueMessageConsumer(
        qt,
        new Kafka.KafkaConsumer(
          {
            'metadata.broker.list': '192.168.1.6:9092',
            'group.id': 'queues',
            'enable.auto.commit': true,
          },
          {
            'auto.offset.reset': 'earliest',
          }
        ),
        new Kafka.HighLevelProducer({
          'metadata.broker.list': '192.168.1.6:9092',
        })
      );
      await qmc.start();
      await qsvc.start();
      const resp = await qsvc.produce('CREATE', q);
      console.log('response is: ' + JSON.stringify(resp));
      await Promise.all([qsvc.stop(), qmc.stop()]);
    }).timeout(5000);
  });
});
