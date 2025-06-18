import json
import os

import requests

CISA_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
LOCAL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "known_exploited_vulnerabilities.json"
)


def fetch_cisa_data():
    resp = requests.get(CISA_URL)
    resp.raise_for_status()
    return resp.json()


def load_local_data():
    if not os.path.exists(LOCAL_PATH):
        return None
    with open(LOCAL_PATH, "r") as f:
        return json.load(f)


def update_if_changed():
    remote = fetch_cisa_data()
    local = load_local_data()
    if local != remote:
        with open(LOCAL_PATH, "w") as f:
            json.dump(remote, f, indent=2)
        return True  # Data changed
    return False  # No change
