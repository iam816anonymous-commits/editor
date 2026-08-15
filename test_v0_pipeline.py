#!/usr/bin/env python3
"""
Unit & Integration Verification Suite for V0 Parallax Pipeline
Tests Level 1 (Pure Math), Level 2 (Real Model Integration), Level 3 (Real E2E Visual Rendering & Filesystem Verification).
"""

import os
import sys
import json
import unittest
import numpy as np
import cv2
from PIL import Image

import v0_pipeline

class TestV0Pipeline(unittest.TestCase):

    def setUp(self):
        self.h, self.w = 256, 256
        self.dummy_rgb = np.zeros((self.h, self.w, 3), dtype=np.uint8)
        # Create a simple colored square pattern
        self.dummy_rgb[64:192, 64:192] = [255, 128, 64]
        self.dummy_depth = np.linspace(0.1, 0.9, self.h * self.w).reshape(self.h, self.w).astype(np.float32)

    # =====================================================================
    # LEVEL 1: PURE MATHEMATICAL UNIT TESTS
    # =====================================================================

    def test_level1_guided_filter_bounds(self):
        filtered = v0_pipeline.guided_filter(self.dummy_rgb, self.dummy_depth, r=5, eps=0.01)
        self.assertEqual(filtered.shape, (self.h, self.w))
        self.assertGreaterEqual(filtered.min(), 0.0)
        self.assertLessEqual(filtered.max(), 1.0)

    def test_level1_pinhole_forward_splat_z_buffering(self):
        t_vec = np.array([0.05, 0.0, 0.0], dtype=np.float32)
        R_mat = np.eye(3, dtype=np.float32)

        warped_rgb, warped_z, _ = v0_pipeline.render_3d_forward_splat(
            self.dummy_rgb, self.dummy_depth, t_vec, R_mat
        )

        self.assertEqual(warped_rgb.shape, (self.h, self.w, 3))
        self.assertEqual(warped_z.shape, (self.h, self.w))

        # Check Z-buffer validity
        valid_z = warped_z[warped_z < 1e4]
        self.assertTrue(len(valid_z) > 0)
        self.assertGreater(valid_z.min(), 0.0)

    def test_level1_edge_aware_confidence_range(self):
        conf_map = v0_pipeline.compute_edge_aware_depth_confidence(self.dummy_rgb, self.dummy_depth)
        self.assertEqual(conf_map.shape, (self.h, self.w))
        self.assertGreaterEqual(conf_map.min(), 0.0)
        self.assertLessEqual(conf_map.max(), 1.0)

    def test_level1_closed_loop_motion_envelope(self):
        conf_map = np.ones((self.h, self.w), dtype=np.float32) * 0.8
        envelope = v0_pipeline.generate_closed_loop_motion_envelope(
            self.dummy_rgb, self.dummy_depth, conf_map, movement_style="Cinematic"
        )

        self.assertIn("final_limit", envelope)
        final_limit = envelope["final_limit"]
        self.assertIn("max_tx", final_limit)
        self.assertIn("max_disparity_px", final_limit)
        self.assertIn("scale_factor", final_limit)
        self.assertGreater(final_limit["max_tx"], 0.0)

    def test_level1_camera_trajectory_length(self):
        conf_map = np.ones((self.h, self.w), dtype=np.float32) * 0.8
        envelope = v0_pipeline.generate_closed_loop_motion_envelope(
            self.dummy_rgb, self.dummy_depth, conf_map, movement_style="Cinematic"
        )
        t_vecs, r_mats = v0_pipeline.plan_camera_trajectory(envelope, "Cinematic", num_frames=48)

        self.assertEqual(len(t_vecs), 48)
        self.assertEqual(len(r_mats), 48)

    # =====================================================================
    # LEVEL 2: REAL MODEL INTEGRATION & SCENE RECONSTRUCTION TESTS
    # =====================================================================

    def test_level2_background_reconstruction_and_provenance(self):
        subject_mask = np.zeros((self.h, self.w), dtype=np.uint8)
        subject_mask[64:192, 64:192] = 255

        bg_rgb, bg_depth, provenance = v0_pipeline.reconstruct_background(
            self.dummy_rgb, self.dummy_depth, subject_mask
        )

        self.assertEqual(bg_rgb.shape, (self.h, self.w, 3))
        self.assertEqual(bg_depth.shape, (self.h, self.w))
        self.assertEqual(provenance.shape, (self.h, self.w))

        # Check provenance binary values (255 observed, 0 reconstructed)
        self.assertTrue(set(np.unique(provenance)).issubset({0, 255}))

    def test_level2_model_loader_wrappers(self):
        depth_wrapper = v0_pipeline.get_depth_wrapper()
        sam2_wrapper = v0_pipeline.get_sam2_wrapper()

        self.assertIsNotNone(depth_wrapper)
        self.assertIsNotNone(sam2_wrapper)

        raw_depth = depth_wrapper.infer(self.dummy_rgb)
        self.assertEqual(raw_depth.shape, (self.h, self.w))

        mask, conf = sam2_wrapper.segment(self.dummy_rgb, raw_depth)
        self.assertEqual(mask.shape, (self.h, self.w))
        self.assertGreaterEqual(conf, 0.0)

    # =====================================================================
    # LEVEL 3: FILESYSTEM & DECODABILITY VERIFICATION
    # =====================================================================

    def test_level3_post_render_filesystem_verification(self):
        """
        Executes pipeline on user benchmark image and verifies generated file structure,
        image dimensions, MP4 decodability, frame counts, and metrics JSON schema.
        """
        input_image_path = "/tmp/file_attachments/WhatsApp Image 2026-08-12 at 09.49.04.jpeg"
        if not os.path.exists(input_image_path):
            self.skipTest(f"Test image {input_image_path} not available.")

        v0_pipeline.run_all_phase1_candidates(input_image_path)

        # Import hashlib to calculate hash path
        import hashlib
        with open(input_image_path, "rb") as f:
            img_hash = hashlib.sha256(f.read()).hexdigest()[:16]

        output_dir = os.path.join("output", img_hash)
        self.assertTrue(os.path.exists(output_dir), f"Directory {output_dir} does not exist!")

        # Load input image to dynamically verify dimensions
        input_img = Image.open(input_image_path)
        expected_h, expected_w = input_img.height, input_img.width

        # 1. Verify Root Diagnostic Files
        root_files = [
            "original.png", "depth.png", "subject_mask.png",
            "background_plate.png", "background_depth.png", "confidence_map.png"
        ]
        for r_file in root_files:
            file_path = os.path.join(output_dir, r_file)
            self.assertTrue(os.path.exists(file_path), f"Missing root artifact: {file_path}")
            img_chk = cv2.imread(file_path)
            self.assertIsNotNone(img_chk, f"Failed to decode image: {file_path}")
            self.assertEqual(img_chk.shape[:2], (expected_h, expected_w))

        # 2. Verify Motion Subdirectories & Video Decodability
        for style in ["subtle", "cinematic", "strong"]:
            style_dir = os.path.join(output_dir, style)
            self.assertTrue(os.path.exists(style_dir), f"Missing motion directory: {style_dir}")

            # Verify Keyframe PNGs
            for k_frame in ["frame_00.png", "frame_mid.png", "frame_last.png"]:
                k_path = os.path.join(style_dir, k_frame)
                self.assertTrue(os.path.exists(k_path), f"Missing keyframe: {k_path}")
                k_img = cv2.imread(k_path)
                self.assertIsNotNone(k_img, f"Corrupt keyframe image: {k_path}")
                self.assertEqual(k_img.shape[:2], (expected_h, expected_w))

            # Verify MP4 Video File Decodability & Frame Count
            mp4_path = os.path.join(style_dir, "output.mp4")
            self.assertTrue(os.path.exists(mp4_path), f"Missing video: {mp4_path}")
            cap = cv2.VideoCapture(mp4_path)
            self.assertTrue(cap.isOpened(), f"OpenCV failed to open MP4 video: {mp4_path}")

            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()

            self.assertEqual(frame_count, 48, f"Incorrect frame count in MP4: {frame_count}")
            self.assertEqual((height, width), (expected_h, expected_w), f"Incorrect video resolution: {width}x{height}")

            # Verify metrics.json
            metrics_path = os.path.join(style_dir, "metrics.json")
            self.assertTrue(os.path.exists(metrics_path), f"Missing metrics JSON: {metrics_path}")
            with open(metrics_path, "r") as f:
                data = json.load(f)

            self.assertIn("candidate", data)
            self.assertIn("max_screen_disparity_px", data)
            self.assertIn("subject_boundary_diagnostics", data)


if __name__ == "__main__":
    unittest.main()
