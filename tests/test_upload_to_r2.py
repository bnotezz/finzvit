import os
import gzip
import json
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from scripts.upload_to_r2 import (
    load_checkpoint,
    append_checkpoint,
    verify_uploaded_sample,
    upload_dataset,
)


class TestUploadToR2(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_checkpoint_load_and_append(self):
        ckpt_path = os.path.join(self.temp_dir.name, ".checkpoint_test.txt")
        self.assertEqual(load_checkpoint(ckpt_path), set())

        with open(ckpt_path, "a", encoding="utf-8") as f:
            append_checkpoint(f, "12345678")
            append_checkpoint(f, "87654321")

        loaded = load_checkpoint(ckpt_path)
        self.assertEqual(loaded, {"12345678", "87654321"})

    def test_verify_uploaded_sample_success(self):
        mock_uploader = MagicMock()
        mock_client = MagicMock()
        mock_uploader.get_client.return_value = mock_client
        mock_uploader.bucket_name = "test-bucket"

        mock_client.head_object.return_value = {
            "ContentEncoding": "gzip",
            "CacheControl": "public, max-age=31536000, immutable",
            "ContentLength": 1024,
        }

        res = verify_uploaded_sample(mock_uploader, 2023, ["2023/12345678.json"])
        self.assertTrue(res)
        mock_client.head_object.assert_called_once_with(
            Bucket="test-bucket", Key="2023/12345678.json"
        )

    def test_verify_uploaded_sample_failure_on_missing_gzip(self):
        mock_uploader = MagicMock()
        mock_client = MagicMock()
        mock_uploader.get_client.return_value = mock_client
        mock_uploader.bucket_name = "test-bucket"

        mock_client.head_object.return_value = {
            "ContentEncoding": None,
            "CacheControl": "public, max-age=31536000, immutable",
            "ContentLength": 1024,
        }

        res = verify_uploaded_sample(mock_uploader, 2023, ["2023/12345678.json"])
        self.assertFalse(res)

    def test_dry_run_dataset(self):
        # Створюємо кілька тестових json файлів
        for edrpou in ["11111111", "22222222"]:
            with open(os.path.join(self.temp_dir.name, f"{edrpou}.json"), "w") as f:
                json.dump({"edrpou": edrpou, "year": 2023}, f)

        # Dry run не повинен робити викликів до клієнта R2
        with patch("scripts.upload_to_r2.R2Uploader") as mock_r2_cls:
            mock_uploader = MagicMock()
            mock_uploader.is_configured.return_value = True
            mock_r2_cls.return_value = mock_uploader

            upload_dataset(
                data_dir=self.temp_dir.name,
                year=2023,
                dry_run=True,
                limit=10,
            )

            mock_uploader.get_client.assert_not_called()

    def test_gzip_compression_correctness(self):
        test_data = {"edrpou": "32673400", "name": "Кормотех", "year": 2023}
        raw_bytes = json.dumps(test_data).encode("utf-8")
        gz_bytes = gzip.compress(raw_bytes, compresslevel=6)

        self.assertTrue(gz_bytes.startswith(b"\x1f\x8b"))
        decompressed = gzip.decompress(gz_bytes)
        self.assertEqual(json.loads(decompressed.decode("utf-8")), test_data)


if __name__ == "__main__":
    unittest.main()
