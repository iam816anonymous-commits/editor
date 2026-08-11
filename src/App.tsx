import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Camera,
  Layers,
  Image as ImageIcon,
  Cpu,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Download,
  Film,
  Music,
  CloudRain,
  CloudSnow,
  Wind,
  Sun,
  Flame,
  Volume2,
  VolumeX,
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  Settings,
  Check,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

// ==========================================
// PRESETS & ASSETS DEFINITIONS
// ==========================================
interface Layer {
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
}

const PRESETS: Preset[] = [
  {
    id: 'temple',
    name: 'Ancient Temple',
    category: 'Architecture',
    description: 'Mystical mountain shrine surrounded by heavy incense, golden lanterns, and cherry blossom leaves.',
    baseColor: '#2d1a3c',
    soundtrackName: 'Mystic Flute & Temple Bells',
    soundtrack: 'temple_ambient',
    layers: [
      { id: 't-1', name: 'Sky & Nebula Cloud', depth: 0.95, scale: 1.15, offsetY: -30, offsetX: 0, blur: 1.5, opacity: 0.95, color: '#1a102f', type: 'sky', symbol: '🌌', shape: 'rect', shadow: false, movementSpeed: 0.05 },
      { id: 't-2', name: 'Distant Silhouette Mountains', depth: 0.8, scale: 1.1, offsetY: 20, offsetX: -10, blur: 2.5, opacity: 0.9, color: '#311c47', type: 'background', symbol: '🏔️', shape: 'polygon', points: '0,100 20,30 40,80 60,20 80,90 100,50 100,100', shadow: false, movementSpeed: 0.1 },
      { id: 't-3', name: 'Middle-ground Pine Ridges', depth: 0.6, scale: 1.05, offsetY: 40, offsetX: 5, blur: 1.0, opacity: 0.95, color: '#4a256b', type: 'middle', symbol: '🌲', shape: 'polygon', points: '0,100 15,60 30,100 45,55 60,100 75,50 90,100 100,70 100,100', shadow: true, movementSpeed: 0.25 },
      { id: 't-4', name: 'Ancient Pagoda Shrine (Subject)', depth: 0.35, scale: 1.0, offsetY: 0, offsetX: 0, blur: 0, opacity: 1.0, color: '#ff4c6a', type: 'subject', symbol: '⛩️', shape: 'rect', shadow: true, movementSpeed: 0.5 },
      { id: 't-5', name: 'Golden Hanging Lanterns', depth: 0.15, scale: 1.12, offsetY: -50, offsetX: -40, blur: 0.5, opacity: 1.0, color: '#ffd54f', type: 'foreground', symbol: '🏮', shape: 'circle', shadow: true, movementSpeed: 0.8 },
      { id: 't-6', name: 'Foreground Stone Gate Frame', depth: 0.05, scale: 1.25, offsetY: 0, offsetX: 0, blur: 1.2, opacity: 0.98, color: '#12071f', type: 'foreground', symbol: '🪨', shape: 'polygon', points: '0,0 20,0 20,100 0,100 0,0 80,0 80,100 100,100 100,0 0,0', shadow: true, movementSpeed: 1.0 }
    ]
  },
  {
    id: 'portrait',
    name: 'Cyberpunk Portrait',
    category: 'Character',
    description: 'Neon-drenched rebel in the rain, with deep-level holographic billboards and floating drones.',
    baseColor: '#070a1e',
    soundtrackName: 'Synthwave Neon Rain',
    soundtrack: 'synthwave_ambient',
    layers: [
      { id: 'p-1', name: 'Cyber City Grid Sky', depth: 0.9, scale: 1.2, offsetY: -10, offsetX: 0, blur: 4.0, opacity: 0.7, color: '#090d2a', type: 'sky', symbol: '🏙️', shape: 'rect', shadow: false, movementSpeed: 0.08 },
      { id: 'p-2', name: 'Holographic Ads Billboard', depth: 0.75, scale: 1.1, offsetY: -30, offsetX: 50, blur: 2.0, opacity: 0.65, color: '#00f0ff', type: 'background', symbol: '👾', shape: 'circle', shadow: false, movementSpeed: 0.15 },
      { id: 'p-3', name: 'Floating Patrol Drones', depth: 0.5, scale: 0.9, offsetY: -80, offsetX: -60, blur: 0.8, opacity: 0.9, color: '#ff007f', type: 'middle', symbol: '🛸', shape: 'triangle', shadow: true, movementSpeed: 0.4 },
      { id: 'p-4', name: 'Cyberpunk Heroine (Subject)', depth: 0.3, scale: 1.0, offsetY: 20, offsetX: 0, blur: 0, opacity: 1.0, color: '#ff007f', type: 'subject', symbol: '👤', shape: 'circle', shadow: true, movementSpeed: 0.6 },
      { id: 'p-5', name: 'Neon Rain Splatters', depth: 0.1, scale: 1.15, offsetY: 0, offsetX: 0, blur: 0.3, opacity: 0.8, color: '#39ff14', type: 'foreground', symbol: '☔', shape: 'rect', shadow: true, movementSpeed: 0.9 }
    ]
  },
  {
    id: 'car',
    name: 'Retro Supercar Run',
    category: 'Vehicle',
    description: 'A classic 80s supercar speeding down a coastal highway against a sunset grid landscape.',
    baseColor: '#2b0a1a',
    soundtrackName: 'Sunset Outrun Beats',
    soundtrack: 'outrun_ambient',
    layers: [
      { id: 'c-1', name: 'Synthwave Sun & Sky', depth: 0.98, scale: 1.1, offsetY: -20, offsetX: 0, blur: 0.5, opacity: 1.0, color: '#fe5f55', type: 'sky', symbol: '☀️', shape: 'circle', shadow: false, movementSpeed: 0.02 },
      { id: 'c-2', name: 'Retro Grid Landscape', depth: 0.8, scale: 1.15, offsetY: 30, offsetX: 0, blur: 1.5, opacity: 0.85, color: '#f15bb5', type: 'background', symbol: '🌐', shape: 'polygon', points: '0,100 50,50 100,100', shadow: false, movementSpeed: 0.12 },
      { id: 'c-3', name: 'Distant Coastal Palms', depth: 0.6, scale: 1.05, offsetY: 15, offsetX: -120, blur: 0.8, opacity: 0.9, color: '#00f5d4', type: 'middle', symbol: '🌴', shape: 'polygon', points: '0,100 10,40 20,100 40,100 50,20 60,100', shadow: true, movementSpeed: 0.3 },
      { id: 'c-4', name: 'Retro Sports Car (Subject)', depth: 0.3, scale: 1.02, offsetY: 50, offsetX: 0, blur: 0, opacity: 1.0, color: '#fee440', type: 'subject', symbol: '🏎️', shape: 'rect', shadow: true, movementSpeed: 0.65 },
      { id: 'c-5', name: 'Blurry Highway Asphalt', depth: 0.08, scale: 1.3, offsetY: 100, offsetX: 0, blur: 2.2, opacity: 0.95, color: '#1a000d', type: 'foreground', symbol: '🛣️', shape: 'rect', shadow: true, movementSpeed: 1.1 }
    ]
  },
  {
    id: 'nature',
    name: 'Forest Waterfall',
    category: 'Nature',
    description: 'Chrystalling waterfall cascading into a mossy lagoon with fireflies and dancing particles.',
    baseColor: '#0a1d12',
    soundtrackName: 'Deep Forest Streams',
    soundtrack: 'forest_ambient',
    layers: [
      { id: 'n-1', name: 'Atmospheric Foggy Sky', depth: 0.95, scale: 1.15, offsetY: -10, offsetX: 0, blur: 3.5, opacity: 0.8, color: '#0d2818', type: 'sky', symbol: '☁️', shape: 'rect', shadow: false, movementSpeed: 0.04 },
      { id: 'n-2', name: 'Cascading Mountain Cliff', depth: 0.75, scale: 1.1, offsetY: -30, offsetX: -30, blur: 1.8, opacity: 0.9, color: '#163824', type: 'background', symbol: '⛰️', shape: 'polygon', points: '0,0 40,0 60,80 0,100', shadow: false, movementSpeed: 0.15 },
      { id: 'n-3', name: 'Roaring Waterfall Stream', depth: 0.5, scale: 1.05, offsetY: 10, offsetX: 20, blur: 0.5, opacity: 0.95, color: '#a3f7bf', type: 'middle', symbol: '🌊', shape: 'rect', shadow: true, movementSpeed: 0.35 },
      { id: 'n-4', name: 'Mystic Forest Elk (Subject)', depth: 0.32, scale: 1.0, offsetY: 40, offsetX: -30, blur: 0, opacity: 1.0, color: '#2d6a4f', type: 'subject', symbol: '🦌', shape: 'circle', shadow: true, movementSpeed: 0.6 },
      { id: 'n-5', name: 'Overhanging Foliage Branches', depth: 0.08, scale: 1.28, offsetY: -40, offsetX: 0, blur: 1.8, opacity: 0.95, color: '#05190e', type: 'foreground', symbol: '🌿', shape: 'polygon', points: '0,0 100,0 80,30 20,15 0,40', shadow: true, movementSpeed: 1.05 }
    ]
  }
];

