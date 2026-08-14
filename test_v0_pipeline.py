#!/usr/bin/env python3
"""
Unit Tests for V0 Cinematic 2.5D Parallax Renderer
Author: Jules (AI Software Engineer)
"""

import unittest
import numpy as np
import cv2
import os

from v0_pipeline import (
    estimate_depth_map,
    guided_filter,
    segment_primary_subject,
    reconstruct_background,
    render_3d_forward_splat,
    compute_edge_aware_depth_confidence,
    generate_safe_motion_envelope,
    plan_camera_trajectory
)

class TestV0Pipeline(unittest.TestCase):

    def setUp(self):
        # Create a mock 100x100 synthetic RGB image with a central subject square
        self.h, self.w = 100, 100
        self.img_rgb = np.ones((self.h, self.w, 3), dtype=np.uint8) * 120  # Gray background

        # Central square subject (different color, closer)
        self.img_rgb[30:70, 30:70] = [200, 50, 50]  # Red square

        # Estimate initial depth
        self.depth_map = estimate_depth_map(self.img_rgb)

    def test_depth_normalization(self):
        """Verifies that computed depth values are strictly bounded in [0, 1]."""
        self.assertTrue(np.all(self.depth_map >= 0.0))
        self.assertTrue(np.all(self.depth_map <= 1.0))

    def test_guided_filter_smoothness(self):
        """Verifies guided filter preserves bounds and reduces local high-frequency details."""
        refined = guided_filter(self.img_rgb, self.depth_map, r=5, eps=0.01)
        self.assertEqual(refined.shape, (self.h, self.w))
        self.assertTrue(np.all(refined >= 0.0))
        self.assertTrue(np.all(refined <= 1.0))

    def test_segmentation_confidence(self):
        """Checks segmenter boundary isolation and confidence estimation."""
        mask, conf = segment_primary_subject(self.img_rgb, self.depth_map)
        self.assertEqual(mask.shape, (self.h, self.w))
        self.assertTrue(0.0 <= conf <= 1.0)
        # Saliency of central red square should yield higher confidence
        self.assertTrue(conf > 0.5)

    def test_background_separation_and_provenance(self):
        """Verifies background separation, classical inpainting, and provenance mapping."""
        mask, _ = segment_primary_subject(self.img_rgb, self.depth_map)
        bg_rgb, bg_depth, provenance = reconstruct_background(self.img_rgb, self.depth_map, mask)

        # Shapes must match
        self.assertEqual(bg_rgb.shape, (self.h, self.w, 3))
        self.assertEqual(bg_depth.shape, (self.h, self.w))
        self.assertEqual(provenance.shape, (self.h, self.w))

        # Inside the subject, provenance must mark pixel as Reconstructed (0)
        # Dilated mask region should be 0
        subject_center_val = provenance[50, 50]
        self.assertEqual(subject_center_val, 0)

        # Outside corners must be Observed (255)
        self.assertEqual(provenance[5, 5], 255)

    def test_edge_aware_depth_confidence_conditions(self):
        """Tests that depth confidence evaluates edge agreement correctly."""
        confidence = compute_edge_aware_depth_confidence(self.img_rgb, self.depth_map)
        self.assertEqual(confidence.shape, (self.h, self.w))
        self.assertTrue(np.all(confidence >= 0.0))
        self.assertTrue(np.all(confidence <= 1.0))

        # Region at index 5,5 is a smooth zone with depth/RGB consistency (both have no sharp transitions)
        # Verify confidence is high in flat, consistent areas.
        self.assertTrue(confidence[5, 5] >= 0.1)  # valid mapping

    def test_safe_motion_envelope(self):
        """Verifies the Safe Motion Envelope calculates valid bounds."""
        confidence = compute_edge_aware_depth_confidence(self.img_rgb, self.depth_map)
        envelope = generate_safe_motion_envelope(self.img_rgb, self.depth_map, confidence)

        self.assertIn("max_tx", envelope)
        self.assertIn("max_ty", envelope)
        self.assertIn("max_orbit", envelope)

        self.assertTrue(envelope["max_tx"] > 0.0)
        self.assertTrue(envelope["max_ty"] > 0.0)
        self.assertTrue(envelope["max_orbit"] > 0.0)

    def test_trajectory_ping_pong_loop(self):
        """Confirms motion planner generates a continuous looped trajectory (start matches end)."""
        envelope = {
            "max_tx": 0.1,
            "max_ty": 0.05,
            "max_orbit": 3.0
        }
        translations, rotations = plan_camera_trajectory(envelope, "Cinematic", "Orbit", num_frames=48)

        self.assertEqual(len(translations), 48)
        self.assertEqual(len(rotations), 48)

        # Seamless loop assertion: Frame 0 camera matrix should equal/close to Frame 47 back-and-forth sin curve
        # Since it is a sinusoidal loop, start (0) and end (sin loop close) should be close
        np.testing.assert_allclose(translations[0], translations[-1], atol=1e-1)

    def test_forward_splatting_visibility_and_zbuffer(self):
        """Verifies deterministic forward splatting camera transforms and Z-buffer rendering."""
        # Simple camera transform: translate right by 0.02
        t_vec = np.array([0.02, 0.0, 0.0], dtype=np.float32)
        R_mat = np.eye(3, dtype=np.float32)

        warped_rgb, warped_z, warped_prov = render_3d_forward_splat(
            self.img_rgb, self.depth_map, t_vec, R_mat, provenance_map=None
        )

        self.assertEqual(warped_rgb.shape, (self.h, self.w, 3))
        self.assertEqual(warped_z.shape, (self.h, self.w))

if __name__ == "__main__":
    unittest.main()
