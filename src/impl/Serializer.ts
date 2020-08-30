import {Entity} from '../Entity';
import {EntitySerializer as Serializer} from '../Serializer';
import {deserialize, serialize} from 'typescript-json-serializer';

export abstract class EntitySerializer<T, E extends Entity<T>>
  implements Serializer<T, E> {
  serializeKey(msg: E): string {
    return (msg.id as unknown) as string;
  }
  serialize(msg: E): string {
    return JSON.stringify(serialize(msg));
  }
  deserialize(str: string): E {
    return deserialize(JSON.parse(str), this.classConstructor());
  }
  abstract deserializeKey(str: string): T;
  abstract classConstructor(): new (...params: any[]) => E;
}
