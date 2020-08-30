import {Entity, Message} from './Entity';

export interface Consumer<M extends Message> {
  start(): Promise<any>;
  stop(): Promise<any>;
  dispatch(msg: M): void;
}

export interface EntityConsumer<T, E extends Entity<T>> extends Consumer<E> {
  start(): Promise<any>;
  stop(): Promise<any>;
  dispatch(msg: E, key?: T): void;
}
