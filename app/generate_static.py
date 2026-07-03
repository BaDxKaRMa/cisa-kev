import os
import shutil
import sys
from datetime import UTC, datetime

from jinja2 import Environment, FileSystemLoader

# Ensure project root is in sys.path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.data_utils import load_local_data, update_if_changed


DISPLAY_DATETIME = "%b %d, %Y · %H:%M UTC"

APP_DIR = os.path.dirname(__file__)
TEMPLATES_DIR = os.path.join(APP_DIR, "templates")
STATIC_DIR = os.path.join(APP_DIR, "static")
OUTPUT_DIR = os.path.join(APP_DIR, "..", "site")
DATA_SRC = os.path.join(APP_DIR, "..", "data", "known_exploited_vulnerabilities.json")


def get_last_synced_utc(data_path):
    if not os.path.exists(data_path):
        return "N/A"
    modified = datetime.fromtimestamp(os.path.getmtime(data_path), UTC)
    return modified.strftime(DISPLAY_DATETIME)


def format_released(value):
    """Humanize CISA's ISO timestamp (e.g. 2026-06-12T16:46:48.0549Z)."""
    if not value or value == "N/A":
        return "N/A"
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.strftime(DISPLAY_DATETIME)
    except (ValueError, TypeError):
        return value


def render_index_html(data, *, last_synced):
    """Render index.html from the catalog metadata (vulns render client-side)."""
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("index.html")
    count_value = data.get("count", 0)
    return template.render(
        catalogVersion=data.get("catalogVersion", "N/A"),
        dateReleased=format_released(data.get("dateReleased", "N/A")),
        lastSynced=last_synced,
        count=count_value,
        countDisplay=f"{count_value:,}" if isinstance(count_value, int) else count_value,
    )


def build_site(output_dir, *, data, data_src, last_synced):
    """Build the full static site tree into output_dir (destroyed and rebuilt)."""
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir)

    html = render_index_html(data, last_synced=last_synced)
    with open(os.path.join(output_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    shutil.copytree(STATIC_DIR, os.path.join(output_dir, "static"))

    data_dst = os.path.join(output_dir, "known_exploited_vulnerabilities.json")
    if os.path.exists(data_src):
        shutil.copy(data_src, data_dst)
        print("JSON data file copied to site directory")
    else:
        print("Warning: JSON data file not found")

    return output_dir


def main():
    # Update data and always generate site (for GitHub Actions deployment)
    changed = update_if_changed()
    print(f"Data changed: {changed}")

    data = load_local_data() or {}
    build_site(
        OUTPUT_DIR,
        data=data,
        data_src=DATA_SRC,
        last_synced=get_last_synced_utc(DATA_SRC),
    )

    print("Static site generated in 'site/' directory")

    # List contents for debugging
    print("Generated files:")
    for root, dirs, files in os.walk(OUTPUT_DIR):
        for file in files:
            print(f"  {os.path.relpath(os.path.join(root, file), OUTPUT_DIR)}")


if __name__ == "__main__":
    main()
