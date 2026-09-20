import { useEffect, useState } from "react";
import { googleDriveLogoUrl, trimLogoWhitespace } from "../utils/googleDriveLogo";

export default function BrandLogo({ src, alt = "", className = "", imgClassName = "" }) {
  const [url, setUrl] = useState(() => googleDriveLogoUrl(src));

  useEffect(() => {
    let cancelled = false;
    const next = googleDriveLogoUrl(src);
    setUrl(next);
    if (!next) return undefined;
    trimLogoWhitespace(next).then((trimmed) => {
      if (!cancelled && trimmed) setUrl(trimmed);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!url) return null;

  return (
    <div className={`inline-flex items-center overflow-hidden bg-transparent ${className}`}>
      <img
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        className={
          imgClassName ||
          "block h-full w-auto max-w-full object-contain object-left drop-shadow-[0_1px_10px_rgba(255,255,255,0.28)]"
        }
      />
    </div>
  );
}
