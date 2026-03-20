import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

export default function BarcodeScanner({ onDetected, active }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      setScanning(false);
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setScanning(true);
    setError(null);

    reader
      .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          const text = result.getText();
          // Only pass ISBN-like barcodes (EAN-13 starting with 978/979, or raw 10-digit)
          if (/^97[89]\d{10}$/.test(text) || /^\d{10}$/.test(text)) {
            onDetected(text);
          }
        }
        // NotFoundException is normal (no barcode in frame) — ignore silently
        if (err && !(err instanceof NotFoundException)) {
          console.warn("Scanner error:", err);
        }
      })
      .catch((e) => {
        setError(e.message || "Camera access denied");
        setScanning(false);
      });

    return () => {
      reader.reset();
    };
  }, [active]);

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

      {/* Viewfinder overlay */}
      {scanning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-32 border-2 border-sky-400 rounded-lg relative">
            <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-sky-400 rounded-tl" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-sky-400 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-sky-400 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-sky-400 rounded-br" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-sky-400 opacity-60 animate-pulse" />
          </div>
          <p className="absolute bottom-4 text-white text-sm font-medium text-shadow">
            Point at barcode
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center text-white p-4">
            <p className="text-2xl mb-2">📷</p>
            <p className="font-medium">Camera unavailable</p>
            <p className="text-sm text-gray-300 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