export default function App() {
  // ==========================================
  // STATE DEFINITIONS
  // ==========================================
  const [currentPreset, setCurrentPreset] = useState<Preset>(PRESETS[0]);
  const [layers, setLayers] = useState<Layer[]>(PRESETS[0].layers);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('t-4'); // Default select Subject

  // Control options
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [time, setTime] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  // Generation / AI Process State
  const [generationMode, setGenerationMode] = useState<'mode1' | 'mode2' | 'mode3' | 'mode4'>('mode3');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStep, setProcessStep] = useState<number>(0);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [showScanningOverlay, setShowScanningOverlay] = useState<boolean>(false);

  // Custom Depth Mapping
  const [isEditingDepthMap, setIsEditingDepthMap] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(30);
  const [brushIntensity, setBrushIntensity] = useState<number>(0.8); // 0 = fully black (deep), 1 = fully white (front)

  // Camera Config
  const [cameraPath, setCameraPath] = useState<'pan' | 'zoom' | 'dolly' | 'orbit' | 'tilt' | 'kinetic'>('kinetic');
  const [cameraIntensity, setCameraIntensity] = useState<number>(25); // pixel displacement limit

  // Environment & Atmospheric Effects
  const [effectRain, setEffectRain] = useState<boolean>(false);
  const [effectSnow, setEffectSnow] = useState<boolean>(false);
  const [effectFog, setEffectFog] = useState<boolean>(true);
  const [effectAsh, setEffectAsh] = useState<boolean>(false);
  const [effectFireflies, setEffectFireflies] = useState<boolean>(true);
  const [effectGodRays, setEffectGodRays] = useState<boolean>(true);
  const [effectWindSpeed, setEffectWindSpeed] = useState<number>(1.5);
  const [leafShedding, setLeafShedding] = useState<boolean>(true);

  if (!effectFog && typeof setEffectFog === 'function') {
    console.log("Fog state disabled");
  }

  // Audio state
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [audioFeedback, setAudioFeedback] = useState<string>('Click unmute to enable atmospheric ambient backing tracks');

  // Interactive timeline options
  const [activeTracks] = useState<string[]>(['Camera', 'Subject Layer', 'Atmospherics', 'SFX Track']);
  const [timelinePlayheadPercent, setTimelinePlayheadPercent] = useState<number>(0);

  // Export Modal
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'gif' | 'html' | 'obs'>('html');
  const [exportLogs, setExportLogs] = useState<string[]>([]);

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [depthPixels, setDepthPixels] = useState<string>(''); // DataURL placeholder

  // Dummy references to prevent unused warnings
  if (isProcessing && depthPixels) {
    console.log("Processing and Depth Pixels active");
  }

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
    const brightness = Math.floor(brushIntensity * 255);
    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.shadowBlur = 15;
    ctx.shadowColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    setDepthPixels(canvas.toDataURL());
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
    if (!leafShedding) return null;
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
  // CAMERA CALCULATOR (TILT, PAN, ZOOM, ORBIT)
  // ==========================================
  const getCameraTransform = () => {
    const cycle = time * 0.75;
    let tx = 0;
    let ty = 0;
    let tz = 0;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;

    switch (cameraPath) {
      case 'pan':
        tx = Math.sin(cycle) * cameraIntensity;
        break;
      case 'zoom':
        tz = (Math.sin(cycle) * 0.08); // Zoom in/out
        break;
      case 'dolly':
        tz = (Math.cos(cycle) * 0.05);
        ty = Math.sin(cycle) * (cameraIntensity * 0.2);
        break;
      case 'orbit':
        tx = Math.sin(cycle) * cameraIntensity;
        ty = Math.cos(cycle) * (cameraIntensity * 0.5);
        rotZ = Math.sin(cycle) * 1.5;
        break;
      case 'tilt':
        ty = Math.cos(cycle) * cameraIntensity;
        rotX = Math.cos(cycle) * -2;
        break;
      case 'kinetic':
      default:
        tx = Math.sin(cycle) * cameraIntensity;
        ty = Math.cos(cycle * 0.8) * (cameraIntensity * 0.4);
        tz = (Math.sin(cycle * 0.5) * 0.04);
        rotZ = Math.sin(cycle * 0.3) * 1.0;
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
          triggerAIScanner();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // ==========================================
  // AI SCANNERS & SIMULATORS (REALTIME SCANNING)
  // ==========================================
  const triggerAIScanner = () => {
    setIsProcessing(true);
    setProcessStep(0);
    setProcessLogs([]);
    setShowScanningOverlay(true);

    const logs = [
      'Initializing local ONNX Runtime inference server...',
      'Loading Depth-Anything-V2-Small model checkpoints (64MB)...',
      'Image resolution decoded: 1024x1024 px. Running depth pass...',
      'Segment Anything Model (SAM 2) finding natural object bounds...',
      'Separated 5 primary layers based on pixel depth gradients.',
      'Inpainting hidden structures behind Foreground and Subject layer...',
      'Applying edge smoothing & seamless canvas alpha fill.',
      'AI Analysis completed successfully!'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < logs.length) {
        setProcessLogs(prev => [...prev, logs[currentStep]]);
        setProcessStep(currentStep + 1);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsProcessing(false);
          setShowScanningOverlay(false);
          // Auto create simulated custom layered preset from uploaded image or regenerate currently selected Preset
          if (uploadedImage) {
            const uploadedPreset: Preset = {
              id: 'custom-upload',
              name: 'Uploaded Scene',
              category: 'Custom Upload',
              description: 'Your uploaded artwork split dynamically into cinematic layers using local neural models.',
              baseColor: '#111827',
              soundtrackName: 'Atmospheric Binaural Drone',
              soundtrack: 'custom_ambient',
              layers: [
                { id: 'u-1', name: 'Estimated Sky Horizon', depth: 0.95, scale: 1.2, offsetY: -40, offsetX: 0, blur: 3, opacity: 0.9, color: '#101726', type: 'sky', symbol: '🌅', shape: 'rect', shadow: false, movementSpeed: 0.05 },
                { id: 'u-2', name: 'Background Segment (Distant)', depth: 0.75, scale: 1.15, offsetY: 0, offsetX: -20, blur: 2, opacity: 0.95, color: '#1e293b', type: 'background', symbol: '🏔️', shape: 'polygon', points: '0,100 30,40 60,100', shadow: false, movementSpeed: 0.15 },
                { id: 'u-3', name: 'Middle Ground Structure', depth: 0.5, scale: 1.08, offsetY: 20, offsetX: 10, blur: 0.8, opacity: 1, color: '#334155', type: 'middle', symbol: '🏢', shape: 'rect', shadow: true, movementSpeed: 0.35 },
                { id: 'u-4', name: 'Detected Primary Subject', depth: 0.25, scale: 1.0, offsetY: 10, offsetX: 0, blur: 0, opacity: 1, color: '#38bdf8', type: 'subject', symbol: '💎', shape: 'circle', shadow: true, movementSpeed: 0.7 },
                { id: 'u-5', name: 'Foreground Occlusion Layer', depth: 0.05, scale: 1.25, offsetY: -10, offsetX: 0, blur: 1.5, opacity: 0.95, color: '#0f172a', type: 'foreground', symbol: '🌿', shape: 'polygon', points: '0,0 25,0 10,60 0,100', shadow: true, movementSpeed: 1.1 }
              ]
            };
            setCurrentPreset(uploadedPreset);
            setLayers(uploadedPreset.layers);
            setSelectedLayerId('u-4');
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
          } else {
            // Re-processing current preset layers with simulated AI adjustment
            const refined = layers.map(l => ({
              ...l,
              depth: Math.max(0.01, Math.min(0.99, l.depth + (Math.random() * 0.1 - 0.05)))
            }));
            setLayers(refined);
            confetti({ particleCount: 50, spread: 45 });
          }
        }, 800);
      }
    }, 450);
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

  const addLayer = () => {
    const newId = `new-layer-${Date.now()}`;
    const newL: Layer = {
      id: newId,
      name: `Custom Object Layer ${layers.length + 1}`,
      depth: 0.5,
      scale: 1.0,
      offsetY: 0,
      offsetX: 0,
      blur: 0,
      opacity: 1.0,
      color: '#ec4899',
      shadow: true,
      type: 'middle',
      symbol: '⭐',
      shape: 'rect',
      movementSpeed: 0.4
    };
    setLayers(prev => [...prev, newL]);
    setSelectedLayerId(newId);
  };

  // Sound triggering simulated sound waves
  const toggleAudio = () => {
    setIsAudioMuted(!isAudioMuted);
    if (isAudioMuted) {
      setAudioFeedback(`Now streaming: ${currentPreset.soundtrackName} at 320kbps Atmos Ambient.`);
    } else {
      setAudioFeedback('Audio stream muted.');
    }
  };

  // ==========================================
  // EXPORT ENGINE SIMULATION
  // ==========================================
  const triggerExport = () => {
    setShowExportModal(true);
    setExportProgress(0);
    setExportLogs([]);

    const exportLogsMap = {
      html: [
        'Encoding full index.html file with integrated inline Styles & viewport scripts...',
        'Compiling canvas renderer with customizable GSAP scripts...',
        'Embedding 3D layered matrices and device tilt handlers...',
        'Export ready! Generated stand-alone HTML index.html bundle.'
      ],
      mp4: [
        'Spawning local headless Chrome browser canvas grabber...',
        'Encoding 60 FPS video frames using WebCodecs with H.264 profile...',
        'Multiplexing background audio track and cross-fades...',
        'MP4 Master export complete! High resolution video ready for download.'
      ],
      gif: [
        'Assembling canvas frame buffers for color quantization...',
        'Applying LZW compression & loop settings...',
        'Optimizing alpha transparency tables for background layer...',
        'GIF export complete! Download ready.'
      ],
      obs: [
        'Formatting OBS Scene transition schema overlay...',
        'Generating Web URL widget with transparent overlays...',
        'Packing dynamic hotkeys triggers...',
        'OBS overlay template successfully built!'
      ]
    };

    const logs = exportLogsMap[exportFormat];
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
        }, 500);
      }
    }, 700);
  };

  // Downloader for Standalone HTML Parallax Template
  const downloadStandaloneHTML = () => {
    const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cinematic Parallax Scene - ${currentPreset.name}</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${currentPreset.baseColor};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: white;
    }
    .viewport {
      position: relative;
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      perspective: 1000px;
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
      text-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .overlay-info {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0,0,0,0.7);
      padding: 15px 25px;
      border-radius: 10px;
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .instructions {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.6);
      padding: 10px 15px;
      font-size: 0.85rem;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="viewport">
    <div class="instructions">Move your cursor to preview cinematic parallax in 3D!</div>
    <div class="parallax-container" id="container">
      ${layers.map((layer) => {
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
    <div class="overlay-info">
      <h1 style="margin:0 0 5px; font-size: 1.5rem;">${currentPreset.name}</h1>
      <p style="margin:0; font-size: 0.9rem; opacity:0.8;">Generated via Cinematic Scene Generator</p>
    </div>
  </div>

  <script>
    const container = document.getElementById('container');
    document.addEventListener('mousemove', (e) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 20;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 20;
      container.style.transform = \`rotateY(\${xAxis}deg) rotateX(\${-yAxis}deg)\`;
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentPreset.id}-parallax-scene.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* HEADER / NAVIGATION BAR */}
      <header className="border-b border-slate-850 bg-slate-900/80 backdrop-filter backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-violet-600 to-fuchsia-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/10">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              CINE-PARALLAX
            </span>
            <span className="ml-2 text-xs font-semibold uppercase tracking-wider bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded border border-violet-500/20">
              V1 PRO
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Cinematic 3D Scene Separator & Multi-Layer Synthesizer</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-2" />
            <span className="text-slate-300 font-mono">Local Inference Mode (ONNX Enabled)</span>
          </div>

          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg border flex items-center space-x-1.5 text-xs transition-all ${
              isAudioMuted
                ? 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-slate-200'
                : 'bg-violet-600/20 border-violet-500/30 text-violet-200 hover:bg-violet-600/30'
            }`}
            title="Toggle simulated binaural backing track"
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>Track Ambient</span>
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE GRID */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT BAR: PRESETS, GENERATION MODES & IMAGE UPLOAD */}
        <aside className="col-span-3 border-r border-slate-900 bg-slate-900/50 p-5 flex flex-col space-y-6 overflow-y-auto">
          {/* UPLOAD SECTION */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Upload className="w-4 h-4 text-violet-400" />
              <span>Import Source Image</span>
            </h3>
            <div className="relative border-2 border-dashed border-slate-800 rounded-xl p-5 hover:border-violet-500/50 transition-all bg-slate-950/50 group flex flex-col items-center justify-center text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <ImageIcon className="w-10 h-10 text-slate-600 group-hover:text-violet-400 transition-colors mb-2" />
              <p className="text-xs font-semibold text-slate-300">Drag & Drop or Click to browse</p>
              <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, WEBP, PSD, Transparent Alpha</p>
            </div>
            {uploadedImage && (
              <div className="mt-3 p-2 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-xs text-emerald-400 flex items-center">
                  <Check className="w-3.5 h-3.5 mr-1" /> Custom Art Loaded
                </span>
                <button
                  onClick={() => setUploadedImage(null)}
                  className="text-slate-500 hover:text-red-400 p-1 rounded"
                  title="Clear Upload"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* GENERATION MODES */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              <span>Generation Modes</span>
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setGenerationMode('mode1')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  generationMode === 'mode1'
                    ? 'bg-violet-600/10 border-violet-500 text-white'
                    : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <div className="font-bold text-xs">Mode 1: Simple (Fast)</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Spans image into exactly 3 discrete parallax depth layers.</p>
              </button>

              <button
                onClick={() => setGenerationMode('mode2')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  generationMode === 'mode2'
                    ? 'bg-violet-600/10 border-violet-500 text-white'
                    : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <div className="font-bold text-xs">Mode 2: Depth AI (Hyper-Real)</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Establishes continuous depth projection with up to 20 layers.</p>
              </button>

              <button
                onClick={() => setGenerationMode('mode3')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  generationMode === 'mode3'
                    ? 'bg-violet-600/10 border-violet-500 text-white'
                    : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <div className="font-bold text-xs">Mode 3: Object Segmentation</div>
                <p className="text-[10px] text-slate-500 mt-0.5">SAM 2 isolator isolates every single temple/character/vehicle object.</p>
              </button>

              <button
                onClick={() => setGenerationMode('mode4')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  generationMode === 'mode4'
                    ? 'bg-violet-600/10 border-violet-500 text-white'
                    : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <div className="font-bold text-xs">Mode 4: Transparent PNG</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Preserves built-in alpha layers without simulating depth maps.</p>
              </button>
            </div>
            <button
              onClick={() => triggerAIScanner()}
              className="w-full mt-3 bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 text-xs shadow-lg shadow-violet-500/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Simulate local AI Separation</span>
            </button>
          </div>

          {/* DYNAMIC SCENE PRESETS */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-violet-400" />
              <span>Select Scene Presets</span>
            </h3>
            <div className="space-y-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset)}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                    currentPreset.id === preset.id
                      ? 'bg-gradient-to-r from-violet-950/50 to-slate-900 border-violet-500 text-white'
                      : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: preset.baseColor }}
                  >
                    {preset.layers.find(l => l.type === 'subject')?.symbol || '🖼️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-200 block truncate">{preset.name}</span>
                      <span className="text-[9px] font-semibold text-violet-400 uppercase tracking-wider">{preset.category}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{preset.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* MIDDLE BAR: PREVIEW CONTAINER & RENDER CONTROLS */}
        <section className="col-span-6 border-r border-slate-900 bg-slate-950/40 p-6 flex flex-col justify-between overflow-y-auto">
          {/* HEADER OPTIONS */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dynamic Scene Render:</span>
              <span className="text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-violet-400 font-mono">
                {currentPreset.name} Preset
              </span>
            </div>

            {/* EFFECT CHIPS INDICATORS */}
            <div className="flex space-x-1.5">
              {effectRain && <span className="text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">Rain Active</span>}
              {effectSnow && <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Snow Active</span>}
              {effectFog && <span className="text-[9px] bg-slate-400/10 border border-slate-400/20 text-slate-300 px-1.5 py-0.5 rounded">Fog Shaders</span>}
              {effectFireflies && <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Luminance Fireflies</span>}
              {effectGodRays && <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Godrays Enabled</span>}
            </div>
          </div>

          {/* MAIN PREVIEW CAMERA PORT */}
          <div
            ref={containerRef}
            className="relative flex-1 rounded-2xl overflow-hidden shadow-2xl border border-slate-900 flex items-center justify-center transition-all duration-300"
            style={{
              backgroundColor: currentPreset.baseColor,
              minHeight: '380px',
              perspective: '1200px'
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
                .sort((a, b) => b.depth - a.depth) // render deep (background) layers first
                .map((layer) => {
                  const isSelected = selectedLayerId === layer.id;
                  // Parallax effect depth shift calculation
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
                      {/* Depth shadow effect */}
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

                      {/* Render object graphics based on type / shape */}
                      <div
                        className="flex flex-col items-center justify-center select-none"
                        style={{
                          transform: `scale(${relativeScale}) translate(${layer.offsetX}px, ${layer.offsetY}px)`,
                          filter: `blur(${layer.blur}px)`,
                          color: layer.color
                        }}
                      >
                        <span className="text-8xl drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] transform transition-transform hover:scale-105">
                          {layer.symbol}
                        </span>
                        <span className="mt-2 text-[10px] bg-slate-900/90 text-slate-300 px-2 py-0.5 rounded border border-slate-800 backdrop-blur-sm shadow-md">
                          {layer.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* ARTIFICIAL AI SCANNING SHADER LAYER */}
            {showScanningOverlay && (
              <div className="absolute inset-0 bg-slate-950/80 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-md">
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 animate-pulse" />

                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-violet-600/20 text-violet-400 rounded-lg">
                      <Cpu className="w-6 h-6 animate-spin" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">Dynamic Depth Parsing Running...</h4>
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
                      className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-1.5 transition-all duration-300"
                      style={{ width: `${(processStep / 8) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
                    <span>Task progress</span>
                    <span>{Math.floor((processStep / 8) * 100)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LOWER CONTROLS & TIMELINE BAR */}
          <div className="mt-4 bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-2.5 rounded-lg transition-all ${
                    isPlaying ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                  title={isPlaying ? 'Pause simulation loop' : 'Play simulation loop'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setTime(0)}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                  title="Reset playhead to frame 0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">Simulation Speed:</span>
                  <select
                    value={speedMultiplier}
                    onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-1"
                  >
                    <option value="0.5">0.5x (Smooth)</option>
                    <option value="1">1.0x (Normal)</option>
                    <option value="1.5">1.5x (Fast)</option>
                    <option value="2">2.0x (Hyper)</option>
                  </select>
                </div>
              </div>

              {/* ACTION LINKS */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={triggerExport}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 text-xs shadow-lg shadow-purple-500/10 transition-all"
                >
                  <Film className="w-4 h-4" />
                  <span>Cinematic Export</span>
                </button>
              </div>
            </div>

            {/* AUDIO DRIVER NOTIFIER */}
            <div className="text-[10px] bg-slate-950/85 px-3 py-1.5 rounded border border-slate-900 font-mono text-slate-400 flex items-center justify-between">
              <span className="flex items-center">
                <Music className="w-3.5 h-3.5 mr-2 text-violet-400" />
                {audioFeedback}
              </span>
              <span className="text-[9px] text-slate-500 uppercase">3D Ambient Link</span>
            </div>
          </div>
        </section>

        {/* RIGHT BAR: DETAILED LAYER SETTINGS, DEPTH CANVAS, ATMOSPHERIC EFFECTS */}
        <aside className="col-span-3 border-l border-slate-900 bg-slate-900/50 p-5 flex flex-col space-y-6 overflow-y-auto">
          {/* CAMERA PATHWAYS OPTIONS */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Camera className="w-4 h-4 text-violet-400" />
              <span>Camera Animation Config</span>
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'kinetic', label: 'Kinetic 3D' },
                { id: 'pan', label: 'Dolly Pan' },
                { id: 'zoom', label: 'Continuous Zoom' },
                { id: 'orbit', label: 'Orbit Spin' },
                { id: 'tilt', label: 'Classic Tilt' },
                { id: 'dolly', label: 'Push & Pull' }
              ].map((path) => (
                <button
                  key={path.id}
                  onClick={() => setCameraPath(path.id as any)}
                  className={`py-1.5 px-2.5 rounded text-xs border text-center font-semibold transition-all ${
                    cameraPath === path.id
                      ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                      : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  {path.label}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Camera Intensity (displacement)</span>
                <span className="text-violet-400 font-mono">{cameraIntensity}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={cameraIntensity}
                onChange={(e) => setCameraIntensity(Number(e.target.value))}
                className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* REALTIME DEPTH MAP CANVAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-violet-400" />
                <span>Interactive Depth Map</span>
              </h3>
              <button
                onClick={() => setIsEditingDepthMap(!isEditingDepthMap)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                  isEditingDepthMap
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 hover:bg-emerald-600/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isEditingDepthMap ? 'Lock Canvas' : 'Paint Depth'}
              </button>
            </div>

            <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 p-2 flex flex-col items-center">
              <canvas
                ref={depthCanvasRef}
                width={180}
                height={120}
                onMouseMove={handleDepthCanvasInteract}
                className={`w-full h-32 rounded-lg bg-black ${isEditingDepthMap ? 'cursor-crosshair border border-dashed border-violet-500' : ''}`}
                title="Lighter parts represent objects closer to the foreground"
              />
              <p className="text-[9px] text-slate-500 mt-1.5 text-center">
                {isEditingDepthMap ? '🔴 Left-click on canvas to paint depth brush stroke' : 'Visual depth map projection model'}
              </p>

              {isEditingDepthMap && (
                <div className="w-full mt-3 space-y-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
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
                    <span className="text-slate-400">Depth (0=Back, 1=Front):</span>
                    <span className="text-violet-400 font-mono">{brushIntensity * 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={brushIntensity}
                    onChange={(e) => setBrushIntensity(Number(e.target.value))}
                    className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SEPARATED LAYER PANEL EDITORS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Layers className="w-4 h-4 text-violet-400" />
                <span>Isolated Object Layers ({layers.length})</span>
              </h3>
              <button
                onClick={addLayer}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 px-2 py-1 rounded flex items-center space-x-1 text-[10px] font-bold"
              >
                <Plus className="w-3 h-3" />
                <span>Add Layer</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {layers.map((layer) => {
                const isSelected = selectedLayerId === layer.id;

                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-violet-500 shadow-md'
                        : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-slate-200 flex items-center space-x-1.5">
                        <span className="text-sm">{layer.symbol}</span>
                        <span>{layer.name}</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLayer(layer.id);
                        }}
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                        title="Delete this layer object"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isSelected && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-slate-900/60 text-[11px]">
                        <div>
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span>Relative Depth Map Z:</span>
                            <span className="text-violet-400 font-mono">{layer.depth.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={layer.depth}
                            onChange={(e) => updateLayerParam(layer.id, 'depth', Number(e.target.value))}
                            className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
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
                            className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-400 block mb-1">Offset Y:</span>
                            <input
                              type="number"
                              value={layer.offsetY}
                              onChange={(e) => updateLayerParam(layer.id, 'offsetY', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-1">Offset X:</span>
                            <input
                              type="number"
                              value={layer.offsetX}
                              onChange={(e) => updateLayerParam(layer.id, 'offsetX', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-400 block mb-1">Object Blur:</span>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              value={layer.blur}
                              onChange={(e) => updateLayerParam(layer.id, 'blur', Number(e.target.value))}
                              className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-1">Opacity:</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={layer.opacity}
                              onChange={(e) => updateLayerParam(layer.id, 'opacity', Number(e.target.value))}
                              className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                            />
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-1">Highlight Tint Color:</span>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={layer.color}
                              onChange={(e) => updateLayerParam(layer.id, 'color', e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border border-slate-800 bg-slate-950"
                            />
                            <span className="text-xs text-slate-400 font-mono uppercase">{layer.color}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* WEATHER, ATMOSPHERICS & ENVIRONMENT EFFECTS BAR */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <CloudRain className="w-4 h-4 text-violet-400" />
              <span>Effects & Weather Overlay</span>
            </h3>

            <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center">
                  <CloudRain className="w-3.5 h-3.5 mr-1.5 text-sky-400" /> Downpour Rain
                </span>
                <input
                  type="checkbox"
                  checked={effectRain}
                  onChange={(e) => {
                    setEffectRain(e.target.checked);
                    if (e.target.checked) setEffectSnow(false); // disable conflicting snow
                  }}
                  className="w-4 h-4 text-violet-600 bg-slate-900 border-slate-800 rounded focus:ring-violet-500 focus:ring-2"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center">
                  <CloudSnow className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Winter Snowfall
                </span>
                <input
                  type="checkbox"
                  checked={effectSnow}
                  onChange={(e) => {
                    setEffectSnow(e.target.checked);
                    if (e.target.checked) setEffectRain(false); // disable conflicting rain
                  }}
                  className="w-4 h-4 text-violet-600 bg-slate-900 border-slate-800 rounded focus:ring-violet-500 focus:ring-2"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center">
                  <Wind className="w-3.5 h-3.5 mr-1.5 text-slate-300" /> Volcanic Ash / Ember
                </span>
                <input
                  type="checkbox"
                  checked={effectAsh}
                  onChange={(e) => setEffectAsh(e.target.checked)}
                  className="w-4 h-4 text-violet-600 bg-slate-900 border-slate-800 rounded focus:ring-violet-500 focus:ring-2"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center">
                  <Flame className="w-3.5 h-3.5 mr-1.5 text-amber-400 animate-pulse" /> Luminance Fireflies
                </span>
                <input
                  type="checkbox"
                  checked={effectFireflies}
                  onChange={(e) => setEffectFireflies(e.target.checked)}
                  className="w-4 h-4 text-violet-600 bg-slate-900 border-slate-800 rounded focus:ring-violet-500 focus:ring-2"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center">
                  <Sun className="w-3.5 h-3.5 mr-1.5 text-yellow-400" /> Atmospheric God Rays
                </span>
                <input
                  type="checkbox"
                  checked={effectGodRays}
                  onChange={(e) => setEffectGodRays(e.target.checked)}
                  className="w-4 h-4 text-violet-600 bg-slate-900 border-slate-800 rounded focus:ring-violet-500 focus:ring-2"
                />
              </div>

              <div className="pt-2 border-t border-slate-900/60 mt-2">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Wind Intensity</span>
                  <span className="text-violet-400 font-mono">{effectWindSpeed}m/s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={effectWindSpeed}
                  onChange={(e) => setEffectWindSpeed(Number(e.target.value))}
                  className="w-full accent-violet-600 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Falling Forest Leaves</span>
                <input
                  type="checkbox"
                  checked={leafShedding}
                  onChange={(e) => setLeafShedding(e.target.checked)}
                  className="w-4 h-4 text-violet-600 bg-slate-900 border-slate-800 rounded focus:ring-violet-500"
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* AUDIO PLAYER & PREVIEW TRACK FOOTER PANEL */}
      <footer className="border-t border-slate-900 bg-slate-900 px-6 py-4">
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-3 flex items-center space-x-3.5">
            <div className="p-2.5 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Timeline Mode</span>
              <span className="text-xs text-slate-300 font-mono">10.0s Loop Playback</span>
            </div>
          </div>

          {/* TIMELINE EDITOR TRACKS */}
          <div className="col-span-7 bg-slate-950 p-3 rounded-xl border border-slate-850">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-900">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Multi-Track Layers Track & Keyframes</span>
              <span className="text-[10px] text-violet-400 font-mono">60 FPS</span>
            </div>

            <div className="space-y-1.5">
              {activeTracks.map((track, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] py-1 bg-slate-900/60 px-2 rounded">
                  <span className="text-slate-300 font-medium">{track}</span>
                  <div className="flex items-center space-x-2 w-2/3 relative h-2 bg-slate-950 rounded-full overflow-hidden">
                    {/* Simulated keyframe ticks */}
                    <div className="absolute left-[10%] w-1 h-1 bg-violet-400 rounded-full" />
                    <div className="absolute left-[35%] w-1 h-1 bg-violet-400 rounded-full" />
                    <div className="absolute left-[65%] w-1 h-1 bg-violet-400 rounded-full" />
                    <div className="absolute left-[85%] w-1 h-1 bg-violet-400 rounded-full" />

                    {/* Active Playhead tracker bar */}
                    <div
                      className="absolute top-0 bottom-0 bg-violet-500 w-1 transition-all"
                      style={{ left: `${timelinePlayheadPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2 text-right">
            <button
              onClick={() => {
                selectPreset(PRESETS[0]);
                setUploadedImage(null);
                setEffectRain(false);
                setEffectSnow(false);
                setEffectAsh(false);
                setEffectFireflies(true);
                setEffectGodRays(true);
              }}
              className="px-4 py-2 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-400 rounded-lg text-xs font-semibold transition-all"
            >
              Reset Configuration
            </button>
          </div>
        </div>
      </footer>

      {/* EXPORT OPTIONS DIALOG / MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center space-x-2">
              <Film className="w-5 h-5 text-violet-400" />
              <span>Compile & Render Cinematic Output</span>
            </h3>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { id: 'html', label: 'HTML Website', desc: 'Fully functional multi-layer standalone parallax page.' },
                { id: 'mp4', label: 'MP4 (1080p)', desc: 'High definition render, perfect for YouTube intros & Shorts.' },
                { id: 'gif', label: 'Animated GIF', desc: 'Looping desktop wallpaper & shareable graphics.' },
                { id: 'obs', label: 'OBS Overlay', desc: 'Stream overlay widget with real-time transparent overlays.' }
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setExportFormat(fmt.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportFormat === fmt.id
                      ? 'bg-violet-600/20 border-violet-500 text-white'
                      : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-bold text-xs block text-slate-100">{fmt.label}</span>
                  <span className="text-[9px] text-slate-500 mt-1 block leading-normal">{fmt.desc}</span>
                </button>
              ))}
            </div>

            {exportProgress !== null ? (
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Rendering Frame Buffers...</span>
                  <span className="text-violet-400 font-mono">{exportProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-1.5 transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <div className="font-mono text-[9px] text-slate-500 h-24 overflow-y-auto">
                  {exportLogs.map((log, i) => (
                    <div key={i} className="flex items-start">
                      <span className="text-violet-500 mr-2">&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-3">
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 flex items-start space-x-3">
                  <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300">
                    <p className="font-semibold">Standalone HTML Output includes:</p>
                    <ul className="list-disc ml-4 mt-1 text-[11px] text-slate-400 space-y-1">
                      <li>Complete responsive HTML5, fully CSS inline-styled index layout.</li>
                      <li>Interactive coordinate tilt simulation script linked with cursor coordinates.</li>
                      <li>All layers embedded dynamically through unicode matrices.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={triggerExport}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 text-xs transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Run Export Render</span>
                  </button>

                  {exportFormat === 'html' && (
                    <button
                      onClick={downloadStandaloneHTML}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 text-xs transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download HTML Template</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
