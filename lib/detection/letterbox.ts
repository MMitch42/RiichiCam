// Letterbox math for feeding variable-aspect-ratio photos into a fixed-size
// (e.g. 640x640) YOLO input, and mapping detected boxes back to original
// pixel coordinates. Must match the preprocessing the model was exported
// with (Ultralytics' default centered-padding letterbox for a fixed square
// imgsz export, not the stride-snapped dynamic-shape variant) — a mismatch
// here is the single most likely source of silent accuracy loss.

export interface LetterboxInfo {
  scale: number;
  padX: number;
  padY: number;
  targetSize: number;
}

export function computeLetterbox(
  srcWidth: number,
  srcHeight: number,
  targetSize: number,
): LetterboxInfo {
  const scale = Math.min(targetSize / srcWidth, targetSize / srcHeight);
  const newWidth = Math.round(srcWidth * scale);
  const newHeight = Math.round(srcHeight * scale);
  const padX = (targetSize - newWidth) / 2;
  const padY = (targetSize - newHeight) / 2;
  return { scale, padX, padY, targetSize };
}

export interface Box {
  x: number; // center
  y: number; // center
  width: number;
  height: number;
}

// Maps a center-based box from model input space back to original image
// pixel space by inverting the letterbox scale + pad.
export function unletterboxBox(box: Box, info: LetterboxInfo): Box {
  return {
    x: (box.x - info.padX) / info.scale,
    y: (box.y - info.padY) / info.scale,
    width: box.width / info.scale,
    height: box.height / info.scale,
  };
}
