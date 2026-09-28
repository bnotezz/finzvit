import os
import gzip
import json
import threading
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from concurrent.futures import ThreadPoolExecutor

try:
    import boto3
except ImportError:
    boto3 = None

from worker.uploaders.r2_uploader import R2Uploader

class TestR2Uploader(unittest.TestCase):

    def test_initialization_without_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            uploader = R2Uploader(
                account_id=None,
                access_key_id=None,
                secret_access_key=None
            )
            self.assertFalse(uploader.is_configured())
            self.assertIsNone(uploader.get_client())

    @unittest.skipIf(boto3 is None, "boto3 is not installed")
    @patch("boto3.session.Session")
    def test_thread_local_isolation(self, mock_session_cls):
        # Кожен виклик Session() повертає новий Mock-сесію та новий Mock-клієнт
        def create_mock_session(*args, **kwargs):
            session_mock = MagicMock()
            client_mock = MagicMock()
            session_mock.client.return_value = client_mock
            return session_mock

        mock_session_cls.side_effect = create_mock_session

        uploader = R2Uploader(
            account_id="fake_acc",
            access_key_id="fake_key",
            secret_access_key="fake_secret",
            bucket_name="test-bucket",
            max_workers=10
        )
        self.assertTrue(uploader.is_configured())

        # Перевіряємо, що у різних потоках get_client повертає унікальні екземпляри клієнта
        barrier = threading.Barrier(8)

        def worker_get_client(_):
            barrier.wait()
            client = uploader.get_client()
            return id(client)

        with ThreadPoolExecutor(max_workers=8) as ex:
            client_ids = list(ex.map(worker_get_client, range(8)))

        # Всі 8 потоків повинні отримати різні інстанси (потоко-ізольовані)
        self.assertEqual(len(set(client_ids)), 8)

    @unittest.skipIf(boto3 is None, "boto3 is not installed")
    @patch("boto3.session.Session")
    def test_upload_json(self, mock_session_cls):
        mock_client = MagicMock()
        mock_session = MagicMock()
        mock_session.client.return_value = mock_client
        mock_session_cls.return_value = mock_session

        uploader = R2Uploader(
            account_id="fake_acc",
            access_key_id="fake_key",
            secret_access_key="fake_secret",
            bucket_name="test-bucket"
        )

        sample_data = {"edrpou": "12345678", "name": "Тест"}
        res = uploader.upload_json("2025/12345678.json", sample_data)
        self.assertTrue(res)

        mock_client.put_object.assert_called_once()
        call_kwargs = mock_client.put_object.call_args[1]
        self.assertEqual(call_kwargs["Bucket"], "test-bucket")
        self.assertEqual(call_kwargs["Key"], "2025/12345678.json")
        self.assertEqual(call_kwargs["ContentType"], "application/json; charset=utf-8")
        self.assertEqual(call_kwargs["ContentEncoding"], "gzip")
        # Перевіряємо, що байти є валідним gzip-потоком і розпаковуються у вихідний JSON
        decompressed_bytes = gzip.decompress(call_kwargs["Body"])
        parsed_body = json.loads(decompressed_bytes.decode("utf-8"))
        self.assertEqual(parsed_body, sample_data)

    @unittest.skipIf(boto3 is None, "boto3 is not installed")
    @patch("boto3.session.Session")
    def test_upload_raw(self, mock_session_cls):
        mock_client = MagicMock()
        mock_session = MagicMock()
        mock_session.client.return_value = mock_client
        mock_session_cls.return_value = mock_session

        uploader = R2Uploader(
            account_id="fake_acc",
            access_key_id="fake_key",
            secret_access_key="fake_secret",
            bucket_name="test-bucket"
        )

        raw_data = b'{"status": "ok"}'
        res = uploader.upload_raw("metadata.json", raw_data, compress=True)
        self.assertTrue(res)

        mock_client.put_object.assert_called_once()
        call_kwargs = mock_client.put_object.call_args[1]
        self.assertEqual(call_kwargs["Key"], "metadata.json")
        self.assertEqual(call_kwargs["ContentEncoding"], "gzip")
        self.assertEqual(gzip.decompress(call_kwargs["Body"]), raw_data)

    @unittest.skipIf(boto3 is None, "boto3 is not installed")
    @patch("boto3.session.Session")
    def test_upload_batch_parallel(self, mock_session_cls):
        mock_client = MagicMock()
        mock_session = MagicMock()
        mock_session.client.return_value = mock_client
        mock_session_cls.return_value = mock_session

        uploader = R2Uploader(
            account_id="fake_acc",
            access_key_id="fake_key",
            secret_access_key="fake_secret",
            bucket_name="test-bucket",
            max_workers=5
        )

        items = [(f"2025/{i:08d}.json", {"index": i}) for i in range(30)]
        mock_pbar = MagicMock()

        success_count = uploader.upload_batch_parallel(items, pbar=mock_pbar)
        self.assertEqual(success_count, 30)
        self.assertEqual(mock_pbar.update.call_count, 30)
        self.assertEqual(mock_client.put_object.call_count, 30)

    def test_save_local_fallback(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            uploader = R2Uploader(
                account_id="",
                access_key_id="",
                secret_access_key="",
                local_output_dir=tmpdir,
                save_local=True
            )

            sample_data = {"test": 42}
            key = "sub/test.json"
            res = uploader.upload_json(key, sample_data)
            self.assertTrue(res)

            full_path = os.path.join(tmpdir, key)
            self.assertTrue(os.path.isfile(full_path))
            with open(full_path, "r", encoding="utf-8") as f:
                saved = json.load(f)
            self.assertEqual(saved, sample_data)

if __name__ == "__main__":
    unittest.main()
