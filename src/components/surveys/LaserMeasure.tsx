"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { getLaserManager, isBluetoothSupported, LaserMeasurement, LaserConnectionState } from "@/lib/bluetooth-laser";

interface LaserMeasureProps {
  /** Called when a measurement is received - L or H based on whichDimension */
  onMeasure: (dimension: "L" | "H", mm: number) => void;
  /** Which dimension we're currently measuring */
  whichDimension: "L" | "H";
  /** Current values for display */
  currentL: number;
  currentH: number;
  /** Disabled state */
  disabled?: boolean;
}

export function LaserMeasure({ onMeasure, whichDimension, currentL, currentH, disabled }: LaserMeasureProps) {
  const t = useTranslations("fieldTools");
  const locale = useLocale();
  const [connectionState, setConnectionState] = useState<LaserConnectionState>({
    connected: false,
    deviceName: null,
    lastMeasurement: null,
    error: null,
  });
  const [connecting, setConnecting] = useState(false);
  const managerRef = useRef(getLaserManager());

  useEffect(() => {
    const manager = managerRef.current;
    manager.setCallbacks({
      onMeasurement: (measurement: LaserMeasurement) => {
        // The laser sends one dimension at a time - we assume it's the one currently selected
        onMeasure(whichDimension, measurement.L);
      },
      onConnectionChange: (state) => setConnectionState(state),
      onError: (error) => setConnectionState(prev => ({ ...prev, error })),
    });

    return () => {
      manager.setCallbacks({});
    };
  }, [whichDimension, onMeasure]);

  const handleConnect = async () => {
    if (!isBluetoothSupported()) {
      alert(t("btUnsupportedAlert"));
      return;
    }
    if (connectionState.connected) {
      await managerRef.current.disconnect();
      return;
    }

    setConnecting(true);
    const device = await managerRef.current.requestDevice();
    if (device) {
      await managerRef.current.connect();
    }
    setConnecting(false);
  };

  if (!isBluetoothSupported()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-amber-800 mb-2">
          <span className="text-lg">⚠️</span>
          <strong>{t("btUnsupported")}</strong>
        </div>
        <p className="text-sm text-amber-700">{t("btUseBrowsers")}</p>
        <div className="mt-2 p-2 bg-white rounded border border-amber-200 text-xs text-amber-700">{t("btManual")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{t("laserTitle")}</h3>
        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
          connectionState.connected 
            ? "bg-emerald-100 text-emerald-700" 
            : "bg-zinc-100 text-zinc-600"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            connectionState.connected ? "bg-emerald-500" : "bg-zinc-400"
          }`}></span>
          {connectionState.connected ? t("connected") : t("notConnected")}
        </span>
      </div>

      {connectionState.error && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
          {connectionState.error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={connecting || disabled}
        className={`w-full py-3 rounded-xl font-semibold transition-colors ${
          connectionState.connected
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-zinc-900 text-white hover:bg-zinc-800"
        } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
      >
        {connecting ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t("laserConnecting")}
          </>
        ) : connectionState.connected ? (
          <>
            <span>📡</span> {t("laserDisconnect")}
          </>
        ) : (
          <>
            <span>📡</span> {t("laserConnect")}
          </>
        )}
      </button>

      {connectionState.connected && connectionState.deviceName && (
        <div className="text-xs text-zinc-500 text-center">
          Dispositivo: <span className="font-mono font-semibold">{connectionState.deviceName}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={`relative p-3 rounded-xl border-2 ${
          whichDimension === "L" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
        }`}>
          <label className="text-xs font-bold text-zinc-500">{t("openingW")}</label>
          <div className="mt-1">
            <span className="mono text-2xl font-bold text-zinc-900">{currentL || "—"}</span>
            <span className="text-xs text-zinc-500 ml-1">mm</span>
            {whichDimension === "L" && connectionState.lastMeasurement && (
              <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded">
                Nuova misura!
              </div>
            )}
          </div>
        </div>
        <div className={`relative p-3 rounded-xl border-2 ${
          whichDimension === "H" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
        }`}>
          <label className="text-xs font-bold text-zinc-500">{t("openingH")}</label>
          <div className="mt-1">
            <span className="mono text-2xl font-bold text-zinc-900">{currentH || "—"}</span>
            <span className="text-xs text-zinc-500 ml-1">mm</span>
            {whichDimension === "H" && connectionState.lastMeasurement && (
              <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded">
                Nuova misura!
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onMeasure("L", 0)} // placeholder - just for dimension selection
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            whichDimension === "L" 
              ? "bg-zinc-900 text-white" 
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
          disabled={disabled}
        >
          {t("measureW")}
        </button>
        <button
          onClick={() => onMeasure("H", 0)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            whichDimension === "H" 
              ? "bg-zinc-900 text-white" 
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
          disabled={disabled}
        >
          {t("measureH")}
        </button>
      </div>

      <p className="text-[11px] text-zinc-500 text-center">
        {t("laserHint")}<br />
        {t("laserOffline")}
      </p>

      {connectionState.lastMeasurement && (
        <div className="text-xs text-zinc-500 text-center">
          {t("lastReading", { l: connectionState.lastMeasurement.L, time: new Date(connectionState.lastMeasurement.timestamp).toLocaleTimeString(locale) })}
        </div>
      )}
    </div>
  );
}