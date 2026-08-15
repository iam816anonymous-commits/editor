# Architecture Benchmark Comparison Report
Author: Jules (AI Software Engineer)
Phase: Phase 0 Research & Architecture Specification

## Evaluated Candidate Architectures

### Architecture A: Simple Depth Warp
- **Visual Quality:** 3/10 (High distortion, rubber-sheet warping)
- **Subject Fidelity:** 2/10 (Facial features and silhouettes warp heavily)
- **Depth Realism:** 4/10 (Monocular depth applies flat translation)
- **Disocclusion Quality:** 2/10 (Holes stretched as smeared pixels)
- **Temporal Stability:** 3/10 (Heavy frame-to-frame tearing)
- **Computational Cost:** Very Low (1/10)
- **Implementation Complexity:** Very Low (1/10)
- **Licensing Risk:** Low (1/10)
- **Production Suitability:** Unsuitable

### Architecture B: Layered 2.5D Cards (3-5 Planes)
- **Visual Quality:** 5/10 (Cardboard cutout effect)
- **Subject Fidelity:** 5/10 (Subject bound to single plane)
- **Depth Realism:** 4/10 (Discontinuous step depth)
- **Disocclusion Quality:** 5/10 (Manual inpainting of background plane)
- **Temporal Stability:** 6/10 (No per-pixel tearing, but flat cards slide)
- **Computational Cost:** Low (2/10)
- **Implementation Complexity:** Low (3/10)
- **Licensing Risk:** Low (1/10)
- **Production Suitability:** Unsuitable for 3D realism

### Architecture C: Continuous Depth DIBR (Inverse Warping)
- **Visual Quality:** 6/10 (Disocclusion holes filled via nearest-neighbor)
- **Subject Fidelity:** 4/10 (Subject boundary bleeds into background)
- **Depth Realism:** 8/10 (Per-pixel physical reprojection)
- **Disocclusion Quality:** 4/10 (Inverse sampling creates boundary halos)
- **Temporal Stability:** 5/10 (Edge flicker on disocclusions)
- **Computational Cost:** Medium (4/10)
- **Implementation Complexity:** Medium (5/10)
- **Licensing Risk:** Low (1/10)
- **Production Suitability:** Moderate

### Architecture D: Depth + SAM 2 Subject Protection + DIBR
- **Visual Quality:** 7.5/10 (Rigid subject, soft background)
- **Subject Fidelity:** 9.5/10 (Zero facial/body distortion)
- **Depth Realism:** 8/10 (3D pinhole reprojection)
- **Disocclusion Quality:** 5/10 (Background voids require frame-by-frame filling)
- **Temporal Stability:** 7/10 (Subject perfectly stable, background flickers)
- **Computational Cost:** Medium-High (6/10)
- **Implementation Complexity:** High (7/10)
- **Licensing Risk:** Low (1/10 - Apache-2.0)
- **Production Suitability:** High

### Architecture E: Depth + SAM 2 Subject Protection + Pre-Inpainted Background Plate + 3D Forward Splatting (RECOMMENDED)
- **Visual Quality:** 9/10 (Clean parallax, zero tearing, rigid subject)
- **Subject Fidelity:** 10/10 (Subject fully decoupled from background displacement)
- **Depth Realism:** 9/10 (Physical 3D pinhole camera transforms)
- **Disocclusion Quality:** 9/10 (Pre-inpainted clean background plate reveals true background)
- **Temporal Stability:** 9/10 (Deterministic Z-buffering, zero frame-to-frame flicker)
- **Computational Cost:** Medium (5/10)
- **Implementation Complexity:** High (7/10)
- **Licensing Risk:** Low (1/10 - Apache-2.0 for models & code)
- **Production Suitability:** Optimal

### Architecture F: Neural Novel-View Synthesis (3D Gaussian Splatting / Zero123)
- **Visual Quality:** 9.5/10 (Photorealistic 3D synthesis)
- **Subject Fidelity:** 6/10 (Generative hallucination alters facial identity)
- **Depth Realism:** 9.5/10 (Full 3D scene representation)
- **Disocclusion Quality:** 9/10 (Generative background completion)
- **Temporal Stability:** 6/10 (Generative noise across frames)
- **Computational Cost:** Very High (10/10 - Requires multi-GPU inference)
- **Implementation Complexity:** Extremely High (10/10)
- **Licensing Risk:** High (8/10 - Non-commercial weights in many zero-shot 3D models)
- **Production Suitability:** Unsuitable for local real-time/lightweight deployment
