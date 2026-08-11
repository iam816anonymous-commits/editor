# Cinematic Scene Generator (Cine-Parallax) 🎬✨

An advanced, desktop/web-compatible **Cinematic Scene Generator** (built with React, TypeScript, and Tailwind CSS) that transforms standard static images into fully layered, atmospheric, and animated 3D parallax scenes.

Perfect for making documentaries, YouTube intros, cinematic short reels, and custom ambient wallpapers.

---

## 🌟 Features

- **Layer Generation & AI Simulation**: Switch between multiple generation modes (Mode 1: Simple 3 Layers, Mode 2: Depth AI 20 Layers, Mode 3: Object Segmentation, Mode 4: Transparent PNG). Simulate localized AI scanning logs and progress indicators.
- **Atmospheric Effects Engine**: Toggle and configure real-time overlays such as **Rain**, **Snow**, **Embers**, **Fireflies**, **Wind (Leaves)**, **God Rays**, and **Mist**.
- **Cinematic 3D Camera Path Engine**: Keyframe-inspired preset camera paths including **Orbit**, **Pan Left-Right**, **Dolly Zoom (Push In)**, **Tilt**, and **Kinetic Mouse Tracking** which tilts layers based on mouse movement.
- **Interactive Depth Map Brush Editor**: A built-in canvas paint tool that allows users to manually brush or erase custom depth levels for fine-tuning layers.
- **Premiere Pro-Style Multi-Track Timeline**: A detailed visual keyframe timeline tracking Layer Keyframes, Camera Paths, Fog Level, and Audio indicators in real-time.
- **Standalone Export System**: Instantly package your custom setup into a fully responsive, lightweight, single-file HTML/CSS/JS standalone template for direct download.

---

## 🚀 Quick Start Guide

### Prerequisites
Ensure you have **Node.js** (v18+ recommended) and **npm** installed on your local machine.

### 1. Install Dependencies
Clone the repository and run the package installer:
```bash
npm install
```

### 2. Start the Development Server
Launch the local Vite server to access the live dashboard:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

### 3. Build for Production
To compile the application into fully optimized, production-ready static assets:
```bash
npm run build
```
The compiled output will be generated inside the `/dist` folder.

### 4. Running Verification Tests
If you want to run automated frontend visual verification tests, execute the Playwright test script:
```bash
python /home/jules/verification/verify_parallax.py
```
*(Ensure Playwright and Python dependencies are installed in your testing environment).*

---

## 🛠 Tech Stack Details

- **Frontend Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Animations & Interaction**: CSS 3D Transforms, Canvas API, canvas-confetti
- **Storage/Local Export**: Standalone dynamically bundled HTML exporter

---

Enjoy generating spectacular cinematic scenes! 🎥🌌
