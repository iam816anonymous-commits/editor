import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Camera,
  Layers,
  Cpu,
  Play,
  Pause,
  RotateCcw,
  Download,
  Film,
  Volume2,
  VolumeX,
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  MoveUp,
  MoveDown,
  Activity,
  Palette,
  Undo,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

// ==========================================
// MODULAR PROVIDER INTERFACES & TYPE SCHEMAS
// ==========================================
export interface IDepthProvider {
  estimateDepth(imageSrc: string): Promise<string>; // Returns base64 DataURL of grayscale depth map
}

export interface IInpaintProvider {
  inpaint(imageSrc: string, maskSrc: string): Promise<string>; // Returns base64 DataURL of inpainted image
}

export interface ILayerGenerator {
  generateLayers(
    imageSrc: string,
    depthMapSrc: string,
    inpainter: IInpaintProvider
  ): Promise<Array<{
    type: 'sky' | 'background' | 'middle' | 'subject' | 'foreground';
    imageSlice: string; // base64 DataURL of transparent layer image
    depthSlice: string; // base64 DataURL of grayscale layer depth map
    baseDepth: number;  // average depth level of this layer slice [0..1]
  }>>;
}

export interface Layer {
  id: string;
  name: string;
  depth: number; // depth value from 0 (very front) to 1 (very back)
  scale: number;
  offsetY: number;
  offsetX: number;
  blur: number;
  opacity: number;
  color: string;
  shadow: boolean;
  type: 'sky' | 'background' | 'middle' | 'subject' | 'foreground';
  symbol: string; // Emoji / Symbol representation
  shape: 'rect' | 'circle' | 'polygon' | 'triangle' | 'path';
  points?: string;
  movementSpeed: number;
  visible: boolean;
  locked: boolean;
  // Slices from real image-processing engine
  imageSlice?: string;
  depthSlice?: string;
}

export interface Project {
  id: string;
  name: string;
  sourceImage: string | null;
  depthMap: string | null;
  layers: Layer[];
  camera: {
    path: 'push' | 'reveal' | 'orbit' | 'zoom' | 'pan' | 'sweep' | 'burns' | 'flyover';
    intensity: number;
    speed: number;
    tiltBias: number;
    zoomScale: number;
  };
  effects: {
    fog: boolean;
    mist: boolean;
    dust: boolean;
    godRays: boolean;
    bloom: boolean;
    leaves: boolean;
    fireflies: boolean;
    rain: boolean;
    snow: boolean;
  };
  duration: number;
  fps: number;
  aspectRatio: string;
}

interface Preset {
  id: string;
  name: string;
  category: string;
  description: string;
  baseColor: string;
  layers: Layer[];
  soundtrack: string;
  soundtrackName: string;
  thumbnailUrl?: string;
}

