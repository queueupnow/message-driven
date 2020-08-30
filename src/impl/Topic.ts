import {Entity} from '../Entity';
import {EntitySerializer} from './Serializer';
import {EntityTopic as Topic} from '../Topic';

export class EntityTopic<T, E extends Entity<T>>
  implements Topic<T, E> {
  constructor(
    public topicName: string,
    public serializer: EntitySerializer<T, E>
  ) {}
}
