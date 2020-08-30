import {Entity} from './Entity';
import {EntityConsumer} from './Consumer';
import {EntityPublisher} from './Publisher';

export interface SynchronousMessage<MI, MT, T, E extends Entity<T>>
  extends Entity<MI> {
  id: MI;
  messageType: MT;
  returnTopic: string;
  entity: E;
}

export type Deferred<
  MI,
  MT,
  T,
  E extends Entity<T>,
  M extends SynchronousMessage<MI, MT, T, E>
> = {
  out: M;
  resolve: (value?: E) => void;
  reject: (value?: any) => void;
};

export interface SynchronousProducer<
  MI,
  MT,
  T,
  E extends Entity<T>,
  M extends SynchronousMessage<MI, MT, T, E>
> extends EntityPublisher<MI, M>, EntityConsumer<MI, M> {
  produce(messageType: MT, entity: E): Promise<E>;
}

export interface SynchronousConsumer<
  MI,
  MT,
  T,
  E extends Entity<T>,
  M extends SynchronousMessage<MI, MT, T, E>
> extends EntityPublisher<MI, M>, EntityConsumer<MI, M> {}