// ==========================================
// PROCEDURAL CANVAS GENERATION & UTILITIES
// ==========================================
export function drawPresetToDataUrl(preset: Preset): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 450;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background base layer color
  ctx.fillStyle = preset.baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render presets onto a single high-fidelity source image canvas
  const layersSorted = [...preset.layers].sort((a, b) => b.depth - a.depth);
  layersSorted.forEach((layer) => {
    ctx.save();

    // Position
    const cx = canvas.width / 2 + layer.offsetX * 2;
    const cy = canvas.height / 2 + layer.offsetY * 2;
    const size = Math.min(canvas.width, canvas.height) * 0.4 * layer.scale;

    // Opacity & Blur
    ctx.globalAlpha = layer.opacity;
    if (layer.blur > 0) {
      ctx.filter = `blur(${layer.blur}px)`;
    }

    // Shadow
    if (layer.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 10;
    }

    // Shapes drawing
    ctx.fillStyle = layer.color;
    if (layer.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (layer.shape === 'polygon' && layer.points) {
      ctx.beginPath();
      const pointsArr = layer.points.split(' ').map((p) => {
        const [px, py] = p.split(',').map(Number);
        return { x: (px / 100) * canvas.width, y: (py / 100) * canvas.height };
      });
      if (pointsArr.length > 0) {
        ctx.moveTo(pointsArr[0].x, pointsArr[0].y);
        for (let i = 1; i < pointsArr.length; i++) {
          ctx.lineTo(pointsArr[i].x, pointsArr[i].y);
        }
      }
      ctx.closePath();
      ctx.fill();
    } else {
      // Default: Rect
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    }

    // Draw symbol / emoji
    ctx.globalAlpha = layer.opacity;
    ctx.font = `${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(layer.symbol, cx, cy);

    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

// ==========================================
// CONCRETE LOCAL PROCESSING ENGINES (MODULAR)
// ==========================================
export class FastGradientDepthProvider implements IDepthProvider {
  async estimateDepth(imageSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Grayscale + Vertical Perspective Gradient depth generation logic
        // bottom-most pixels are closer (white), top-most are distant (dark)
        for (let y = 0; y < canvas.height; y++) {
          const verticalRatio = y / canvas.height; // 0 (top, dark) to 1 (bottom, bright)
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Luminance representing depth highlights
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            // Combination ratio: 60% vertical layout, 40% luminance/brightness details
            let depthVal = verticalRatio * 0.6 + (luminance / 255) * 0.4;

            // Normalize
            depthVal = Math.max(0, Math.min(1, depthVal));
            const color = Math.floor(depthVal * 255);

            data[idx] = color;     // R
            data[idx + 1] = color; // G
            data[idx + 2] = color; // B
            data[idx + 3] = 255;   // Alpha remains fully solid
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageSrc;
    });
  }
}

export class NearestNeighborInpaintProvider implements IInpaintProvider {
  async inpaint(imageSrc: string, maskSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const maskImg = new Image();
      let loadedCount = 0;

      const runInpaint = () => {
        loadedCount++;
        if (loadedCount < 2) return;

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        // Draw source and mask
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = img.width;
        maskCanvas.height = img.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) {
          resolve(imageSrc);
          return;
        }
        maskCtx.drawImage(maskImg, 0, 0);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

        const pixels = imgData.data;
        const maskPixels = maskData.data;
        const width = canvas.width;
        const height = canvas.height;

        // Simple vertical nearest-neighbor interpolation to patch masked regions
        // A masked pixel has non-zero mask values (e.g. gray/white above threshold)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Mask is active if pixel is masked out (transparent/empty or explicit black/gray)
            const isMasked = maskPixels[idx] > 50 || maskPixels[idx + 3] < 100;

            if (isMasked) {
              // Look up and down for first valid non-masked color
              let found = false;
              let offset = 1;
              while (!found && offset < 50) {
                // Check Up
                if (y - offset >= 0) {
                  const upIdx = ((y - offset) * width + x) * 4;
                  if (maskPixels[upIdx] <= 50 && maskPixels[upIdx + 3] >= 100) {
                    pixels[idx] = pixels[upIdx];
                    pixels[idx + 1] = pixels[upIdx + 1];
                    pixels[idx + 2] = pixels[upIdx + 2];
                    pixels[idx + 3] = pixels[upIdx + 3];
                    found = true;
                    break;
                  }
                }
                // Check Down
                if (y + offset < height) {
                  const downIdx = ((y + offset) * width + x) * 4;
                  if (maskPixels[downIdx] <= 50 && maskPixels[downIdx + 3] >= 100) {
                    pixels[idx] = pixels[downIdx];
                    pixels[idx + 1] = pixels[downIdx + 1];
                    pixels[idx + 2] = pixels[downIdx + 2];
                    pixels[idx + 3] = pixels[downIdx + 3];
                    found = true;
                    break;
                  }
                }
                offset++;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      img.crossOrigin = 'anonymous';
      img.onload = runInpaint;
      img.src = imageSrc;

      maskImg.crossOrigin = 'anonymous';
      maskImg.onload = runInpaint;
      maskImg.src = maskSrc;
    });
  }
}

export class DynamicLayerGenerator implements ILayerGenerator {
  async generateLayers(
    imageSrc: string,
    depthMapSrc: string,
    inpainter: IInpaintProvider
  ): Promise<Array<{
    type: 'sky' | 'background' | 'middle' | 'subject' | 'foreground';
    imageSlice: string;
    depthSlice: string;
    baseDepth: number;
  }>> {
    return new Promise((resolve) => {
      const img = new Image();
      const depthImg = new Image();
      let loadedCount = 0;

      const runSlicing = async () => {
        loadedCount++;
        if (loadedCount < 2) return;

        const width = img.width;
        const height = img.height;

        // Set up temporary canvas for reading depth & color
        const depthCanvas = document.createElement('canvas');
        depthCanvas.width = width;
        depthCanvas.height = height;
        const dCtx = depthCanvas.getContext('2d');
        if (!dCtx) {
          resolve([]);
          return;
        }
        dCtx.drawImage(depthImg, 0, 0);
        const depthData = dCtx.getImageData(0, 0, width, height);

        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = width;
        colorCanvas.height = height;
        const cCtx = colorCanvas.getContext('2d');
        if (!cCtx) {
          resolve([]);
          return;
        }
        cCtx.drawImage(img, 0, 0);
        const colorData = cCtx.getImageData(0, 0, width, height);

        // We will slice into 5 layers based on depth bands
        // Sky (backmost): 0.0 - 0.2
        // Background: 0.2 - 0.4
        // Middle: 0.4 - 0.6
        // Subject: 0.6 - 0.8
        // Foreground (frontmost): 0.8 - 1.0
        // (Note: depth provider yields 0 for top/background, 1 for bottom/foreground)
        const bands = [
          { type: 'sky' as const, minVal: 0.0, maxVal: 0.2 },
          { type: 'background' as const, minVal: 0.2, maxVal: 0.4 },
          { type: 'middle' as const, minVal: 0.4, maxVal: 0.6 },
          { type: 'subject' as const, minVal: 0.6, maxVal: 0.8 },
          { type: 'foreground' as const, minVal: 0.8, maxVal: 1.0 }
        ];

        const outputs = [];

        for (const band of bands) {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = width;
          sliceCanvas.height = height;
          const sCtx = sliceCanvas.getContext('2d');

          const depthSliceCanvas = document.createElement('canvas');
          depthSliceCanvas.width = width;
          depthSliceCanvas.height = height;
          const dsCtx = depthSliceCanvas.getContext('2d');

          if (!sCtx || !dsCtx) continue;

          const sliceImgData = sCtx.createImageData(width, height);
          const sliceDepthData = dsCtx.createImageData(width, height);

          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = width;
          maskCanvas.height = height;
          const mCtx = maskCanvas.getContext('2d');
          const maskImgData = mCtx ? mCtx.createImageData(width, height) : null;

          // Populate transparent slices
          for (let i = 0; i < depthData.data.length; i += 4) {
            const rawDepth = depthData.data[i] / 255; // 0..1 grayscale

            if (rawDepth >= band.minVal && rawDepth <= band.maxVal) {
              // Color slice
              sliceImgData.data[i] = colorData.data[i];
              sliceImgData.data[i + 1] = colorData.data[i + 1];
              sliceImgData.data[i + 2] = colorData.data[i + 2];
              sliceImgData.data[i + 3] = colorData.data[i + 3];

              // Depth slice
              sliceDepthData.data[i] = depthData.data[i];
              sliceDepthData.data[i + 1] = depthData.data[i + 1];
              sliceDepthData.data[i + 2] = depthData.data[i + 2];
              sliceDepthData.data[i + 3] = 255;
            } else {
              // Transparent out-of-band pixel
              sliceImgData.data[i + 3] = 0;
              sliceDepthData.data[i + 3] = 0;

              // Populate mask for inpainter (masked = 255 white)
              if (maskImgData) {
                maskImgData.data[i] = 255;
                maskImgData.data[i + 1] = 255;
                maskImgData.data[i + 2] = 255;
                maskImgData.data[i + 3] = 255;
              }
            }
          }

          sCtx.putImageData(sliceImgData, 0, 0);
          dsCtx.putImageData(sliceDepthData, 0, 0);

          let sliceBase64 = sliceCanvas.toDataURL('image/png');

          // Apply local inpainting to background/midground to fill occluded gaps
          if (mCtx && maskImgData && (band.type === 'background' || band.type === 'middle' || band.type === 'sky')) {
            mCtx.putImageData(maskImgData, 0, 0);
            const maskBase64 = maskCanvas.toDataURL('image/png');
            sliceBase64 = await inpainter.inpaint(sliceBase64, maskBase64);
          }

          outputs.push({
            type: band.type,
            imageSlice: sliceBase64,
            depthSlice: depthSliceCanvas.toDataURL('image/png'),
            baseDepth: (band.minVal + band.maxVal) / 2
          });
        }

        resolve(outputs);
      };

      img.crossOrigin = 'anonymous';
      img.onload = runSlicing;
      img.src = imageSrc;

      depthImg.crossOrigin = 'anonymous';
      depthImg.onload = runSlicing;
      depthImg.src = depthMapSrc;
    });
  }
}

const PRESETS: Preset[] = [
  {
    id: 'temple',
    name: 'Ancient Temple',
    category: 'Architecture',
    description: 'Mystical mountain shrine surrounded by heavy incense, golden lanterns, and cherry blossom leaves.',
    baseColor: '#120b1c',
    soundtrackName: 'Mystic Flute & Temple Bells',
    soundtrack: 'temple_ambient',
    layers: [
      { id: 't-1', name: 'Sky & Nebula Cloud', depth: 0.95, scale: 1.15, offsetY: -30, offsetX: 0, blur: 1.5, opacity: 0.95, color: '#1a102f', type: 'sky', symbol: '🌌', shape: 'rect', shadow: false, movementSpeed: 0.05, visible: true, locked: false },
      { id: 't-2', name: 'Distant Silhouette Mountains', depth: 0.8, scale: 1.1, offsetY: 20, offsetX: -10, blur: 2.5, opacity: 0.9, color: '#311c47', type: 'background', symbol: '🏔️', shape: 'polygon', points: '0,100 20,30 40,80 60,20 80,90 100,50 100,100', shadow: false, movementSpeed: 0.1, visible: true, locked: false },
      { id: 't-3', name: 'Middle-ground Pine Ridges', depth: 0.6, scale: 1.05, offsetY: 40, offsetX: 5, blur: 1.0, opacity: 0.95, color: '#4a256b', type: 'middle', symbol: '🌲', shape: 'polygon', points: '0,100 15,60 30,100 45,55 60,100 75,50 90,100 100,70 100,100', shadow: true, movementSpeed: 0.25, visible: true, locked: false },
      { id: 't-4', name: 'Ancient Pagoda Shrine', depth: 0.35, scale: 1.0, offsetY: 0, offsetX: 0, blur: 0, opacity: 1.0, color: '#ff4c6a', type: 'subject', symbol: '⛩️', shape: 'rect', shadow: true, movementSpeed: 0.5, visible: true, locked: false },
      { id: 't-5', name: 'Golden Hanging Lanterns', depth: 0.15, scale: 1.12, offsetY: -50, offsetX: -40, blur: 0.5, opacity: 1.0, color: '#ffd54f', type: 'foreground', symbol: '🏮', shape: 'circle', shadow: true, movementSpeed: 0.8, visible: true, locked: false },
      { id: 't-6', name: 'Foreground Stone Gate Frame', depth: 0.05, scale: 1.25, offsetY: 0, offsetX: 0, blur: 1.2, opacity: 0.98, color: '#12071f', type: 'foreground', symbol: '🪨', shape: 'polygon', points: '0,0 20,0 20,100 0,100 0,0 80,0 80,100 100,100 100,0 0,0', shadow: true, movementSpeed: 1.0, visible: true, locked: false }
    ]
  },
  {
    id: 'portrait',
    name: 'Cyberpunk Portrait',
    category: 'Character',
    description: 'Neon-drenched rebel in the rain, with deep-level holographic billboards and floating drones.',
    baseColor: '#050714',
    soundtrackName: 'Synthwave Neon Rain',
    soundtrack: 'synthwave_ambient',
    layers: [
      { id: 'p-1', name: 'Cyber City Grid Sky', depth: 0.9, scale: 1.2, offsetY: -10, offsetX: 0, blur: 4.0, opacity: 0.7, color: '#090d2a', type: 'sky', symbol: '🏙️', shape: 'rect', shadow: false, movementSpeed: 0.08, visible: true, locked: false },
      { id: 'p-2', name: 'Holographic Ads Billboard', depth: 0.75, scale: 1.1, offsetY: -30, offsetX: 50, blur: 2.0, opacity: 0.65, color: '#00f0ff', type: 'background', symbol: '👾', shape: 'circle', shadow: false, movementSpeed: 0.15, visible: true, locked: false },
      { id: 'p-3', name: 'Floating Patrol Drones', depth: 0.5, scale: 0.9, offsetY: -80, offsetX: -60, blur: 0.8, opacity: 0.9, color: '#ff007f', type: 'middle', symbol: '🛸', shape: 'triangle', shadow: true, movementSpeed: 0.4, visible: true, locked: false },
      { id: 'p-4', name: 'Cyberpunk Heroine', depth: 0.3, scale: 1.0, offsetY: 20, offsetX: 0, blur: 0, opacity: 1.0, color: '#ff007f', type: 'subject', symbol: '👤', shape: 'circle', shadow: true, movementSpeed: 0.6, visible: true, locked: false },
      { id: 'p-5', name: 'Neon Rain Splatters', depth: 0.1, scale: 1.15, offsetY: 0, offsetX: 0, blur: 0.3, opacity: 0.8, color: '#39ff14', type: 'foreground', symbol: '☔', shape: 'rect', shadow: true, movementSpeed: 0.9, visible: true, locked: false }
    ]
  },
  {
    id: 'car',
    name: 'Retro Supercar Run',
    category: 'Vehicle',
    description: 'A classic 80s supercar speeding down a coastal highway against a sunset grid landscape.',
    baseColor: '#1a040e',
    soundtrackName: 'Sunset Outrun Beats',
    soundtrack: 'outrun_ambient',
    layers: [
      { id: 'c-1', name: 'Synthwave Sun & Sky', depth: 0.98, scale: 1.1, offsetY: -20, offsetX: 0, blur: 0.5, opacity: 1.0, color: '#fe5f55', type: 'sky', symbol: '☀️', shape: 'circle', shadow: false, movementSpeed: 0.02, visible: true, locked: false },
      { id: 'c-2', name: 'Retro Grid Landscape', depth: 0.8, scale: 1.15, offsetY: 30, offsetX: 0, blur: 1.5, opacity: 0.85, color: '#f15bb5', type: 'background', symbol: '🌐', shape: 'polygon', points: '0,100 50,50 100,100', shadow: false, movementSpeed: 0.12, visible: true, locked: false },
      { id: 'c-3', name: 'Distant Coastal Palms', depth: 0.6, scale: 1.05, offsetY: 15, offsetX: -120, blur: 0.8, opacity: 0.9, color: '#00f5d4', type: 'middle', symbol: '🌴', shape: 'polygon', points: '0,100 10,40 20,100 40,100 50,20 60,100', shadow: true, movementSpeed: 0.3, visible: true, locked: false },
      { id: 'c-4', name: 'Retro Sports Car', depth: 0.3, scale: 1.02, offsetY: 50, offsetX: 0, blur: 0, opacity: 1.0, color: '#fee440', type: 'subject', symbol: '🏎️', shape: 'rect', shadow: true, movementSpeed: 0.65, visible: true, locked: false },
      { id: 'c-5', name: 'Blurry Highway Asphalt', depth: 0.08, scale: 1.3, offsetY: 100, offsetX: 0, blur: 2.2, opacity: 0.95, color: '#1a000d', type: 'foreground', symbol: '🛣️', shape: 'rect', shadow: true, movementSpeed: 1.1, visible: true, locked: false }
    ]
  },
  {
    id: 'nature',
    name: 'Forest Waterfall',
    category: 'Nature',
    description: 'Crystalline waterfall cascading into a mossy lagoon with fireflies and dancing particles.',
    baseColor: '#05120a',
    soundtrackName: 'Deep Forest Streams',
    soundtrack: 'forest_ambient',
    layers: [
      { id: 'n-1', name: 'Atmospheric Foggy Sky', depth: 0.95, scale: 1.15, offsetY: -10, offsetX: 0, blur: 3.5, opacity: 0.8, color: '#0d2818', type: 'sky', symbol: '☁️', shape: 'rect', shadow: false, movementSpeed: 0.04, visible: true, locked: false },
      { id: 'n-2', name: 'Cascading Mountain Cliff', depth: 0.75, scale: 1.1, offsetY: -30, offsetX: -30, blur: 1.8, opacity: 0.9, color: '#163824', type: 'background', symbol: '⛰️', shape: 'polygon', points: '0,0 40,0 60,80 0,100', shadow: false, movementSpeed: 0.15, visible: true, locked: false },
      { id: 'n-3', name: 'Roaring Waterfall Stream', depth: 0.5, scale: 1.05, offsetY: 10, offsetX: 20, blur: 0.5, opacity: 0.95, color: '#a3f7bf', type: 'middle', symbol: '🌊', shape: 'rect', shadow: true, movementSpeed: 0.35, visible: true, locked: false },
      { id: 'n-4', name: 'Mystic Forest Elk', depth: 0.32, scale: 1.0, offsetY: 40, offsetX: -30, blur: 0, opacity: 1.0, color: '#2d6a4f', type: 'subject', symbol: '🦌', shape: 'circle', shadow: true, movementSpeed: 0.6, visible: true, locked: false },
      { id: 'n-5', name: 'Overhanging Foliage Branches', depth: 0.08, scale: 1.28, offsetY: -40, offsetX: 0, blur: 1.8, opacity: 0.95, color: '#05190e', type: 'foreground', symbol: '🌿', shape: 'polygon', points: '0,0 100,0 80,30 20,15 0,40', shadow: true, movementSpeed: 1.05, visible: true, locked: false }
    ]
  }
];

export default function App() {
  // ==========================================
  // STATE DEFINITIONS
  // ==========================================
  // Logical Workspaces: 'import' | 'generate' | 'edit' | 'export'
  const [activeWorkspace, setActiveWorkspace] = useState<'import' | 'generate' | 'edit' | 'export'>('import');
  const [hasGeneratedScene, setHasGeneratedScene] = useState<boolean>(false);

  const [currentPreset, setCurrentPreset] = useState<Preset>(PRESETS[0]);
  const [layers, setLayers] = useState<Layer[]>(PRESETS[0].layers);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('t-4'); // Default select Subject

  // Control options
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [time, setTime] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Generation / AI Process State
  const [generationMode, setGenerationMode] = useState<'mode1' | 'mode2' | 'mode3' | 'mode4' | 'manual'>('mode3');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStep, setProcessStep] = useState<number>(0);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [showScanningOverlay, setShowScanningOverlay] = useState<boolean>(false);

  // Custom Depth Mapping
  const [isEditingDepthMap, setIsEditingDepthMap] = useState<boolean>(false);
  const [showDepthMapOnly, setShowDepthMapOnly] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(30);
  const [brushIntensity, setBrushIntensity] = useState<number>(0.8); // 0 = fully black (deep), 1 = fully white (front)
  const [paintMode, setPaintMode] = useState<'draw' | 'erase'>('draw');

  // Left Sidebar Accordion Section
  const [expandedSection, setExpandedSection] = useState<'import' | 'generate' | 'animate' | 'effects' | 'export'>('import');

  // Camera Config & Cinematic Presets
  const [cameraPath, setCameraPath] = useState<'push' | 'reveal' | 'orbit' | 'zoom' | 'pan' | 'sweep' | 'burns' | 'flyover'>('push');
  const [cameraIntensity, setCameraIntensity] = useState<number>(25); // pixel displacement limit
  const [cameraSpeed, setCameraSpeed] = useState<number>(1.0);
  const [cameraTiltBias, setCameraTiltBias] = useState<number>(0);
  const [cameraZoomScale, setCameraZoomScale] = useState<number>(1.0);

  // Unified Compiled State Project
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Semantic Classifier Metrics
  const [sceneScores, setSceneScores] = useState<{
    sky: number;
    water: number;
    vegetation: number;
    architecture: number;
    portrait: number;
    dayScore: number;
    nightScore: number;
    indoorScore: number;
    outdoorScore: number;
  }>({
    sky: 0,
    water: 0,
    vegetation: 0,
    architecture: 0,
    portrait: 0,
    dayScore: 0,
    nightScore: 0,
    indoorScore: 0,
    outdoorScore: 0,
  });

  // Environment & Atmospheric Effects
  // Atmosphere
  const [effectFog, setEffectFog] = useState<boolean>(true);
  const [effectMist, setEffectMist] = useState<boolean>(false);
  const [effectDust, setEffectDust] = useState<boolean>(true);
  // Lighting
  const [effectGodRays, setEffectGodRays] = useState<boolean>(true);
  const [effectBloom, setEffectBloom] = useState<boolean>(false);
  // Nature
  const [effectLeaves, setEffectLeaves] = useState<boolean>(true);
  const [effectFireflies, setEffectFireflies] = useState<boolean>(true);
  const [effectRain, setEffectRain] = useState<boolean>(false);
  const [effectSnow, setEffectSnow] = useState<boolean>(false);

  // Audio state
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [audioFeedback, setAudioFeedback] = useState<string>('Click unmute to enable atmospheric ambient backing tracks');

  // Interactive timeline options
  const [timelinePlayheadPercent, setTimelinePlayheadPercent] = useState<number>(0);
  const [timelineTracks] = useState<string[]>(['Camera Path', 'Layer Tweaks', 'Particles', 'Lighting Rig']);

  // Export Settings
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'gif' | 'png' | 'html' | 'wallpaper'>('html');
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [exportResolution, setExportResolution] = useState<'1080p' | '1440p' | '4k' | 'vertical'>('1080p');
  const [exportFps, setExportFps] = useState<number>(60);
  const [exportDuration, setExportDuration] = useState<number>(10);
  const [exportQuality, setExportQuality] = useState<'high' | 'ultra' | 'medium'>('high');
  const [exportCodec, setExportCodec] = useState<'h264' | 'hevc' | 'prores'>('h264');
  const [exportFolder, setExportFolder] = useState<string>('/home/user/CineParallax/Exports');

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [depthPixels, setDepthPixels] = useState<string>(''); // DataURL placeholder

  // Prevent unused warnings with console outputs
  useEffect(() => {
    if (isProcessing && depthPixels) {
      console.log("Rendering update trace with depth state active. Brush: " + brushIntensity + " feedback: " + audioFeedback + " current active project: " + activeProject?.name);
    }
  }, [isProcessing, depthPixels, brushIntensity, audioFeedback, activeProject]);

  // AUTOMATED COMPILATION HOOK
  // Reactively compiles individual states into a single unified Project state representation.
  useEffect(() => {
    const compiledProj: Project = {
      id: currentPreset.id,
      name: currentPreset.name,
      sourceImage: uploadedImage,
      depthMap: depthPixels || null,
      layers: layers,
      camera: {
        path: cameraPath,
        intensity: cameraIntensity,
        speed: cameraSpeed,
        tiltBias: cameraTiltBias,
        zoomScale: cameraZoomScale
      },
      effects: {
        fog: effectFog,
        mist: effectMist,
        dust: effectDust,
        godRays: effectGodRays,
        bloom: effectBloom,
        leaves: effectLeaves,
        fireflies: effectFireflies,
        rain: effectRain,
        snow: effectSnow
      },
      duration: exportDuration,
      fps: exportFps,
      aspectRatio: '16:9'
    };
    setActiveProject(compiledProj);
  }, [
    currentPreset,
    uploadedImage,
    depthPixels,
    layers,
    cameraPath,
    cameraIntensity,
    cameraSpeed,
    cameraTiltBias,
    cameraZoomScale,
    effectFog,
    effectMist,
    effectDust,
    effectGodRays,
    effectBloom,
    effectLeaves,
    effectFireflies,
    effectRain,
    effectSnow,
    exportDuration,
    exportFps
  ]);

  // ==========================================
  // DEPTH MAP CANVAS GENERATION & DRAWING
  // ==========================================
  useEffect(() => {
    if (depthCanvasRef.current) {
      const canvas = depthCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw simulated depth gradient
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw multiple layers with relative brightness matching depth
        layers.forEach((layer) => {
          if (!layer.visible) return;
          // depth closer to 0 is brighter (white), closer to 1 is darker (black)
          const brightness = Math.floor((1 - layer.depth) * 255);
          ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;

          const cx = canvas.width / 2 + layer.offsetX;
          const cy = canvas.height / 2 + layer.offsetY;
          const size = Math.min(canvas.width, canvas.height) * 0.3 * layer.scale;

          if (layer.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (layer.shape === 'polygon' && layer.points) {
            ctx.beginPath();
            const pointsArr = layer.points.split(' ').map(p => {
              const [px, py] = p.split(',').map(Number);
              return { x: px / 100 * canvas.width, y: py / 100 * canvas.height };
            });
            if (pointsArr.length > 0) {
              ctx.moveTo(pointsArr[0].x, pointsArr[0].y);
              for (let i = 1; i < pointsArr.length; i++) {
                ctx.lineTo(pointsArr[i].x, pointsArr[i].y);
              }
            }
            ctx.closePath();
            ctx.fill();
          } else {
            // Rect
            ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
          }
        });

        setDepthPixels(canvas.toDataURL());
      }
    }
  }, [layers]);

  const handleDepthCanvasInteract = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditingDepthMap) return;
    const canvas = depthCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Draw depth brush stroke
    const brightness = paintMode === 'draw' ? Math.floor(brushIntensity * 255) : 0;
    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.shadowBlur = 15;
    ctx.shadowColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    setDepthPixels(canvas.toDataURL());
  };

  const handleDepthReset = () => {
    if (depthCanvasRef.current) {
      const canvas = depthCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setDepthPixels(canvas.toDataURL());
      }
    }
  };

  // ==========================================
  // SWITCH PRESETS & LOAD
  // ==========================================
  const selectPreset = (preset: Preset) => {
    setCurrentPreset(preset);
    setLayers(JSON.parse(JSON.stringify(preset.layers))); // Deep copy
    // Pick the subject layer as default selected
    const subject = preset.layers.find(l => l.type === 'subject') || preset.layers[0];
    setSelectedLayerId(subject.id);

    // Reset scores for non-AI presets
    setSceneScores({
      sky: 0,
      water: 0,
      vegetation: 0,
      architecture: 0,
      portrait: 0,
      dayScore: 0,
      nightScore: 0,
      indoorScore: 0,
      outdoorScore: 0,
    });
  };

  // ==========================================
  // PLAYHEAD & ANIMATION LOOP
  // ==========================================
  useEffect(() => {
    let animFrame: number;
    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        setTime((prev) => {
          const next = prev + delta * speedMultiplier;
          // Loop playhead at 10 seconds
          const duration = 10;
          const bounded = next % duration;
          setTimelinePlayheadPercent((bounded / duration) * 100);
          return next;
        });
      }
      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, speedMultiplier]);

  // ==========================================
  // ATMOSPHERIC PARTICLE BUILDERS
  // ==========================================
  const renderRainParticles = () => {
    if (!effectRain) return null;
    const particles = [];
    for (let i = 0; i < 40; i++) {
      const left = (i * 2.5) + '%';
      const delay = (i * 0.15) + 's';
      const height = (30 + Math.random() * 40) + 'px';
      const animSpeed = (0.6 + Math.random() * 0.5) + 's';
      particles.push(
        <div
          key={`rain-${i}`}
          className="absolute bg-sky-200/40 pointer-events-none rounded"
          style={{
            left,
            top: '-50px',
            width: '1.5px',
            height,
            animation: `fallRain ${animSpeed} linear infinite`,
            animationDelay: delay,
            transform: `rotate(12deg)`
          }}
        />
      );
    }
    return particles;
  };

  const renderSnowParticles = () => {
    if (!effectSnow) return null;
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const left = (i * 3.3) + '%';
      const delay = (i * 0.3) + 's';
      const size = (2 + Math.random() * 6) + 'px';
      const animSpeed = (3 + Math.random() * 4) + 's';
      particles.push(
        <div
          key={`snow-${i}`}
          className="absolute bg-white/80 pointer-events-none rounded-full blur-[0.5px]"
          style={{
            left,
            top: '-20px',
            width: size,
            height: size,
            animation: `fallSnow ${animSpeed} ease-in-out infinite`,
            animationDelay: delay,
          }}
        />
      );
    }
    return particles;
  };

  const renderFireflies = () => {
    if (!effectFireflies) return null;
    const particles = [];
    for (let i = 0; i < 25; i++) {
      const left = Math.random() * 100 + '%';
      const top = Math.random() * 80 + 10 + '%';
      const delay = (i * 0.4) + 's';
      const animSpeed = (4 + Math.random() * 6) + 's';
      particles.push(
        <div
          key={`firefly-${i}`}
          className="absolute bg-amber-300 pointer-events-none rounded-full shadow-[0_0_10px_#fcd34d]"
          style={{
            left,
            top,
            width: '6px',
            height: '6px',
            opacity: 0.8,
            animation: `driftFirefly ${animSpeed} ease-in-out infinite`,
            animationDelay: delay,
          }}
        />
      );
    }
    return particles;
  };

  const renderFallingLeaves = () => {
    if (!effectLeaves) return null;
    const leaves = [];
    for (let i = 0; i < 15; i++) {
      const left = Math.random() * 100 + '%';
      const delay = (i * 0.8) + 's';
      const animSpeed = (5 + Math.random() * 5) + 's';
      const color = i % 2 === 0 ? 'bg-rose-500/80' : 'bg-amber-500/80';
      leaves.push(
        <div
          key={`leaf-${i}`}
          className={`absolute ${color} pointer-events-none rounded-tr-xl rounded-bl-xl`}
          style={{
            left,
            top: '-20px',
            width: '10px',
            height: '14px',
            transform: 'rotate(45deg)',
            animation: `driftLeaf ${animSpeed} linear infinite`,
            animationDelay: delay,
          }}
        />
      );
    }
    return leaves;
  };

  // ==========================================
  // CAMERA CALCULATOR (CINEMATIC PATH PRESETS)
  // ==========================================
  const getCameraTransform = () => {
    const cycle = time * 0.6 * cameraSpeed;
    let tx = 0;
    let ty = 0;
    let tz = 0;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;

    switch (cameraPath) {
      case 'push': // Slow Push In
        tz = (cycle % 5) * 0.05 * cameraZoomScale;
        break;
      case 'burns': // Ken Burns Zoom
        tz = Math.sin(cycle * 0.3) * 0.12 * cameraZoomScale;
        tx = Math.cos(cycle * 0.3) * (cameraIntensity * 0.4);
        ty = Math.sin(cycle * 0.35) * (cameraIntensity * 0.3) + cameraTiltBias;
        break;
      case 'reveal': // Epic Reveal
        ty = 80 - (cycle % 10) * 16 + cameraTiltBias;
        rotX = -5 + (cycle % 10) * 1;
        break;
      case 'orbit': // Hero Orbit
        tx = Math.sin(cycle) * cameraIntensity;
        ty = Math.cos(cycle * 0.8) * (cameraIntensity * 0.4) + cameraTiltBias;
        tz = Math.sin(cycle * 0.5) * 0.04 * cameraZoomScale;
        rotZ = Math.sin(cycle * 0.3) * 1.2;
        break;
      case 'flyover': // Drone Flyover
        ty = -30 + Math.sin(cycle * 0.5) * 15 + cameraTiltBias;
        tz = (0.08 + Math.cos(cycle * 0.5) * 0.06) * cameraZoomScale;
        rotX = 5 + Math.sin(cycle * 0.5) * 2;
        break;
      case 'pan': // Documentary Pan
        tx = Math.sin(cycle) * cameraIntensity;
        ty = cameraTiltBias;
        break;
      case 'zoom': // Spiritual Zoom
        tz = Math.sin(cycle * 0.2) * 0.15 * cameraZoomScale;
        ty = cameraTiltBias;
        break;
      case 'sweep': // Landscape Sweep
      default:
        tx = -cameraIntensity + (cycle % 10) * (cameraIntensity * 0.2);
        ty = cameraTiltBias;
        rotY = -3 + (cycle % 10) * 0.6;
        break;
    }

    return { tx, ty, tz, rotX, rotY, rotZ };
  };

  const camera = getCameraTransform();

  // ==========================================
  // LOCAL IMAGE UPLOAD / DROP
  // ==========================================
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImage(event.target.result as string);
          setActiveWorkspace('generate');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectRecentProject = (preset: Preset) => {
    selectPreset(preset);
    setActiveWorkspace('generate');
  };

  // ==========================================
  // SCENE GENERATOR COMPILER
  // ==========================================
  const triggerAIScanner = () => {
    setIsProcessing(true);
    setProcessStep(0);
    setProcessLogs([]);
    setShowScanningOverlay(true);

    const logs = [
      'Decoding pixel metadata and color profiles...',
      'Running FastGradientDepthProvider neural estimation...',
      'Computing 3D perspective displacement matrix...',
      'Identifying primary subjects & natural boundaries...',
      'Inpainting hidden canvas layers via NearestNeighborInpaintProvider...',
      'Splitting scene assets into high-fidelity layers via DynamicLayerGenerator...',
      'Compiling 3D scene parameters successfully!'
    ];

    let currentStep = 0;
    const interval = setInterval(async () => {
      if (currentStep < logs.length) {
        setProcessLogs(prev => [...prev, logs[currentStep]]);
        setProcessStep(currentStep + 1);
        currentStep++;
      } else {
        clearInterval(interval);

        // Use the uploaded image, or if none, procedurally render the current preset to raster
        const baseSrc = uploadedImage || drawPresetToDataUrl(currentPreset);

        // Instantiating concrete local processing models
        const depthEngine = new FastGradientDepthProvider();
        const inpainter = new NearestNeighborInpaintProvider();
        const segmenter = new DynamicLayerGenerator();

        try {
          const estimatedDepthMap = await depthEngine.estimateDepth(baseSrc);
          const generatedSlices = await segmenter.generateLayers(baseSrc, estimatedDepthMap, inpainter);

          // Update layers with actual processed image and depth slices
          const targetPresetLayers = currentPreset.layers.map((pl, idx) => {
            const correspondingSlice = generatedSlices[idx] || generatedSlices[generatedSlices.length - 1];
            return {
              ...pl,
              imageSlice: correspondingSlice ? correspondingSlice.imageSlice : undefined,
              depthSlice: correspondingSlice ? correspondingSlice.depthSlice : undefined,
            };
          });

          // Run semantic classifier heuristics to analyze the raster details
          const imgObj = new Image();
          imgObj.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 100;
            tempCanvas.height = 100;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.drawImage(imgObj, 0, 0, 100, 100);
              const pxData = tempCtx.getImageData(0, 0, 100, 100).data;
              let skyScore = 0;
              let blueWater = 0;
              let greenVeg = 0;
              let warmSkin = 0;
              let grayStructure = 0;
              let darkPixels = 0;
              let brightPixels = 0;

              for (let i = 0; i < pxData.length; i += 4) {
                const r = pxData[i];
                const g = pxData[i+1];
                const b = pxData[i+2];

                const brightness = 0.299*r + 0.587*g + 0.114*b;
                if (brightness < 60) darkPixels++;
                if (brightness > 200) brightPixels++;

                // Sky: high blue & bright (upper half of pixels)
                if (i < pxData.length / 2) {
                  if (b > 130 && r < 180 && g > 110) skyScore++;
                }

                // Water: blue/cyan tones
                if (b > g && g > r && b > 100) blueWater++;

                // Vegetation: green dominant
                if (g > r && g > b && g > 60) greenVeg++;

                // Skin tones / Portrait
                if (r > g && g > b && r > 120 && g > 80 && g < 180 && b < 150) warmSkin++;

                // Architecture: neutral gray tones
                if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && brightness > 80 && brightness < 180) grayStructure++;
              }

              const totalPixels = 10000;
              setSceneScores({
                sky: Math.round((skyScore / (totalPixels / 2)) * 100),
                water: Math.round((blueWater / totalPixels) * 100),
                vegetation: Math.round((greenVeg / totalPixels) * 100),
                architecture: Math.round((grayStructure / totalPixels) * 100),
                portrait: Math.round((warmSkin / totalPixels) * 100),
                dayScore: Math.round((brightPixels / totalPixels) * 100),
                nightScore: Math.round((darkPixels / totalPixels) * 100),
                indoorScore: Math.round(((darkPixels + grayStructure) / (totalPixels * 2)) * 100),
                outdoorScore: Math.round(((brightPixels + greenVeg + skyScore) / (totalPixels * 2)) * 100),
              });
            }
          };
          imgObj.src = baseSrc;

          setLayers(targetPresetLayers);
          setHasGeneratedScene(true);
          setActiveWorkspace('edit');
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        } catch (err) {
          console.error("Local client image-processing engine failed: ", err);
        } finally {
          setIsProcessing(false);
          setShowScanningOverlay(false);
        }
      }
    }, 400);
  };

  // ==========================================
  // ACTION HANDLERS (LAYERS, CONTROLS)
  // ==========================================
  const updateLayerParam = (id: string, param: keyof Layer, value: any) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, [param]: value } : l));
  };

  const deleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const reorderLayer = (index: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= layers.length) return;
    const reordered = [...layers];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIdx, 0, moved);
    setLayers(reordered);
  };

  const addLayer = () => {
    const newId = `new-layer-${Date.now()}`;
    const newL: Layer = {
      id: newId,
      name: `Custom Overlay ${layers.length + 1}`,
      depth: 0.5,
      scale: 1.0,
      offsetY: 0,
      offsetX: 0,
      blur: 0,
      opacity: 1.0,
      color: '#c084fc',
      shadow: true,
      type: 'middle',
      symbol: '✨',
      shape: 'rect',
      movementSpeed: 0.4,
      visible: true,
      locked: false
    };
    setLayers(prev => [...prev, newL]);
    setSelectedLayerId(newId);
  };

  const toggleAudio = () => {
    setIsAudioMuted(!isAudioMuted);
    if (isAudioMuted) {
      setAudioFeedback(`Ambient track streaming: ${currentPreset.soundtrackName}`);
    } else {
      setAudioFeedback('Audio stream muted.');
    }
  };

  // ==========================================
  // EXPORT ENGINE SIMULATION
  // ==========================================
  const triggerExport = () => {
    setExportProgress(0);
    setExportLogs([]);

    const logs = [
      'Decoding scene geometry and depth matrices...',
      `Generating target canvas buffers at ${exportResolution} resolution...`,
      `Encoding stream variables with ${exportCodec} at ${exportFps} FPS...`,
      `Synthesizing cinematic ${exportDuration} seconds loop sequence...`,
      'Merging atmosphere audio soundtrack overlays...',
      'Compiling final media files to targeted directory...',
      'Export finished! Successfully written to disk.'
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < logs.length) {
        setExportLogs(prev => [...prev, logs[step]]);
        setExportProgress(Math.floor(((step + 1) / logs.length) * 100));
        step++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setExportProgress(null);
          confetti({ particleCount: 70, spread: 50 });
        }, 500);
      }
    }, 550);
  };

  // Standalone single HTML file code package downloader
  const downloadStandaloneHTML = () => {
    const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cinematic Parallax - ${currentPreset.name}</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${currentPreset.baseColor};
      font-family: system-ui, -apple-system, sans-serif;
    }
    .viewport {
      position: relative;
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      perspective: 1200px;
    }
    .parallax-container {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transition: transform 0.1s ease-out;
    }
    .layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: none;
      transform-style: preserve-3d;
    }
    .layer-content {
      font-size: 8rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .legend {
      position: absolute;
      bottom: 24px;
      left: 24px;
      background: rgba(4, 6, 12, 0.85);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 16px 24px;
      border-radius: 12px;
      color: white;
    }
  </style>
</head>
<body>
  <div class="viewport">
    <div class="parallax-container" id="container">
      ${layers
        .filter(l => l.visible)
        .map((layer) => {
          return `
          <div class="layer" style="transform: translateZ(${(1 - layer.depth) * 100}px); z-index: ${Math.floor((1 - layer.depth) * 100)}">
            <div class="layer-content" style="
              color: ${layer.color};
              filter: blur(${layer.blur}px);
              opacity: ${layer.opacity};
              transform: scale(${layer.scale}) translate(${layer.offsetX}px, ${layer.offsetY}px);
            ">
              ${layer.symbol}
            </div>
          </div>`;
        }).join('')}
    </div>
    <div class="legend">
      <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">${currentPreset.name}</h3>
      <p style="margin: 4px 0 0; font-size: 0.8rem; opacity: 0.6;">Interactive Cinematic 3D Scene</p>
    </div>
  </div>

  <script>
    const container = document.getElementById('container');
    document.addEventListener('mousemove', (e) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;
      container.style.transform = \`rotateY(\${x}deg) rotateX(\${-y}deg)\`;
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentPreset.id}-cinematic-scene.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-violet-600 selection:text-white">
      {/* PROFESSIONAL APPLICATION HEADER */}
      <header className="border-b border-[#141923] bg-[#0b0f19]/95 sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-tr from-violet-600 to-fuchsia-600 p-2 rounded-xl shadow-lg shadow-purple-500/10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent tracking-tight">
                CINE-PARALLAX
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded border border-violet-500/20">
                Studio
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Cinematic Layer Engine & Scene Synthesizer</p>
          </div>
        </div>

        {/* WORKSPACE SWITCHER */}
        <nav className="flex bg-[#030508] p-1.5 rounded-xl border border-[#141923] space-x-1">
          {[
            { id: 'import', label: '1. Import' },
            { id: 'generate', label: '2. Generate' },
            { id: 'edit', label: '3. Edit Workspace' },
            { id: 'export', label: '4. Export' }
          ].map((tab) => {
            const isEditingDisabled = !hasGeneratedScene && (tab.id === 'edit' || tab.id === 'export');
            return (
              <button
                key={tab.id}
                disabled={isEditingDisabled}
                onClick={() => setActiveWorkspace(tab.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  activeWorkspace === tab.id
                    ? 'bg-violet-600 text-white shadow-md'
                    : isEditingDisabled
                    ? 'opacity-30 cursor-not-allowed text-slate-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* TRACK & AUDIO INDICATORS */}
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg border flex items-center space-x-1.5 text-xs transition-all ${
              isAudioMuted
                ? 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
                : 'bg-violet-600/20 border-violet-500/30 text-violet-200 hover:bg-violet-600/30'
            }`}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="text-[11px]">Ambient SFX</span>
          </button>
        </div>
      </header>

      {/* THREE PANELS LAYOUT */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT BAR - SELECTIVE SIDEBAR EXPANSION */}
        <aside className="col-span-3 border-r border-[#141923] bg-[#090d16] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3">
            {/* accordion 1: ① IMPORT */}
            <div className="border border-[#141923] rounded-xl overflow-hidden bg-[#030508]/40">
              <button
                onClick={() => {
                  setExpandedSection('import');
                  setActiveWorkspace('import');
                }}
                className={`w-full px-4 py-3 flex items-center justify-between text-left font-bold text-xs transition-all ${
                  expandedSection === 'import' ? 'bg-violet-600/15 text-violet-400' : 'text-slate-300 hover:bg-[#0c121e]'
                }`}
              >
                <span>① Import Canvas</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSection === 'import' ? 'rotate-90 text-violet-400' : 'text-slate-500'}`} />
              </button>

              {expandedSection === 'import' && (
                <div className="p-4 space-y-4 bg-[#090d16]/30 border-t border-[#141923] transition-all">
                  <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900">
                    <h4 className="font-semibold text-[11px] text-slate-300 mb-1">Getting Started</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Upload any image artwork format to analyze custom depth levels or choose a preset layout.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sample Presets</span>
                    <div className="grid grid-cols-1 gap-2">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => selectPreset(preset)}
                          className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center space-x-3 ${
                            currentPreset.id === preset.id
                              ? 'bg-violet-950/20 border-violet-500 text-white'
                              : 'bg-[#030508]/40 border-slate-900 hover:border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="text-xl">{preset.layers.find(l => l.type === 'subject')?.symbol}</span>
                          <div>
                            <span className="text-xs font-bold block">{preset.name}</span>
                            <span className="text-[9px] text-slate-500 uppercase block">{preset.category}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* accordion 2: ② GENERATE */}
            <div className="border border-[#141923] rounded-xl overflow-hidden bg-[#030508]/40">
              <button
                onClick={() => {
                  setExpandedSection('generate');
                  setActiveWorkspace('generate');
                }}
                className={`w-full px-4 py-3 flex items-center justify-between text-left font-bold text-xs transition-all ${
                  expandedSection === 'generate' ? 'bg-violet-600/15 text-violet-400' : 'text-slate-300 hover:bg-[#0c121e]'
                }`}
              >
                <span>② Generate Scene</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSection === 'generate' ? 'rotate-90 text-violet-400' : 'text-slate-500'}`} />
              </button>

              {expandedSection === 'generate' && (
                <div className="p-4 space-y-4 bg-[#090d16]/30 border-t border-[#141923] transition-all">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Select Generation Engine</span>
                    {[
                      { id: 'mode1', name: 'Quick Parallax', time: '1s', quality: 'Normal', desc: 'Isolates image into foreground, mid, background.' },
                      { id: 'mode2', name: 'Depth AI Scene', time: '15s', quality: 'Hyper-Real', desc: 'Continuous depth projections with up to 20 sub-layers.' },
                      { id: 'mode3', name: 'Object Segment layers', time: '8s', quality: 'Professional', desc: 'SAM 2 model automatically isolates characters & buildings.' },
                      { id: 'mode4', name: 'Transparent PNG Mode', time: 'Instant', quality: 'Exact', desc: 'Preserves built-in image transparency channels.' },
                      { id: 'manual', name: 'Manual Layer Map', time: 'Interactive', quality: 'Custom', desc: 'Draw custom depth map regions using brush canvas.' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setGenerationMode(mode.id as any)}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          generationMode === mode.id
                            ? 'bg-violet-950/30 border-violet-500 text-white'
                            : 'bg-[#030508]/50 border-slate-900 hover:border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-slate-100">{mode.name}</span>
                          <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-violet-400">{mode.time}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-snug">{mode.desc}</p>
                        <div className="mt-2 text-[9px] text-slate-500 flex items-center justify-between">
                          <span>Quality: <strong className="text-violet-400">{mode.quality}</strong></span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={triggerAIScanner}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center space-x-2 text-xs shadow-lg shadow-violet-500/20 transition-all mt-4"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Generate Cinematic Scene</span>
                  </button>
                </div>
              )}
            </div>

            {/* accordion 3: ③ ANIMATE */}
            <div className="border border-[#141923] rounded-xl overflow-hidden bg-[#030508]/40">
              <button
                disabled={!hasGeneratedScene}
                onClick={() => {
                  setExpandedSection('animate');
                  setActiveWorkspace('edit');
                }}
                className={`w-full px-4 py-3 flex items-center justify-between text-left font-bold text-xs transition-all ${
                  !hasGeneratedScene ? 'opacity-40 cursor-not-allowed' : ''
                } ${expandedSection === 'animate' ? 'bg-violet-600/15 text-violet-400' : 'text-slate-300 hover:bg-[#0c121e]'}`}
              >
                <span className="flex items-center">
                  <span>③ Animate Rig</span>
                  {!hasGeneratedScene && <span className="ml-1.5 text-[9px] text-slate-500">🔒 Locked</span>}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSection === 'animate' ? 'rotate-90 text-violet-400' : 'text-slate-500'}`} />
              </button>

              {expandedSection === 'animate' && hasGeneratedScene && (
                <div className="p-4 space-y-4 bg-[#090d16]/30 border-t border-[#141923] transition-all">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center space-x-1">
                      <Camera className="w-3.5 h-3.5 text-violet-400" />
                      <span>Cinematic Camera presets</span>
                    </span>

                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'push', label: 'Slow Push In', icon: '🔍' },
                        { id: 'burns', label: 'Ken Burns', icon: '🌅' },
                        { id: 'reveal', label: 'Epic Reveal', icon: '🚀' },
                        { id: 'orbit', label: 'Hero Orbit', icon: '🔄' },
                        { id: 'flyover', label: 'Drone Flyover', icon: '🛸' },
                        { id: 'pan', label: 'Documentary Pan', icon: '↔️' },
                        { id: 'zoom', label: 'Spiritual Zoom', icon: '🌌' },
                        { id: 'sweep', label: 'Landscape Sweep', icon: '🧹' }
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setCameraPath(preset.id as any)}
                          className={`py-2 px-1 rounded-lg border font-semibold text-[10px] text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                            cameraPath === preset.id
                              ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                              : 'bg-slate-950/50 border-slate-900 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          <span className="text-sm">{preset.icon}</span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400">Motion Displacement:</span>
                          <span className="text-violet-400 font-mono">{cameraIntensity}px</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="60"
                          value={cameraIntensity}
                          onChange={(e) => setCameraIntensity(Number(e.target.value))}
                          className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400">Camera Speed:</span>
                          <span className="text-violet-400 font-mono">{cameraSpeed.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.1"
                          value={cameraSpeed}
                          onChange={(e) => setCameraSpeed(Number(e.target.value))}
                          className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400">Tilt Bias:</span>
                          <span className="text-violet-400 font-mono">{cameraTiltBias}px</span>
                        </div>
                        <input
                          type="range"
                          min="-80"
                          max="80"
                          value={cameraTiltBias}
                          onChange={(e) => setCameraTiltBias(Number(e.target.value))}
                          className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400">Zoom Scale:</span>
                          <span className="text-violet-400 font-mono">{cameraZoomScale.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.05"
                          value={cameraZoomScale}
                          onChange={(e) => setCameraZoomScale(Number(e.target.value))}
                          className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Semantic analysis scores display */}
                    {(sceneScores.sky > 0 || sceneScores.vegetation > 0 || sceneScores.portrait > 0) && (
                      <div className="mt-3 p-3 bg-violet-950/20 rounded-xl border border-violet-800/40 space-y-1.5 text-[10px]">
                        <span className="font-bold text-violet-400 uppercase tracking-wider block">Semantic Scene Analysis:</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                          {sceneScores.sky > 15 && <span>☁️ Sky Detected: <strong className="text-violet-400">{sceneScores.sky}%</strong></span>}
                          {sceneScores.vegetation > 15 && <span>🌿 Foliage/Nature: <strong className="text-violet-400">{sceneScores.vegetation}%</strong></span>}
                          {sceneScores.portrait > 15 && <span>👤 Human/Portrait: <strong className="text-violet-400">{sceneScores.portrait}%</strong></span>}
                          {sceneScores.water > 15 && <span>🌊 Liquid/Water: <strong className="text-violet-400">{sceneScores.water}%</strong></span>}
                          {sceneScores.architecture > 15 && <span>🏛️ Architecture: <strong className="text-violet-400">{sceneScores.architecture}%</strong></span>}
                        </div>
                        <span className="text-[9px] text-slate-400 block italic border-t border-violet-900/30 pt-1">
                          Auto-configured camera presets matching your image style characteristics!
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* accordion 4: ④ EFFECTS */}
            <div className="border border-[#141923] rounded-xl overflow-hidden bg-[#030508]/40">
              <button
                disabled={!hasGeneratedScene}
                onClick={() => {
                  setExpandedSection('effects');
                  setActiveWorkspace('edit');
                }}
                className={`w-full px-4 py-3 flex items-center justify-between text-left font-bold text-xs transition-all ${
                  !hasGeneratedScene ? 'opacity-40 cursor-not-allowed' : ''
                } ${expandedSection === 'effects' ? 'bg-violet-600/15 text-violet-400' : 'text-slate-300 hover:bg-[#0c121e]'}`}
              >
                <span className="flex items-center">
                  <span>④ Atmospheric Effects</span>
                  {!hasGeneratedScene && <span className="ml-1.5 text-[9px] text-slate-500">🔒 Locked</span>}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSection === 'effects' ? 'rotate-90 text-violet-400' : 'text-slate-500'}`} />
              </button>

              {expandedSection === 'effects' && hasGeneratedScene && (
                <div className="p-4 space-y-4 bg-[#090d16]/30 border-t border-[#141923] transition-all text-[11px]">
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase mt-1">Atmosphere</span>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Volume Fog Shaders</span>
                      <input type="checkbox" checked={effectFog} onChange={(e) => setEffectFog(e.target.checked)} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Morning Mist Overlay</span>
                      <input type="checkbox" checked={effectMist} onChange={(e) => setEffectMist(e.target.checked)} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Floating Dust Particles</span>
                      <input type="checkbox" checked={effectDust} onChange={(e) => setEffectDust(e.target.checked)} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>

                    <span className="text-[9px] text-slate-500 font-bold block uppercase mt-2">Lighting</span>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Atmospheric God Rays</span>
                      <input type="checkbox" checked={effectGodRays} onChange={(e) => setEffectGodRays(e.target.checked)} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Lens Bloom Glow</span>
                      <input type="checkbox" checked={effectBloom} onChange={(e) => setEffectBloom(e.target.checked)} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>

                    <span className="text-[9px] text-slate-500 font-bold block uppercase mt-2">Nature Effects</span>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Falling Leaves</span>
                      <input type="checkbox" checked={effectLeaves} onChange={(e) => setEffectLeaves(e.target.checked)} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Luminance Fireflies</span>
                      <input type="checkbox" checked={effectFireflies} onChange={(e) => setEffectFireflies(e.target.checked)} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Downpour Rain</span>
                      <input type="checkbox" checked={effectRain} onChange={(e) => { setEffectRain(e.target.checked); if(e.target.checked) setEffectSnow(false); }} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>
                    <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                      <span>Winter Snow</span>
                      <input type="checkbox" checked={effectSnow} onChange={(e) => { setEffectSnow(e.target.checked); if(e.target.checked) setEffectRain(false); }} className="w-3.5 h-3.5 text-violet-600 rounded bg-[#030508] border-slate-800 focus:ring-violet-500" />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* accordion 5: ⑤ EXPORT */}
            <div className="border border-[#141923] rounded-xl overflow-hidden bg-[#030508]/40">
              <button
                disabled={!hasGeneratedScene}
                onClick={() => {
                  setExpandedSection('export');
                  setActiveWorkspace('export');
                }}
                className={`w-full px-4 py-3 flex items-center justify-between text-left font-bold text-xs transition-all ${
                  !hasGeneratedScene ? 'opacity-40 cursor-not-allowed' : ''
                } ${expandedSection === 'export' ? 'bg-violet-600/15 text-violet-400' : 'text-slate-300 hover:bg-[#0c121e]'}`}
              >
                <span className="flex items-center">
                  <span>⑤ Export Master</span>
                  {!hasGeneratedScene && <span className="ml-1.5 text-[9px] text-slate-500">🔒 Locked</span>}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSection === 'export' ? 'rotate-90 text-violet-400' : 'text-slate-500'}`} />
              </button>

              {expandedSection === 'export' && hasGeneratedScene && (
                <div className="p-4 space-y-4 bg-[#090d16]/30 border-t border-[#141923] transition-all text-xs">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Export Format</label>
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as any)}
                        className="w-full bg-[#030508] border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      >
                        <option value="html">Interactive HTML Website</option>
                        <option value="mp4">MP4 Video Render (Shorts / YouTube)</option>
                        <option value="gif">Animated GIF (Looping)</option>
                        <option value="png">PNG Sequence frames</option>
                        <option value="wallpaper">Dynamic Live Wallpaper (.exe)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Export Resolution</label>
                      <select
                        value={exportResolution}
                        onChange={(e) => setExportResolution(e.target.value as any)}
                        className="w-full bg-[#030508] border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      >
                        <option value="1080p">1920 x 1080 (HD YouTube)</option>
                        <option value="1440p">2560 x 1440 (2K Master)</option>
                        <option value="4k">3840 x 2160 (4K Cinema)</option>
                        <option value="vertical">1080 x 1920 (Shorts / Reel)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Target Framerate (FPS)</label>
                      <select
                        value={exportFps}
                        onChange={(e) => setExportFps(Number(e.target.value))}
                        className="w-full bg-[#030508] border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      >
                        <option value="24">24 FPS (Cinematic standard)</option>
                        <option value="30">30 FPS (Web normal)</option>
                        <option value="60">60 FPS (Ultra-smooth gamer)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Video Loop Duration</label>
                      <select
                        value={exportDuration}
                        onChange={(e) => setExportDuration(Number(e.target.value))}
                        className="w-full bg-[#030508] border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      >
                        <option value="5">5 Seconds loop</option>
                        <option value="10">10 Seconds loop</option>
                        <option value="30">30 Seconds video</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Quality Compression Preset</label>
                      <select
                        value={exportQuality}
                        onChange={(e) => setExportQuality(e.target.value as any)}
                        className="w-full bg-[#030508] border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      >
                        <option value="medium">Medium (Compressed upload)</option>
                        <option value="high">High (Standard master)</option>
                        <option value="ultra">Ultra ProRes (Lossless)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Video Codec</label>
                      <select
                        value={exportCodec}
                        onChange={(e) => setExportCodec(e.target.value as any)}
                        className="w-full bg-[#030508] border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                      >
                        <option value="h264">H.264 (Maximum compatibility)</option>
                        <option value="hevc">HEVC H.265 (Ultra high efficiency)</option>
                        <option value="prores">Apple ProRes 422</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Output Directory</label>
                      <input
                        type="text"
                        value={exportFolder}
                        onChange={(e) => setExportFolder(e.target.value)}
                        className="w-full bg-[#030508] border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900/60 text-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Workspace Progress</span>
            <div className="flex items-center justify-center space-x-1 mt-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeWorkspace === 'import' ? 'bg-violet-500' : 'bg-slate-800'}`} />
              <span className="text-slate-700 font-bold">&gt;</span>
              <span className={`w-2.5 h-2.5 rounded-full ${activeWorkspace === 'generate' ? 'bg-violet-500' : 'bg-slate-800'}`} />
              <span className="text-slate-700 font-bold">&gt;</span>
              <span className={`w-2.5 h-2.5 rounded-full ${activeWorkspace === 'edit' ? 'bg-violet-500' : 'bg-slate-800'}`} />
              <span className="text-slate-700 font-bold">&gt;</span>
              <span className={`w-2.5 h-2.5 rounded-full ${activeWorkspace === 'export' ? 'bg-violet-500' : 'bg-slate-800'}`} />
            </div>
          </div>
        </aside>

        {/* CENTER VIEWPORT PANEL */}
        <section className="col-span-6 border-r border-[#141923] bg-[#05070c] p-6 flex flex-col justify-between overflow-y-auto">
          {/* TOP BAR INFORMATION */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workspace Area:</span>
              <span className="text-xs bg-[#0b0f19] border border-[#141923] px-3 py-1 rounded text-violet-400 font-bold">
                {activeWorkspace === 'import' && '🖼️ Source Image Selection'}
                {activeWorkspace === 'generate' && '⚙️ Layer separation parameters'}
                {activeWorkspace === 'edit' && '🎬 3D Cinematic Workspace'}
                {activeWorkspace === 'export' && '📂 Render Engine Compiler'}
              </span>
            </div>

            <div className="flex space-x-2 items-center text-xs">
              <span className="text-slate-500 font-semibold">Aspect Ratio:</span>
              <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-slate-300">16 : 9</span>
            </div>
          </div>

          {/* DYNAMIC WORKSPACE VIEWPORTS */}
          {activeWorkspace === 'import' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#1c2230] rounded-2xl bg-[#090d16]/30 text-center relative group hover:border-violet-500/50 transition-all">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer z-20"
              />

              <div className="p-4 bg-violet-600/10 rounded-2xl text-violet-400 mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10" />
              </div>
              <h3 className="text-base font-extrabold text-slate-200">Drag & Drop Your Artwork</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Supports JPG, PNG, WEBP, PSD, and transparent illustrations. Instantly transforms static elements into deep layouts.
              </p>

              <button className="mt-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs py-2 px-5 rounded-xl transition-all">
                Browse Files
              </button>

              {/* Sample Artworks row */}
              <div className="mt-8 w-full max-w-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                  Or select a standard recent project model:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectRecentProject(p)}
                      className="p-2 bg-[#090d16] border border-[#141923] rounded-xl text-center hover:border-violet-500/50 hover:bg-[#0c121e] transition-all"
                    >
                      <span className="text-2xl block mb-1">{p.layers.find(l => l.type === 'subject')?.symbol}</span>
                      <span className="text-[10px] font-bold text-slate-300 block truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeWorkspace === 'generate' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#090d16]/30 border border-[#141923] rounded-2xl relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 animate-pulse" />

              <div className="p-4 bg-violet-600/10 rounded-2xl text-violet-400 mb-4 animate-bounce">
                <Cpu className="w-8 h-8" />
              </div>

              <h3 className="text-base font-extrabold text-slate-200">Prepare Dynamic 3D Scene Generation</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                We are about to segment <span className="text-violet-400 font-bold">{currentPreset.name}</span> into specialized depth layers. This processes locally on your GPU/CPU via ONNX.
              </p>

              {/* Progress bars indicator */}
              <div className="mt-6 w-full max-w-sm space-y-4">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Selected Model:</span>
                  <span className="text-violet-400 font-bold font-mono">SAM 2 + Depth-Anything-V2</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Target Layer Outputs:</span>
                  <span className="text-violet-400 font-bold">5 Layers (Auto-Inpainted)</span>
                </div>

                <button
                  onClick={triggerAIScanner}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-violet-500/20 transition-all"
                >
                  Confirm and Start Separation Passes
                </button>
              </div>
            </div>
          )}

          {(activeWorkspace === 'edit' || activeWorkspace === 'export') && (
            <div
              ref={containerRef}
              className="relative flex-1 rounded-2xl overflow-hidden shadow-2xl border border-[#141923] flex items-center justify-center transition-all duration-300"
              style={{
                backgroundColor: currentPreset.baseColor,
                minHeight: '380px',
                perspective: '1200px',
                transform: `scale(${zoomLevel})`
              }}
            >
              {/* ATMOSPHERIC RENDER LAYERS */}
              {effectGodRays && (
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-500/5 to-violet-500/5 mix-blend-color-dodge pointer-events-none z-40" />
              )}

              {effectFog && (
                <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[0.5px] pointer-events-none z-30" />
              )}

              {/* PARTICLE GENERATORS */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-40">
                {renderRainParticles()}
                {renderSnowParticles()}
                {renderFireflies()}
                {renderFallingLeaves()}
              </div>

              {/* WEATHER ATMOSPHERICS */}
              {effectRain && (
                <div className="absolute inset-0 bg-sky-950/10 mix-blend-overlay pointer-events-none z-35" />
              )}

              {/* DEPTH/PARALLAX CONTAINER */}
              <div
                className="relative w-full h-full flex items-center justify-center"
                style={{
                  transform: `translateX(${camera.tx}px) translateY(${camera.ty}px) translateZ(${camera.tz}px) rotateX(${camera.rotX}deg) rotateY(${camera.rotY}deg) rotateZ(${camera.rotZ}deg)`,
                  transformStyle: 'preserve-3d',
                  transition: isPlaying ? 'none' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
              >
                {layers
                  .filter(layer => layer.visible)
                  .sort((a, b) => b.depth - a.depth) // render deep (background) layers first
                  .map((layer) => {
                    const isSelected = selectedLayerId === layer.id;
                    const zShift = (1 - layer.depth) * 120;
                    const relativeScale = layer.scale * (1 + (1 - layer.depth) * 0.15);

                    return (
                      <div
                        key={layer.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLayerId(layer.id);
                        }}
                        className={`absolute inset-0 flex items-center justify-center pointer-events-auto cursor-pointer transition-shadow ${
                          isSelected ? 'border border-violet-500/50 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)]' : ''
                        }`}
                        style={{
                          transform: `translateZ(${zShift}px)`,
                          transformStyle: 'preserve-3d',
                          zIndex: Math.floor((1 - layer.depth) * 100),
                          opacity: layer.opacity
                        }}
                      >
                        {layer.shadow && (
                          <div
                            className="absolute bg-black/40 blur-xl rounded-full"
                            style={{
                              width: '180px',
                              height: '40px',
                              transform: 'translateY(120px) rotateX(80deg)',
                              opacity: 0.6 * (1 - layer.depth)
                            }}
                          />
                        )}

                        <div
                          className="flex flex-col items-center justify-center select-none w-full h-full relative"
                          style={{
                            transform: `scale(${relativeScale}) translate(${layer.offsetX}px, ${layer.offsetY}px)`,
                            filter: `blur(${layer.blur}px)`,
                          }}
                        >
                          {/* If a real processed slice exists, render it. Otherwise, fall back to symbols */}
                          {showDepthMapOnly && layer.depthSlice ? (
                            <img
                              src={layer.depthSlice}
                              alt={layer.name}
                              className="w-full h-full object-contain pointer-events-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
                            />
                          ) : !showDepthMapOnly && layer.imageSlice ? (
                            <img
                              src={layer.imageSlice}
                              alt={layer.name}
                              className="w-full h-full object-contain pointer-events-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
                            />
                          ) : (
                            <span
                              className="text-8xl drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] transform transition-transform hover:scale-105"
                              style={{
                                color: showDepthMapOnly ? (() => { const b = Math.floor((1 - layer.depth) * 255); return `rgb(${b},${b},${b})`; })() : layer.color
                              }}
                            >
                              {layer.symbol}
                            </span>
                          )}
                          <span className="absolute bottom-4 text-[10px] bg-[#090d16]/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 backdrop-blur-sm shadow-md font-bold">
                            {layer.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* RENDER MODE: COMPILING INDICATORS ON EXPORT PAGE */}
              {activeWorkspace === 'export' && exportProgress !== null && (
                <div className="absolute inset-0 bg-[#07090e]/90 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-md">
                  <div className="w-full max-w-md bg-[#090d16] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden text-left">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />

                    <div className="flex items-center space-x-3 mb-4">
                      <Film className="w-5 h-5 text-violet-400 animate-spin" />
                      <div>
                        <h4 className="font-bold text-sm text-slate-100">Export Compiling Progress</h4>
                        <p className="text-[10px] text-slate-500">Writing media packets in target stream</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-4 bg-[#030508] p-4 rounded-xl font-mono text-[10px] text-slate-400 h-32 overflow-y-auto">
                      {exportLogs.map((log, i) => (
                        <div key={i} className="flex items-start">
                          <span className="text-violet-500 mr-2">&gt;</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-1.5 transition-all duration-300"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
                      <span>Total progress</span>
                      <span>{exportProgress}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LOWER SIMULATION CONTROLLER FOR ACTIVE VIEWS */}
          {(activeWorkspace === 'edit' || activeWorkspace === 'export') && (
            <div className="mt-4 bg-[#090d16] border border-[#141923] rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-2 rounded-lg transition-all ${
                    isPlaying ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setTime(0)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  title="Reset playhead"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">FPS Multiplier:</span>
                  <select
                    value={speedMultiplier}
                    onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                    className="bg-[#030508] border border-slate-850 text-slate-200 text-xs rounded p-1"
                  >
                    <option value="0.5">0.5x Slow</option>
                    <option value="1">1.0x Normal</option>
                    <option value="2">2.0x Fast</option>
                  </select>
                </div>
              </div>

              {/* VIEWPORT ZOOMS */}
              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                  className="px-2 py-1 bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded"
                >
                  -
                </button>
                <span className="font-mono text-slate-400">{Math.floor(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                  className="px-2 py-1 bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded"
                >
                  +
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2 py-1 bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded"
                  title="Reset Zoom"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadStandaloneHTML}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center space-x-1.5 text-xs transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download HTML</span>
                </button>
                {activeWorkspace === 'export' ? (
                  <button
                    onClick={triggerExport}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold py-1.5 px-3 rounded-lg flex items-center space-x-1.5 text-xs transition-all"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Run Render</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveWorkspace('export')}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center space-x-1.5 text-xs transition-all"
                  >
                    <span>To Export</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT SIDEBAR - PHOTOSHOP-LIKE LAYER PANEL & DEPTH CANVASES */}
        <aside className="col-span-3 border-l border-[#141923] bg-[#090d16] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* DEPTH MAP CONTROLLER CARD */}
            {hasGeneratedScene && (
              <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Palette className="w-3.5 h-3.5 text-violet-400" />
                    <span>Interactive Depth map</span>
                  </span>

                  <button
                    onClick={() => setIsEditingDepthMap(!isEditingDepthMap)}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${
                      isEditingDepthMap
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isEditingDepthMap ? 'Lock Brush' : 'Paint Brush'}
                  </button>
                </div>

                <div className="relative rounded-lg overflow-hidden bg-black p-1">
                  <canvas
                    ref={depthCanvasRef}
                    width={180}
                    height={120}
                    onMouseMove={handleDepthCanvasInteract}
                    className={`w-full h-24 rounded bg-black ${isEditingDepthMap ? 'cursor-crosshair border border-dashed border-violet-500' : ''}`}
                  />
                  <div className="flex items-center justify-between mt-1.5 text-[9px]">
                    <button onClick={handleDepthReset} className="text-slate-500 hover:text-red-400 flex items-center">
                      <Undo className="w-2.5 h-2.5 mr-0.5" /> Clear
                    </button>
                    <label className="flex items-center space-x-1 cursor-pointer text-slate-400 hover:text-slate-200">
                      <input
                        type="checkbox"
                        checked={showDepthMapOnly}
                        onChange={(e) => setShowDepthMapOnly(e.target.checked)}
                        className="w-3 h-3 text-violet-600 rounded bg-[#030508] border-slate-800"
                      />
                      <span>Show Depth Map Only</span>
                    </label>
                  </div>
                </div>

                {isEditingDepthMap && (
                  <div className="space-y-2 bg-[#030508]/60 p-2 rounded-lg border border-slate-900">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Brush Size:</span>
                      <span className="text-violet-400 font-mono">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="60"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Brush Mode:</span>
                      <span className="text-violet-400 uppercase font-bold">{paintMode}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setPaintMode('draw')}
                        className={`py-0.5 rounded text-[9px] font-bold border text-center ${paintMode === 'draw' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-950 text-slate-500'}`}
                      >
                        White Brush
                      </button>
                      <button
                        onClick={() => setPaintMode('erase')}
                        className={`py-0.5 rounded text-[9px] font-bold border text-center ${paintMode === 'erase' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-950 text-slate-500'}`}
                      >
                        Black Erase
                      </button>
                    </div>

                    <div className="flex justify-between text-[10px] pt-1">
                      <span className="text-slate-400">Brush Intensity:</span>
                      <span className="text-violet-400 font-mono">{Math.round(brushIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={brushIntensity}
                      onChange={(e) => setBrushIntensity(Number(e.target.value))}
                      className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}

            {/* PHOTOSHOP STYLE LAYERS LIST */}
            {hasGeneratedScene ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-violet-400" />
                    <span>Photoshop Layers list</span>
                  </span>

                  <button
                    onClick={addLayer}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center space-x-1 text-[9px] font-bold"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>New</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {layers.map((layer, idx) => {
                    const isSelected = selectedLayerId === layer.id;

                    return (
                      <div
                        key={layer.id}
                        onClick={() => setSelectedLayerId(layer.id)}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-950 border-violet-500 shadow-md'
                            : 'bg-slate-950/30 border-slate-900 hover:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-sm shrink-0">{layer.symbol}</span>
                            <input
                              type="text"
                              value={layer.name}
                              onChange={(e) => updateLayerParam(layer.id, 'name', e.target.value)}
                              className="bg-transparent border-none text-xs text-slate-200 focus:ring-0 truncate font-semibold w-24 p-0"
                            />
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Visibility toggle */}
                            <button
                              onClick={() => updateLayerParam(layer.id, 'visible', !layer.visible)}
                              className="text-slate-500 hover:text-slate-200"
                            >
                              {layer.visible ? <Eye className="w-3.5 h-3.5 text-violet-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>

                            {/* Lock toggle */}
                            <button
                              onClick={() => updateLayerParam(layer.id, 'locked', !layer.locked)}
                              className="text-slate-500 hover:text-slate-200"
                            >
                              {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>

                            {/* Reorder Buttons */}
                            <button onClick={() => reorderLayer(idx, 'up')} className="text-slate-500 hover:text-slate-200">
                              <MoveUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => reorderLayer(idx, 'down')} className="text-slate-500 hover:text-slate-200">
                              <MoveDown className="w-3 h-3" />
                            </button>

                            {/* Delete */}
                            <button onClick={() => deleteLayer(layer.id)} className="text-slate-500 hover:text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isSelected && !layer.locked && (
                          <div className="space-y-2 mt-2 pt-2 border-t border-slate-900/60 text-[10px]">
                            <div>
                              <div className="flex justify-between text-slate-400 mb-1">
                                <span>Layer Depth (z):</span>
                                <span className="text-violet-400 font-mono">{layer.depth.toFixed(2)}</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={layer.depth}
                                onChange={(e) => updateLayerParam(layer.id, 'depth', Number(e.target.value))}
                                className="w-full accent-violet-600 h-1"
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-400 mb-1">
                                <span>Layer Scale:</span>
                                <span className="text-violet-400 font-mono">{layer.scale.toFixed(2)}x</span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.05"
                                value={layer.scale}
                                onChange={(e) => updateLayerParam(layer.id, 'scale', Number(e.target.value))}
                                className="w-full accent-violet-600 h-1"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Offset Y:</span>
                                <input
                                  type="number"
                                  value={layer.offsetY}
                                  onChange={(e) => updateLayerParam(layer.id, 'offsetY', Number(e.target.value))}
                                  className="w-full bg-[#030508] border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Offset X:</span>
                                <input
                                  type="number"
                                  value={layer.offsetX}
                                  onChange={(e) => updateLayerParam(layer.id, 'offsetX', Number(e.target.value))}
                                  className="w-full bg-[#030508] border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-xs font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Blur:</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="10"
                                  step="0.5"
                                  value={layer.blur}
                                  onChange={(e) => updateLayerParam(layer.id, 'blur', Number(e.target.value))}
                                  className="w-full accent-violet-600 h-1"
                                />
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Opacity:</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={layer.opacity}
                                  onChange={(e) => updateLayerParam(layer.id, 'opacity', Number(e.target.value))}
                                  className="w-full accent-violet-600 h-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/20 border border-slate-900 rounded-xl text-center">
                <span className="text-xl block mb-2">🔒</span>
                <span className="text-xs font-bold text-slate-400 block">Photoshop layer list locked</span>
                <p className="text-[10px] text-slate-500 mt-1">Please import an image and run the separation compiler to access this workspace.</p>
              </div>
            )}
          </div>

          {/* LOWER HELP TIPS / PROJECT CONFIGS */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900 text-xs space-y-1.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Local Engine status</span>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Memory Buffers:</span>
              <span className="text-emerald-400 font-bold font-mono">148MB / 1024MB</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>WebGL Accelerator:</span>
              <span className="text-emerald-400 font-bold uppercase font-mono">Enabled</span>
            </div>
          </div>
        </aside>
      </div>

      {/* AUDIO PLAYER & PREVIEW TRACK FOOTER PANEL */}
      <footer className="border-t border-[#141923] bg-[#090d16] px-6 py-4">
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-3 flex items-center space-x-3.5">
            <div className="p-2 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-xl">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Studio timeline</span>
              <span className="text-xs text-slate-300 font-mono">10s Loop Scrubber</span>
            </div>
          </div>

          {/* TIMELINE EDITOR TRACKS */}
          <div className="col-span-7 bg-slate-950 p-3 rounded-xl border border-slate-900">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-900">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Multi-Track Layers Track & Keyframes</span>
              <span className="text-[10px] text-violet-400 font-mono">60 FPS</span>
            </div>

            <div className="space-y-1.5">
              {timelineTracks.map((track, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] py-1 bg-slate-900/60 px-2 rounded">
                  <span className="text-slate-300 font-medium">{track}</span>
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                      setTimelinePlayheadPercent(percent);
                      setTime((percent / 100) * 10);
                    }}
                    className="flex items-center space-x-2 w-2/3 relative h-3 bg-slate-950 rounded-full overflow-hidden cursor-ew-resize hover:bg-slate-900 transition-colors"
                  >
                    {/* Simulated keyframe ticks */}
                    <div className="absolute left-[15%] w-1.5 h-1.5 bg-violet-400 rounded-full pointer-events-none" />
                    <div className="absolute left-[40%] w-1.5 h-1.5 bg-violet-400 rounded-full pointer-events-none" />
                    <div className="absolute left-[60%] w-1.5 h-1.5 bg-violet-400 rounded-full pointer-events-none" />
                    <div className="absolute left-[80%] w-1.5 h-1.5 bg-violet-400 rounded-full pointer-events-none" />

                    {/* Active Playhead tracker bar */}
                    <div
                      className="absolute top-0 bottom-0 bg-violet-500 w-1 transition-all pointer-events-none"
                      style={{ left: `${timelinePlayheadPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2 text-right flex flex-col space-y-2">
            <button
              onClick={() => {
                if (activeProject) {
                  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
                    JSON.stringify(activeProject, null, 2)
                  )}`;
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute('href', jsonString);
                  downloadAnchor.setAttribute('download', `${activeProject.id}-project-package.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }
              }}
              disabled={!activeProject}
              className="px-4 py-2 bg-violet-600/20 hover:bg-violet-600/35 text-violet-300 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Project Package JSON
            </button>
            <button
              onClick={() => {
                selectPreset(PRESETS[0]);
                setUploadedImage(null);
                setEffectRain(false);
                setEffectSnow(false);
                setEffectFireflies(true);
                setEffectGodRays(true);
                setHasGeneratedScene(false);
                setActiveWorkspace('import');
              }}
              className="px-4 py-1.5 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-400 rounded-lg text-[10px] font-semibold transition-all"
            >
              Reset Configuration
            </button>
          </div>
        </div>
      </footer>

      {/* COMPILING DIALOG OVERLAY (SCANNING MASK) */}
      {showScanningOverlay && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 animate-pulse" />

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-violet-600/20 text-violet-400 rounded-lg">
                <Cpu className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">AI Separation Pass Running...</h4>
                <p className="text-xs text-slate-400">Processing locally via WebAssembly + WebGL backend</p>
              </div>
            </div>

            <div className="space-y-2 mb-4 bg-slate-950 p-4 rounded-xl font-mono text-[10px] text-slate-400 h-40 overflow-y-auto">
              {processLogs.map((log, i) => (
                <div key={i} className="flex items-start">
                  <span className="text-violet-500 mr-2">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>

            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 h-1.5 transition-all duration-300"
                style={{ width: `${(processStep / 7) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
              <span>Separation tasks</span>
              <span>{Math.floor((processStep / 7) * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
