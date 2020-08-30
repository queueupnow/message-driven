import {Entity, Message} from './Entity';
import {EntitySerializer, Serializer} from './Serializer';

// To send a msg to a topic, we require topicName and a mechanism
// for serialization of messages.
// We'll worry about deserialization and recv once we have the
// ability to send.
export interface Topic<M extends Message> {
  readonly topicName: string;
  readonly serializer: Serializer<M>;
}

export interface EntityTopic<T, E extends Entity<T>> extends Topic<E> {
  readonly topicName: string;
  readonly serializer: EntitySerializer<T, E>;
}
