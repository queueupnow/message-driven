export type Message = {};

// specialized message that has an entityId, which serves as
// messaging Key
export interface Entity<T> extends Message {
  id: T;
}
