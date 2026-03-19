// Testing Strategy Design Document: tests/unit/storage.test.ts
// Unit tests for event queue storage operations
// Updated: 2026-02-05 | Target Coverage: 90%+

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDeviceId, getQueue, appendEvent, setQueue, popBatch, getRecentEvents } from '../../src/storage';
import { createMockVisitEvent, createMockEventBatch } from '../fixtures/events';

describe('Event Queue Storage (storage.ts)', () => {
  beforeEach(() => {
    // Reset chrome storage mock before each test
    vi.clearAllMocks();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue(undefined);
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: getDeviceId() first call → Generate and store → Returns new UUID
  // @category: core-functionality
  // @dependency: chrome.storage.local
  // @complexity: medium
  it('should generate and store device ID on first call', async () => {
    // Arrange: Empty storage (no existing device_id)
    chrome.storage.local.get.mockResolvedValueOnce({});

    // Act: Get device ID
    const deviceId = await getDeviceId();

    // Assert: Verify UUID format and storage
    expect(deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ device_id: deviceId });
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: getDeviceId() subsequent calls → Read from storage → Returns existing UUID
  // @category: core-functionality
  // @dependency: chrome.storage.local
  // @complexity: low
  it('should return existing device ID from storage', async () => {
    // Arrange: Pre-existing device_id in storage
    const existingId = 'existing-device-id-123';
    chrome.storage.local.get.mockResolvedValueOnce({ device_id: existingId });

    // Act: Get device ID
    const deviceId = await getDeviceId();

    // Assert: Verify existing ID returned, no new ID generated
    expect(deviceId).toBe(existingId);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: getQueue() with empty storage → Read storage → Returns empty array
  // @category: edge-case
  // @dependency: chrome.storage.local
  // @complexity: low
  it('should return empty array when queue is empty', async () => {
    // Arrange: Empty storage
    chrome.storage.local.get.mockResolvedValueOnce({});

    // Act: Get queue
    const queue = await getQueue();

    // Assert: Verify empty array
    expect(queue).toEqual([]);
    expect(queue).toHaveLength(0);
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: getQueue() with existing events → Read storage → Returns event array
  // @category: core-functionality
  // @dependency: chrome.storage.local
  // @complexity: low
  it('should return existing events from storage', async () => {
    // Arrange: Pre-populate storage with events
    const events = createMockEventBatch(3);
    chrome.storage.local.get.mockResolvedValueOnce({ event_queue: events });

    // Act: Get queue
    const queue = await getQueue();

    // Assert: Verify events returned
    expect(queue).toEqual(events);
    expect(queue).toHaveLength(3);
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: setQueue(events) → Store in chrome.storage → Events persisted
  // @category: core-functionality
  // @dependency: chrome.storage.local
  // @complexity: low
  it('should store events in chrome.storage.local', async () => {
    // Arrange: Create events to store
    const events = createMockEventBatch(2);

    // Act: Set queue
    await setQueue(events);

    // Assert: Verify storage was called correctly
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ event_queue: events });
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: appendEvent(event) → Add to existing queue → Event appended
  // @category: core-functionality
  // @dependency: chrome.storage.local
  // @complexity: medium
  it('should append event to existing queue', async () => {
    // Arrange: Start with 2 events in queue
    const existingEvents = createMockEventBatch(2);
    chrome.storage.local.get.mockResolvedValueOnce({ event_queue: existingEvents });

    const newEvent = createMockVisitEvent({ id: 'new-event' });

    // Act: Append event
    await appendEvent(newEvent);

    // Assert: Verify setQueue was called with 3 events
    expect(chrome.storage.local.set).toHaveBeenCalled();
    const setCall = (chrome.storage.local.set as any).mock.calls[0][0];
    expect(setCall.event_queue).toHaveLength(3);
    expect(setCall.event_queue[2].id).toBe('new-event');
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: popBatch(n) → Remove first n events → Returns batch and updates queue
  // @category: core-functionality
  // @dependency: chrome.storage.local
  // @complexity: medium
  it('should pop first n events from queue', async () => {
    // Arrange: Queue with 5 events
    const events = createMockEventBatch(5);
    chrome.storage.local.get.mockResolvedValueOnce({ event_queue: events });

    // Act: Pop 2 events
    const batch = await popBatch(2);

    // Assert: Verify first 2 events returned
    expect(batch).toHaveLength(2);
    expect(batch).toEqual(events.slice(0, 2));

    // Assert: Verify remaining 3 events stored
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      event_queue: events.slice(2)
    });
  });

  // AC-3: Unit Tests - Storage Layer
  // Behavior: getRecentEvents(n) → Non-destructive read → Returns n most recent events
  // @category: core-functionality
  // @dependency: chrome.storage.local
  // @complexity: medium
  it('should return n most recent events sorted by timestamp', async () => {
    // Arrange: Queue with events at different times
    const events = [
      createMockVisitEvent({ id: '1', ts: '2026-01-01T00:00:00.000Z' }),
      createMockVisitEvent({ id: '2', ts: '2026-01-01T00:02:00.000Z' }), // Most recent
      createMockVisitEvent({ id: '3', ts: '2026-01-01T00:01:00.000Z' }),
    ];
    chrome.storage.local.get.mockResolvedValueOnce({ event_queue: events });

    // Act: Get 2 most recent
    const recent = await getRecentEvents(2);

    // Assert: Verify returned in descending order (newest first)
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('2'); // Most recent
    expect(recent[1].id).toBe('3'); // Second most recent

    // Assert: Queue not modified (non-destructive)
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
