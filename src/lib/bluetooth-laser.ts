/**
 * Web Bluetooth Laser Integration
 * 
 * Supports Leica DISTO (D2, D510, D810, S910) and Bosch GLM (50C, 100C, etc.)
 * via Bluetooth LE GATT services.
 * 
 * Leica DISTO service UUID: 0000181a-0000-1000-8000-00805f9b34fb (Environmental Sensing)
 *   - Measurement characteristic: 00002a6e-0000-1000-8000-00805f9b34fb (Distance)
 *   - Some models use proprietary service: 0000181c-0000-1000-8000-00805f9b34fb
 * Bosch GLM uses similar Environmental Sensing service
 */

// Web Bluetooth API types (not in standard TS lib)
interface BluetoothDevice {
  id: string;
  name: string | null;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener: (type: string, listener: EventListener) => void;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  value: DataView | null;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: "characteristicvaluechanged", listener: (event: Event) => void): void;
  removeEventListener(type: "characteristicvaluechanged", listener: (event: Event) => void): void;
}

interface RequestDeviceOptions {
  filters: Array<{ services?: string[]; namePrefix?: string }>;
  optionalServices?: string[];
}

interface BluetoothNavigator {
  bluetooth?: {
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  };
}

function parseLeicaDistance(data: DataView): number | null {
  try {
    if (data.byteLength >= 4) {
      const meters = data.getFloat32(0, true);
      if (meters > 0 && meters < 1000) {
        return Math.round(meters * 1000);
      }
    }
    if (data.byteLength >= 2) {
      const mm = data.getUint16(0, true);
      if (mm > 0 && mm < 100000) return mm;
    }
    return null;
  } catch {
    return null;
  }
}

function parseBoschDistance(data: DataView): number | null {
  try {
    if (data.byteLength >= 4) {
      const meters = data.getFloat32(0, true);
      if (meters > 0 && meters < 1000) {
        return Math.round(meters * 1000);
      }
    }
    if (data.byteLength >= 2) {
      const mm = data.getUint16(0, true);
      if (mm > 0 && mm < 100000) return mm;
    }
    return null;
  } catch {
    return null;
  }
}

export interface LaserDevice {
  id: string;
  name: string;
  manufacturer: "Leica" | "Bosch" | "Unknown";
  device: BluetoothDevice;
}

export interface LaserMeasurement {
  L: number;
  H: number;
  timestamp: number;
  deviceId: string;
}

export interface LaserConnectionState {
  connected: boolean;
  deviceName: string | null;
  lastMeasurement: LaserMeasurement | null;
  error: string | null;
}

const LEICA_DISTANCE_UUID = "00002a6e-0000-1000-8000-00805f9b34fb";
const ENVIRONMENTAL_SENSING_SERVICE = "0000181a-0000-1000-8000-00805f9b34fb";

export class LaserManager {
  private device: BluetoothDevice | null = null;
  private gattServer: BluetoothRemoteGATTServer | null = null;
  private distanceChar: BluetoothRemoteGATTCharacteristic | null = null;
  private manufacturer: "Leica" | "Bosch" | "Unknown" = "Unknown";
  private callbacks: {
    onMeasurement?: (measurement: LaserMeasurement) => void;
    onConnectionChange?: (state: LaserConnectionState) => void;
    onError?: (error: string) => void;
  } = {};

  constructor() {
    if (typeof window !== "undefined" && !("bluetooth" in navigator)) {
      console.warn("Web Bluetooth API not supported in this browser");
    }
  }

  setCallbacks(callbacks: typeof this.callbacks) {
    this.callbacks = callbacks;
  }

  private emitConnectionChange(state: Partial<LaserConnectionState>) {
    this.callbacks.onConnectionChange?.({
      connected: this.device !== null,
      deviceName: this.device?.name ?? null,
      lastMeasurement: null,
      error: null,
      ...state,
    });
  }

  private emitError(error: string) {
    this.callbacks.onError?.(error);
    this.emitConnectionChange({ error });
  }

