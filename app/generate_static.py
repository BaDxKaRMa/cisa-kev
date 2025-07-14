import os
import shutil
import sys

from jinja2 import Environment, FileSystemLoader

# Ensure project root is in sys.path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.data_utils import load_local_data, update_if_changed


def main():
    # Update data and always generate site
    changed = update_if_changed()
    print(f"Data changed: {changed}")

    # Always generate the site (for GitHub Actions deployment)
    # In CI/CD, we want to ensure the site is always built

    # Prepare output directory - this will be the root of GitHub Pages
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
    if os.path.exists(data_src):
        shutil.copy(data_src, data_dst)
        print("JSON data file copied to site directory")
    else:
        print("Warning: JSON data file not found")

    print("Static site generated in 'site/' directory")

    # List contents for debugging
    print("Generated files:")
    for root, dirs, files in os.walk(output_dir):
        for file in files:
            print(f"  {os.path.relpath(os.path.join(root, file), output_dir)}")


if __name__ == "__main__":
    main()
