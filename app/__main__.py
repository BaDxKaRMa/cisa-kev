import subprocess
import sys

from app import create_app


def main():
    print("Updating CISA KEV data...")
    result = subprocess.run([sys.executable, "-m", "app.update_kev"])
    if result.returncode != 0:
        print("Update failed. Exiting.")
        sys.exit(1)
    print("Update complete. Starting web server...")
    app = create_app()
    app.run(host="0.0.0.0", port=8080, debug=True)


if __name__ == "__main__":
    main()
