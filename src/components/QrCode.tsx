import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(""));
  }, [value, size]);
  if (!dataUrl) return <div style={{ width: size, height: size }} className="bg-gray-100" />;
  return <img src={dataUrl} width={size} height={size} alt={`QR code for ${value}`} />;
}
