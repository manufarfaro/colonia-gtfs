// Clock abstraction for testability. Production uses SystemClock (new Date()).
export interface Clock {
  now(): Date;
}

export const CLOCK_TOKEN = 'CLOCK';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
