import unittest

import numpy as np

from app.postprocess import (
    CLASS_NAMES,
    RIICHICAST_V2_CLASS_NAMES,
    ScoredBox,
    class_names_for_profile,
    compute_letterbox,
    decode_yolo_output,
    non_max_suppression,
)


class LetterboxTests(unittest.TestCase):
    def test_landscape_image_padding_matches_browser_implementation(self) -> None:
        info = compute_letterbox(1600, 1200)
        self.assertAlmostEqual(info.scale, 0.4)
        self.assertAlmostEqual(info.pad_x, 0)
        self.assertAlmostEqual(info.pad_y, 80)


class ClassContractTests(unittest.TestCase):
    def test_default_profile_is_riichicam_profile(self) -> None:
        self.assertEqual(class_names_for_profile("riichicam-current"), CLASS_NAMES)

    def test_riichicast_v2_profile_has_the_same_tile_vocabulary(self) -> None:
        self.assertEqual(set(RIICHICAST_V2_CLASS_NAMES), set(CLASS_NAMES))
        self.assertEqual(class_names_for_profile("riichicast-v2"), RIICHICAST_V2_CLASS_NAMES)

    def test_unknown_profile_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unknown model class profile"):
            class_names_for_profile("unknown")


class NmsTests(unittest.TestCase):
    def test_suppresses_same_class_overlap(self) -> None:
        boxes = [
            ScoredBox(100, 100, 40, 60, 0.9, 0),
            ScoredBox(105, 102, 40, 60, 0.6, 0),
        ]
        self.assertEqual(non_max_suppression(boxes, 0.5), [boxes[0]])

    def test_keeps_different_classes(self) -> None:
        boxes = [
            ScoredBox(100, 100, 40, 60, 0.9, 0),
            ScoredBox(105, 102, 40, 60, 0.6, 1),
        ]
        self.assertEqual(len(non_max_suppression(boxes, 0.5)), 2)


class DecodeTests(unittest.TestCase):
    def test_decodes_label_and_unletterboxes_coordinates(self) -> None:
        anchors = 2
        output = np.zeros((1, 4 + len(CLASS_NAMES), anchors), dtype=np.float32)
        output[0, 0:4, 0] = [320, 90, 40, 60]
        output[0, 4 + 3, 0] = 0.9

        predictions = decode_yolo_output(output, compute_letterbox(1600, 1200))

        self.assertEqual(len(predictions), 1)
        self.assertEqual(predictions[0]["class"], "1z")
        self.assertAlmostEqual(predictions[0]["x"], 800)
        self.assertAlmostEqual(predictions[0]["y"], 25)
        self.assertAlmostEqual(predictions[0]["confidence"], 0.9, places=6)

    def test_rejects_wrong_class_count(self) -> None:
        output = np.zeros((1, 14, 1), dtype=np.float32)
        with self.assertRaisesRegex(ValueError, "expected"):
            decode_yolo_output(output, compute_letterbox(640, 640))

    def test_uses_selected_class_profile(self) -> None:
        output = np.zeros((1, 4 + len(RIICHICAST_V2_CLASS_NAMES), 1), dtype=np.float32)
        output[0, 0:4, 0] = [320, 320, 40, 60]
        output[0, 4 + 1, 0] = 0.9

        predictions = decode_yolo_output(
            output,
            compute_letterbox(640, 640),
            class_names=RIICHICAST_V2_CLASS_NAMES,
        )

        self.assertEqual(predictions[0]["class"], "2m")


if __name__ == "__main__":
    unittest.main()
