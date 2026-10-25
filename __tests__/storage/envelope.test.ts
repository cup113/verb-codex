import { createEnvelope } from '../../src/storage/envelope';

describe('createEnvelope', () => {
  it('builds the first snapshot once, and hands the same one back until asked', () => {
    let builds = 0;
    const envelope = createEnvelope(() => ({ n: ++builds }));

    const first = envelope.getSnapshot();

    expect(envelope.getSnapshot()).toBe(first);
    expect(builds).toBe(1);
  });

  it('photographs the value as it stands now, not as it stood at creation', () => {
    // The store's mutable variable is what `build` reads; a cached-at-creation
    // snapshot would publish stale values forever.
    let value = 'before';
    const envelope = createEnvelope(() => ({ value }));

    value = 'after';
    envelope.publish();

    expect(envelope.getSnapshot().value).toBe('after');
  });

  it('publishes a fresh snapshot object on every change', () => {
    const envelope = createEnvelope(() => ({ n: 1 }));
    const before = envelope.getSnapshot();

    envelope.publish();

    expect(envelope.getSnapshot()).not.toBe(before);
  });

  it('notifies its listeners until they unsubscribe', () => {
    const envelope = createEnvelope(() => ({ n: 1 }));
    let notifications = 0;
    const unsubscribe = envelope.subscribe(() => {
      notifications += 1;
    });

    envelope.publish();
    expect(notifications).toBe(1);

    unsubscribe();
    envelope.publish();
    expect(notifications).toBe(1);
  });
});
