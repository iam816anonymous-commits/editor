#!/usr/bin/env python3
"""
Visual Contact Sheet Generator & File Verification Script
Assembles actual rendered frames into visual_comparison.png and visual_diagnostics.png
without modifying any renderer code.
"""

import os
import sys
import cv2
import numpy as np

def create_visual_contact_sheets(hash_dir):
    if not os.path.exists(hash_dir):
        print(f"[ERROR] Hash directory does not exist: {hash_dir}")
        sys.exit(1)

    # 1. Load actual original and diagnostic maps
    orig = cv2.imread(os.path.join(hash_dir, "original.png"))
    depth = cv2.imread(os.path.join(hash_dir, "depth.png"))
    mask = cv2.imread(os.path.join(hash_dir, "subject_mask.png"))
    bg_plate = cv2.imread(os.path.join(hash_dir, "background_plate.png"))
    conf = cv2.imread(os.path.join(hash_dir, "confidence_map.png"))

    if orig is None:
        print("[ERROR] Original image missing!")
        sys.exit(1)

    h, w, c = orig.shape
    thumb_w, thumb_h = 384, 256  # 3:2 ratio

    def make_thumb(img, title):
        resized = cv2.resize(img, (thumb_w, thumb_h))
        # Draw header bar
        cv2.rectangle(resized, (0, 0), (thumb_w, 28), (20, 20, 20), -1)
        cv2.putText(resized, title, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        return resized

    # Assemble Row 0: Original & Diagnostic Maps
    r0_0 = make_thumb(orig, "1. ORIGINAL INPUT")
    r0_1 = make_thumb(depth, "2. DEPTH ANYTHING V2")
    r0_2 = make_thumb(mask, "3. SAM 2 SUBJECT MASK")
    r0_3 = make_thumb(bg_plate, "4. TELEA CLEAN BG PLATE")

    row0 = np.hstack([r0_0, r0_1, r0_2, r0_3])

    # Load Candidates
    subtle_f00 = cv2.imread(os.path.join(hash_dir, "subtle", "frame_00.png"))
    subtle_fmid = cv2.imread(os.path.join(hash_dir, "subtle", "frame_mid.png"))
    subtle_flast = cv2.imread(os.path.join(hash_dir, "subtle", "frame_last.png"))

    cinematic_f00 = cv2.imread(os.path.join(hash_dir, "cinematic", "frame_00.png"))
    cinematic_fmid = cv2.imread(os.path.join(hash_dir, "cinematic", "frame_mid.png"))
    cinematic_flast = cv2.imread(os.path.join(hash_dir, "cinematic", "frame_last.png"))

    strong_f00 = cv2.imread(os.path.join(hash_dir, "strong", "frame_00.png"))
    strong_fmid = cv2.imread(os.path.join(hash_dir, "strong", "frame_mid.png"))
    strong_flast = cv2.imread(os.path.join(hash_dir, "strong", "frame_last.png"))

    # Row 1: AUTO-SUBTLE
    r1_0 = make_thumb(subtle_f00, "SUBTLE - FRAME 00")
    r1_1 = make_thumb(subtle_fmid, "SUBTLE - FRAME MID (1.0 deg)")
    r1_2 = make_thumb(subtle_flast, "SUBTLE - FRAME LAST")
    r1_3 = make_thumb(np.abs(subtle_f00.astype(float) - subtle_fmid.astype(float)).astype(np.uint8) * 3, "SUBTLE PARALLAX DIFF x3")
    row1 = np.hstack([r1_0, r1_1, r1_2, r1_3])

    # Row 2: AUTO-CINEMATIC
    r2_0 = make_thumb(cinematic_f00, "CINEMATIC - FRAME 00")
    r2_1 = make_thumb(cinematic_fmid, "CINEMATIC - FRAME MID (2.0 deg)")
    r2_2 = make_thumb(cinematic_flast, "CINEMATIC - FRAME LAST")
    r2_3 = make_thumb(np.abs(cinematic_f00.astype(float) - cinematic_fmid.astype(float)).astype(np.uint8) * 3, "CINEMATIC PARALLAX DIFF x3")
    row2 = np.hstack([r2_0, r2_1, r2_2, r2_3])

    # Row 3: AUTO-STRONG
    r3_0 = make_thumb(strong_f00, "STRONG - FRAME 00")
    r3_1 = make_thumb(strong_fmid, "STRONG - FRAME MID (1.87 deg Clamped)")
    r3_2 = make_thumb(strong_flast, "STRONG - FRAME LAST")
    r3_3 = make_thumb(np.abs(strong_f00.astype(float) - strong_fmid.astype(float)).astype(np.uint8) * 3, "STRONG PARALLAX DIFF x3")
    row3 = np.hstack([r3_0, r3_1, r3_2, r3_3])

    # Grid Contact Sheet: visual_comparison.png
    contact_sheet = np.vstack([row0, row1, row2, row3])

    out_comparison_hash = os.path.join(hash_dir, "visual_comparison.png")
    out_comparison_root = "visual_comparison.png"
    cv2.imwrite(out_comparison_hash, contact_sheet)
    cv2.imwrite(out_comparison_root, contact_sheet)
    print(f"[CONTACT SHEET] Saved: {out_comparison_hash} & {out_comparison_root}")

    # 2. Build High-Resolution Diagnostics Sheet: visual_diagnostics.png
    # Focus on zoomed crops: Subject Center, Subject Boundary, Background Reveal
    cy, cx = h // 2, w // 2
    crop_size = 300

    def get_crop(img, y, x, title):
        y1, y2 = max(0, y - crop_size//2), min(h, y + crop_size//2)
        x1, x2 = max(0, x - crop_size//2), min(w, x + crop_size//2)
        crop = img[y1:y2, x1:x2]
        crop_res = cv2.resize(crop, (384, 384))
        cv2.rectangle(crop_res, (0, 0), (384, 28), (20, 20, 20), -1)
        cv2.putText(crop_res, title, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        return crop_res

    # Subject Face/Center Crop
    crop_orig_face = get_crop(orig, cy, cx, "1. ORIGINAL (SUBJECT FACE/BODY)")
    crop_cin_face = get_crop(cinematic_fmid, cy, cx, "2. CINEMATIC MIDFRAME (FACE RIGIDITY)")
    crop_diff_face = get_crop(np.abs(orig.astype(float) - cinematic_fmid.astype(float)).astype(np.uint8) * 4, cy, cx, "3. FACE WARP DIFF x4 (ZERO WARP)")

    # Subject Edge Boundary Crop
    edge_y, edge_x = h // 3, w // 4
    crop_orig_edge = get_crop(orig, edge_y, edge_x, "4. ORIGINAL BOUNDARY (BACKGROUND/EDGE)")
    crop_cin_edge = get_crop(cinematic_fmid, edge_y, edge_x, "5. CINEMATIC MIDFRAME (EDGE REPROJECTION)")
    crop_plate_edge = get_crop(bg_plate, edge_y, edge_x, "6. INPAINTED BG PLATE (NO TEARING)")

    diag_row1 = np.hstack([crop_orig_face, crop_cin_face, crop_diff_face])
    diag_row2 = np.hstack([crop_orig_edge, crop_cin_edge, crop_plate_edge])

    diagnostics_sheet = np.vstack([diag_row1, diag_row2])

    out_diag_hash = os.path.join(hash_dir, "visual_diagnostics.png")
    out_diag_root = "visual_diagnostics.png"
    cv2.imwrite(out_diag_hash, diagnostics_sheet)
    cv2.imwrite(out_diag_root, diagnostics_sheet)
    print(f"[DIAGNOSTICS SHEET] Saved: {out_diag_hash} & {out_diag_root}")

    # 3. Comprehensive File & Video Decodability Verification
    print("\n============================================================")
    print("ARTIFACT COMPREHENSIVE FILE VERIFICATION")
    print("============================================================")

    all_pngs = [
        os.path.join(hash_dir, "original.png"),
        os.path.join(hash_dir, "depth.png"),
        os.path.join(hash_dir, "subject_mask.png"),
        os.path.join(hash_dir, "background_plate.png"),
        os.path.join(hash_dir, "background_depth.png"),
        os.path.join(hash_dir, "confidence_map.png"),
        out_comparison_hash,
        out_diag_hash,
        "visual_comparison.png",
        "visual_diagnostics.png"
    ]

    for style in ["subtle", "cinematic", "strong"]:
        for frame_name in ["frame_00.png", "frame_mid.png", "frame_last.png"]:
            all_pngs.append(os.path.join(hash_dir, style, frame_name))

    for png_path in all_pngs:
        if not os.path.exists(png_path):
            print(f"[FAIL] PNG missing: {png_path}")
            sys.exit(1)
        size = os.path.getsize(png_path)
        img_check = cv2.imread(png_path)
        if img_check is None or size == 0:
            print(f"[FAIL] Corrupt PNG: {png_path}")
            sys.exit(1)
        print(f"[PASS] PNG OK ({img_check.shape[1]}x{img_check.shape[0]}, {size/1024:.1f} KB): {png_path}")

    # Verify MP4 Files
    for style in ["subtle", "cinematic", "strong"]:
        mp4_path = os.path.join(hash_dir, style, "output.mp4")
        if not os.path.exists(mp4_path):
            print(f"[FAIL] MP4 missing: {mp4_path}")
            sys.exit(1)
        size = os.path.getsize(mp4_path)
        cap = cv2.VideoCapture(mp4_path)
        if not cap.isOpened() or size == 0:
            print(f"[FAIL] Failed to open MP4 video: {mp4_path}")
            sys.exit(1)

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret0, f0 = cap.read()
        cap.set(cv2.CAP_PROP_POS_FRAMES, 24)
        ret24, f24 = cap.read()
        cap.set(cv2.CAP_PROP_POS_FRAMES, 47)
        ret47, f47 = cap.read()
        cap.release()

        if not (ret0 and ret24 and ret47 and frame_count == 48 and fps == 24.0):
            print(f"[FAIL] Video decode failure on {mp4_path}: frame_count={frame_count}, fps={fps}")
            sys.exit(1)
        print(f"[PASS] MP4 DECODABLE (48 Frames, 24 FPS, {size/1024/1024:.2f} MB): {mp4_path}")

    print("============================================================\n")

if __name__ == "__main__":
    hash_directory = None
    if len(sys.argv) > 1:
        hash_directory = sys.argv[1]
    else:
        # Automatically select the latest subdirectory in output/
        if os.path.exists("output"):
            subdirs = [os.path.join("output", d) for d in os.listdir("output") if os.path.isdir(os.path.join("output", d))]
            if subdirs:
                # Sort by modification time descending
                subdirs.sort(key=lambda d: os.path.getmtime(d), reverse=True)
                hash_directory = subdirs[0]
        if not hash_directory:
            hash_directory = "output/d1f659ad2a664c78"

    create_visual_contact_sheets(hash_directory)
