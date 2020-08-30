import {Entity, Message} from './Entity';

// basic publisher interface which sends message of type M to a Topic
export interface Publisher<M extends Message> {
  start(): Promise<any>;
  stop(): Promise<any>;
  publish(msg: M): Promise<any>;
}

export interface EntityPublisher<T, E extends Entity<T>> extends Publisher<E> {
  start(): Promise<any>;
  stop(): Promise<any>;
  publish(entity: E): Promise<any>;
}
