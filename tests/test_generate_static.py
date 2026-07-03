import json
import os
import tempfile
import unittest
from pathlib import Path

from app import generate_static


class FormatReleasedTests(unittest.TestCase):
    def test_formats_iso_timestamp(self):
        out = generate_static.format_released("2026-06-12T16:46:48.0549Z")
        self.assertIn("Jun 12, 2026", out)
        self.assertIn("UTC", out)

    def test_returns_na_for_empty_none_or_na(self):
        self.assertEqual(generate_static.format_released(""), "N/A")
        self.assertEqual(generate_static.format_released("N/A"), "N/A")
        self.assertEqual(generate_static.format_released(None), "N/A")

    def test_returns_input_for_unparseable(self):
        self.assertEqual(generate_static.format_released("not-a-date"), "not-a-date")


class LastSyncedTests(unittest.TestCase):
    def test_returns_na_when_missing(self):
        self.assertEqual(
            generate_static.get_last_synced_utc("/no/such/file.json"), "N/A"
        )

    def test_formats_existing_file_mtime(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp.write(b"{}")
            name = tmp.name
        try:
            out = generate_static.get_last_synced_utc(name)
            self.assertIn("UTC", out)
            self.assertNotEqual(out, "N/A")
        finally:
            os.unlink(name)


class RenderIndexTests(unittest.TestCase):
    def test_injects_catalog_metadata(self):
        data = {
            "catalogVersion": "2026.06.12",
            "dateReleased": "2026-06-12T16:46:48.0549Z",
            "count": 1387,
        }
        html = generate_static.render_index_html(
            data, last_synced="Jun 12, 2026 · 00:00 UTC"
        )
        self.assertIn("2026.06.12", html)
        self.assertIn("1,387", html)  # countDisplay thousands separator
        self.assertIn("Jun 12, 2026", html)  # dateReleased humanized
        self.assertIn('id="main-table"', html)  # template shell intact

    def test_defaults_when_fields_missing(self):
        html = generate_static.render_index_html({}, last_synced="N/A")
        self.assertIn("N/A", html)


class BuildSiteTests(unittest.TestCase):
    def test_builds_full_site_tree(self):
        data = {
            "catalogVersion": "v1",
            "dateReleased": "2026-06-12T16:46:48.0549Z",
            "count": 2,
        }
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = os.path.join(tmp, "site")
            data_src = os.path.join(tmp, "data.json")
            Path(data_src).write_text(json.dumps(data), encoding="utf-8")

            generate_static.build_site(
                output_dir,
                data=data,
                data_src=data_src,
                last_synced="Jun 12, 2026 · 00:00 UTC",
            )

            self.assertTrue(os.path.isfile(os.path.join(output_dir, "index.html")))
            self.assertTrue(
                os.path.isfile(
                    os.path.join(output_dir, "known_exploited_vulnerabilities.json")
                )
            )
            # Static assets copied (the dashboard JS modules must be present).
            js_dir = os.path.join(output_dir, "static", "js")
            for mod in (
                "dashboard-config.js",
                "dashboard-dom.js",
                "dashboard-table.js",
                "dashboard.js",
            ):
                self.assertTrue(os.path.isfile(os.path.join(js_dir, mod)), mod)
            # Copied JSON matches source byte-for-byte payload.
            copied = json.loads(
                Path(
                    os.path.join(output_dir, "known_exploited_vulnerabilities.json")
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(copied, data)

    def test_rebuilds_clean_and_tolerates_missing_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = os.path.join(tmp, "site")
            os.makedirs(output_dir)
            stale = os.path.join(output_dir, "stale.txt")
            Path(stale).write_text("old", encoding="utf-8")
            data_src = os.path.join(tmp, "missing.json")  # exercises the warn branch

            generate_static.build_site(
                output_dir, data={"count": 0}, data_src=data_src, last_synced="N/A"
            )

            self.assertFalse(os.path.exists(stale))  # rmtree wiped prior output
            self.assertTrue(os.path.isfile(os.path.join(output_dir, "index.html")))
            self.assertFalse(
                os.path.isfile(
                    os.path.join(output_dir, "known_exploited_vulnerabilities.json")
                )
            )


if __name__ == "__main__":
    unittest.main()
