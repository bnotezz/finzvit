import unittest
from unittest.mock import patch, MagicMock
from worker.uploaders.supabase_uploader import SupabaseUploader

class TestSupabaseUploader(unittest.TestCase):

    def test_log_imported_dataset_without_credentials(self):
        uploader = SupabaseUploader(supabase_url=None, supabase_key=None)
        res = uploader.log_imported_dataset(
            name="Тестовий датасет",
            year=2025,
            resource_id="test-res-id"
        )
        self.assertFalse(res)

    @patch("urllib.request.urlopen")
    def test_log_imported_dataset_success(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        uploader = SupabaseUploader(
            supabase_url="https://test.supabase.co",
            supabase_key="fake-secret-key"
        )

        res = uploader.log_imported_dataset(
            name="Фінансова звітність підприємств за 2025 рік",
            year=2025,
            resource_id="fe3f6731-8a79-463b-b3af-03811d7a0e26",
            dataset_id="7436ae83-dfc1-4836-9962-8af3e831c522",
            file_hash="127849138586737fd0c1fcb9f0ac9034",
            companies_count=435000,
            forms_count=1200000
        )
        self.assertTrue(res)
        self.assertTrue(mock_urlopen.called)

    @patch("urllib.request.urlopen")
    def test_upsert_companies_with_weight(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        uploader = SupabaseUploader(
            supabase_url="https://test.supabase.co",
            supabase_key="fake-secret-key"
        )

        companies = [
            {"edrpou": "32673400", "name": "Кормотех", "year": 2025, "weight": 165000}
        ]
        res = uploader.upsert_companies(companies, batch_size=10)
        self.assertTrue(res)

if __name__ == "__main__":
    unittest.main()