  async requestDevice(): Promise<LaserDevice | null> {
    if (typeof window === "undefined" || !("bluetooth" in navigator)) {
      this.emitError("Web Bluetooth API non supportato");
      return null;
    }

    try {
      this.emitError("");
      const nav = navigator as unknown as BluetoothNavigator;
      if (!nav.bluetooth) {
        this.emitError("Web Bluetooth API non supportato");
        return null;
      }
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: [ENVIRONMENTAL_SENSING_SERVICE] },
          { namePrefix: "DISTO" },
          { namePrefix: "D2" },
          { namePrefix: "D510" },
          { namePrefix: "D810" },
          { namePrefix: "S910" },
          { namePrefix: "GLM" },
          { namePrefix: "Zamo" },
        ],
        optionalServices: [ENVIRONMENTAL_SENSING_SERVICE],
      });

      this.device = device;
      this.manufacturer = this.detectManufacturer(device.name ?? "");
      
      device.addEventListener("gattserverdisconnected", () => {
        this.cleanup();
        this.emitConnectionChange({ connected: false, deviceName: null, error: "Disconnesso" });
      });

      return {
        id: device.id,
        name: device.name ?? "Unknown",
        manufacturer: this.manufacturer,
        device,
      };
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotFoundError") {
        this.emitError("Nessun dispositivo laser trovato. Accendi il laser e riprova.");
      } else if (e instanceof DOMException && e.name === "SecurityError") {
        this.emitError("Permesso Bluetooth negato. Abilita nelle impostazioni del browser.");
      } else {
        this.emitError(`Errore connessione: ${e instanceof Error ? e.message : "Sconosciuto"}`);
      }
      return null;
    }
  }

  private detectManufacturer(name: string): "Leica" | "Bosch" | "Unknown" {
    const lower = name.toLowerCase();
    if (lower.includes("disto") || lower.includes("d2") || lower.includes("d510") || 
        lower.includes("d810") || lower.includes("s910") || lower.includes("leica")) {
      return "Leica";
    }
    if (lower.includes("glm") || lower.includes("zamo") || lower.includes("bosch")) {
      return "Bosch";
    }
    return "Unknown";
  }

  async connect(): Promise<boolean> {
    if (!this.device) {
      this.emitError("Nessun dispositivo selezionato");
      return false;
    }

    try {
      this.emitConnectionChange({ connected: false, error: "Connessione in corso..." });
      
      this.gattServer = await this.device.gatt!.connect();
      const service = await this.gattServer.getPrimaryService(ENVIRONMENTAL_SENSING_SERVICE);
      this.distanceChar = await service.getCharacteristic(this.getDistanceUUID());
      
      await this.distanceChar.startNotifications();
      this.distanceChar.addEventListener("characteristicvaluechanged", this.handleMeasurement.bind(this));
      
      this.emitConnectionChange({ 
        connected: true, 
        deviceName: this.device.name ?? null, 
        error: "" 
      });
      
      return true;
    } catch (e) {
      this.emitError(`Connessione fallita: ${e instanceof Error ? e.message : "Sconosciuto"}`);
      this.cleanup();
      return false;
    }
  }

  private getDistanceUUID(): string {
    return LEICA_DISTANCE_UUID;
  }

  private handleMeasurement(event: Event) {
    const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    let mm: number | null = null;
    
    if (this.manufacturer === "Leica") {
      mm = parseLeicaDistance(value);
    } else if (this.manufacturer === "Bosch") {
      mm = parseBoschDistance(value);
    } else {
      mm = parseLeicaDistance(value) ?? parseBoschDistance(value);
    }

    if (mm !== null && mm > 0 && mm < 100000) {
      const measurement: LaserMeasurement = {
        L: mm,
        H: 0,
        timestamp: Date.now(),
        deviceId: this.device?.id ?? "unknown",
      };
      
      this.callbacks.onMeasurement?.(measurement);
      this.emitConnectionChange({ 
        lastMeasurement: measurement,
        error: "",
      });
    }
  }

  async disconnect() {
    this.cleanup();
    this.emitConnectionChange({ connected: false, deviceName: null, lastMeasurement: null, error: "" });
  }

  private cleanup() {
    if (this.distanceChar) {
      try {
        this.distanceChar.removeEventListener("characteristicvaluechanged", this.handleMeasurement.bind(this));
        if (this.gattServer?.connected) {
          this.distanceChar.stopNotifications();
        }
      } catch {}
      this.distanceChar = null;
    }
    if (this.gattServer?.connected) {
      try {
        this.gattServer.disconnect();
      } catch {}
    }
    this.gattServer = null;
    this.device = null;
  }

  getConnectionState(): LaserConnectionState {
    return {
      connected: this.gattServer?.connected ?? false,
      deviceName: this.device?.name ?? null,
      lastMeasurement: null,
      error: null,
    };
  }
}

let laserManagerInstance: LaserManager | null = null;

export function getLaserManager(): LaserManager {
  if (!laserManagerInstance) {
    laserManagerInstance = new LaserManager();
  }
  return laserManagerInstance;
}

export function isBluetoothSupported(): boolean {
  return typeof window !== "undefined" && "bluetooth" in navigator;
}