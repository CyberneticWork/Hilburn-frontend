export function googleDriveLogoUrl(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  let id = "";
  const pathMatch = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const queryMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const lhMatch = value.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) id = pathMatch[1];
  else if (queryMatch) id = queryMatch[1];
  else if (lhMatch) id = lhMatch[1];
  if (!id) return value;
  return `https://lh3.googleusercontent.com/d/${id}`;
}

/** Crop baked-in white / empty padding so the mark fills the sidebar slot. */
export function trimLogoWhitespace(src) {
  return new Promise((resolve) => {
    const url = String(src || "").trim();
    if (!url || typeof window === "undefined") {
      resolve(url);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(url);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);
        const isEmpty = (i) => {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          return a < 18 || (r > 248 && g > 248 && b > 248);
        };
        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            if (!isEmpty((y * w + x) * 4)) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX <= minX || maxY <= minY) {
          resolve(url);
          return;
        }
        const pad = 1;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
        const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);
        const out = document.createElement("canvas");
        out.width = sw;
        out.height = sh;
        const outCtx = out.getContext("2d");
        outCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        const cropped = outCtx.getImageData(0, 0, sw, sh);
        const px = cropped.data;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 18 || (px[i] > 248 && px[i + 1] > 248 && px[i + 2] > 248)) {
            px[i + 3] = 0;
          }
        }
        outCtx.putImageData(cropped, 0, 0);
        resolve(out.toDataURL("image/png"));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}
