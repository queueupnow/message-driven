import {Entity, Message} from './Entity';

// All messages must be serializable to a Buffer and they key must be
// separately serializable to a Buffer.
export interface Serializer<M extends Message> {
  serialize(msg: M): string;
  classConstructor(): new (...params: any[]) => M;
  deserialize(str: string): M;
}

export interface EntitySerializer<T, E extends Entity<T>>
  extends Serializer<E> {
  serializeKey(msg: E): string;
  deserializeKey(key: string): T;
}
