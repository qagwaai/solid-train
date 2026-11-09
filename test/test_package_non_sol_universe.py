import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile


spec = importlib.util.spec_from_file_location(
    "packaging", Path(__file__).resolve().parent.parent / "scripts" / "package-non-sol-universe.py"
)
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class UniversePackagingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.input = self.root / "artifacts" / "reviewed-v1"
        self.input.mkdir(parents=True)
        (self.input / "plan.json").write_text('{"bodies": [1, 2, 3]}\n')
        (self.input / "progress.jsonl").write_text('{"complete": true}\n')
        self.archive = self.root / "delivery.zip"

    def test_roundtrip_and_changed_original(self):
        result = packaging.pack(self.root, ["artifacts/reviewed-v1"], self.archive)
        self.assertEqual(result["payloadFilesVerified"], 2)
        self.assertEqual(result["archiveEntries"], 3)
        self.assertEqual(packaging.verify(self.archive)["sha256"], result["sha256"])
        (self.input / "plan.json").write_text("changed")
        with self.assertRaisesRegex(ValueError, "Original hash/size mismatch"):
            packaging.verify(self.archive, self.root)

    def test_refuses_overwrite_without_altering_existing_archive(self):
        packaging.pack(self.root, ["artifacts/reviewed-v1"], self.archive)
        before = self.archive.read_bytes()
        with self.assertRaises(FileExistsError):
            packaging.pack(self.root, ["artifacts/reviewed-v1"], self.archive)
        self.assertEqual(self.archive.read_bytes(), before)

    def test_rejects_missing_input_and_nested_output(self):
        with self.assertRaisesRegex(ValueError, "Missing or outside-root"):
            packaging.pack(self.root, ["missing"], self.archive)
        with self.assertRaisesRegex(ValueError, "inside an input"):
            packaging.pack(self.root, ["artifacts/reviewed-v1"], self.input / "nested.zip")

    def test_rejects_unsafe_paths(self):
        for name in ("../escape", "/absolute", "C:/absolute", "a\\b", "a/../b", "a//b"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                packaging.safe_name(name)

    def test_detects_tampered_payload(self):
        with zipfile.ZipFile(self.archive, "w") as archive:
            archive.writestr("plan.json", "changed")
            archive.writestr(packaging.MANIFEST, json.dumps({
                "plan.json": {"bytes": 7, "sha256": "0" * 64}
            }))
        with self.assertRaisesRegex(ValueError, "Extracted hash/size mismatch"):
            packaging.verify(self.archive)

    def test_rejects_unlisted_and_duplicate_entries(self):
        with zipfile.ZipFile(self.archive, "w") as archive:
            archive.writestr(packaging.MANIFEST, "{}")
            archive.writestr("extra.json", "{}")
        with self.assertRaisesRegex(ValueError, "do not match manifest"):
            packaging.verify(self.archive)
        with zipfile.ZipFile(self.archive, "w") as archive:
            archive.writestr("Plan.json", "{}")
            archive.writestr("plan.json", "{}")
        with self.assertRaisesRegex(ValueError, "case-colliding"):
            packaging.verify(self.archive)


if __name__ == "__main__":
    unittest.main()
