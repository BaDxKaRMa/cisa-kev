import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

from app import data_utils


class DataUtilsTests(unittest.TestCase):
    def test_fetch_cisa_data_retries_then_succeeds(self):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"ok": True}

        with patch.object(
            data_utils.requests,
            "get",
            side_effect=[
                requests.RequestException("temporary 1"),
                requests.RequestException("temporary 2"),
                response,
            ],
        ) as mock_get:
            with patch.object(data_utils.time, "sleep") as mock_sleep:
                result = data_utils.fetch_cisa_data()

        self.assertEqual(result, {"ok": True})
        self.assertEqual(mock_get.call_count, 3)
        mock_sleep.assert_any_call(1)
        mock_sleep.assert_any_call(2)

    def test_fetch_cisa_data_raises_after_max_retries(self):
        with patch.object(
            data_utils.requests,
            "get",
            side_effect=requests.RequestException("still failing"),
        ) as mock_get:
            with patch.object(data_utils.time, "sleep") as mock_sleep:
                with self.assertRaises(requests.RequestException):
                    data_utils.fetch_cisa_data()

        self.assertEqual(mock_get.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)

    def test_update_if_changed_writes_when_remote_differs(self):
        remote = {"catalogVersion": "1", "vulnerabilities": [{"cveID": "CVE-1"}]}

        with tempfile.TemporaryDirectory() as tmpdir:
            local_path = Path(tmpdir) / "known_exploited_vulnerabilities.json"

            with patch.object(data_utils, "LOCAL_PATH", str(local_path)):
                with patch.object(data_utils, "fetch_cisa_data", return_value=remote):
                    changed = data_utils.update_if_changed()

            self.assertTrue(changed)
            self.assertTrue(local_path.exists())
            self.assertEqual(json.loads(local_path.read_text(encoding="utf-8")), remote)

    def test_update_if_changed_returns_false_when_remote_matches_local(self):
        remote = {"catalogVersion": "2", "vulnerabilities": [{"cveID": "CVE-2"}]}

        with tempfile.TemporaryDirectory() as tmpdir:
            local_path = Path(tmpdir) / "known_exploited_vulnerabilities.json"
            local_path.write_text(json.dumps(remote), encoding="utf-8")
            before_mtime = local_path.stat().st_mtime_ns

            with patch.object(data_utils, "LOCAL_PATH", str(local_path)):
                with patch.object(data_utils, "fetch_cisa_data", return_value=remote):
                    changed = data_utils.update_if_changed()

            after_mtime = local_path.stat().st_mtime_ns
            self.assertFalse(changed)
            self.assertEqual(before_mtime, after_mtime)

    def test_update_if_changed_falls_back_to_local_on_request_error(self):
        local = {"catalogVersion": "3", "vulnerabilities": [{"cveID": "CVE-3"}]}

        with tempfile.TemporaryDirectory() as tmpdir:
            local_path = Path(tmpdir) / "known_exploited_vulnerabilities.json"
            local_path.write_text(json.dumps(local), encoding="utf-8")

            with patch.object(data_utils, "LOCAL_PATH", str(local_path)):
                with patch.object(
                    data_utils,
                    "fetch_cisa_data",
                    side_effect=requests.RequestException("network down"),
                ):
                    changed = data_utils.update_if_changed()

            self.assertFalse(changed)
            self.assertEqual(json.loads(local_path.read_text(encoding="utf-8")), local)

    def test_update_if_changed_raises_on_request_error_without_local_data(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            local_path = Path(tmpdir) / "known_exploited_vulnerabilities.json"

            with patch.object(data_utils, "LOCAL_PATH", str(local_path)):
                with patch.object(
                    data_utils,
                    "fetch_cisa_data",
                    side_effect=requests.RequestException("network down"),
                ):
                    with self.assertRaises(requests.RequestException):
                        data_utils.update_if_changed()


if __name__ == "__main__":
    unittest.main()
