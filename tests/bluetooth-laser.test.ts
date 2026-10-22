import { describe, expect, test, vi } from "vitest";
import { LaserManager } from "../src/lib/bluetooth-laser";

/** Issue #40: disconnect must remove the exact listener connect() added and close the GATT link. */
describe("LaserManager connection lifecycle", () => {
  test("disconnect removes the same listener and closes the link", async () => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const characteristic = {
      startNotifications: vi.fn(async () => characteristic),
      stopNotifications: vi.fn(async () => characteristic),
      addEventListener: vi.fn((_: string, l: EventListenerOrEventListenerObject) => listeners.add(l)),
      removeEventListener: vi.fn((_: string, l: EventListenerOrEventListenerObject) => listeners.delete(l)),
    };
    const server = {
      connected: true,
      getPrimaryService: vi.fn(async () => ({ getCharacteristic: vi.fn(async () => characteristic) })),
      disconnect: vi.fn(() => {
        server.connected = false;
      }),
    };
    const device = { id: "d1", name: "DISTO D2", gatt: { connect: vi.fn(async () => server) } };

    const manager = new LaserManager();
    (manager as unknown as { device: unknown }).device = device;
    expect(await manager.connect()).toBe(true);
    expect(listeners.size).toBe(1);

    await manager.disconnect();
    expect(listeners.size).toBe(0);
    expect(characteristic.stopNotifications).toHaveBeenCalledTimes(1);
    expect(server.disconnect).toHaveBeenCalledTimes(1);
  });
});
