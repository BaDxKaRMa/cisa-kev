import os
import shutil
import sys

from jinja2 import Environment, FileSystemLoader

# Ensure project root is in sys.path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.data_utils import load_local_data, update_if_changed


def main():
    # Only update and generate if data changed
    changed = update_if_changed()
    if not changed:
        print("No new data. Exiting.")
        return

    # Prepare output directory
    output_dir = os.path.join(os.path.dirname(__file__), "..", "site")
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir)

    # Render templates
    env = Environment(
        loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates"))
    )
    template = env.get_template("index.html")
    data = load_local_data() or {}
    html = template.render(
        catalogVersion=data.get("catalogVersion", "N/A"),
        dateReleased=data.get("dateReleased", "N/A"),
        count=data.get("count", 0),
        vulns=data.get("vulnerabilities", []),
    )
    with open(os.path.join(output_dir, "index.html"), "w") as f:
        f.write(html)

    # Copy static assets
    static_src = os.path.join(os.path.dirname(__file__), "static")
    static_dst = os.path.join(output_dir, "static")
    shutil.copytree(static_src, static_dst)

    # Copy JSON data file to site directory
    data_src = os.path.join(
        os.path.dirname(__file__), "..", "data", "known_exploited_vulnerabilities.json"
    )
    data_dst = os.path.join(output_dir, "known_exploited_vulnerabilities.json")
    shutil.copy(data_src, data_dst)
    print("Static site generated in 'site/' directory, including JSON data file.")


if __name__ == "__main__":
    main()
