import json
import os
import time

import requests

CISA_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
LOCAL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "known_exploited_vulnerabilities.json"
)


def fetch_cisa_data():
    headers = {"User-Agent": "cisa-kev-dashboard/0.1"}
    attempts = 3
    timeout_seconds = 20

    for attempt in range(1, attempts + 1):
        try:
            resp = requests.get(CISA_URL, headers=headers, timeout=timeout_seconds)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException:
            if attempt == attempts:
                raise
            time.sleep(attempt)


def load_local_data():
    if not os.path.exists(LOCAL_PATH):
        return None
    with open(LOCAL_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def update_if_changed():
    try:
        remote = fetch_cisa_data()
    except requests.RequestException as e:
        print(f"Error updating data: {e}")
        # If there's an error fetching remote data, try to use local data
        local = load_local_data()
        if local is None:
            raise  # Re-raise if no local data exists
        return False  # Use existing local data

    local = load_local_data()
    if local != remote:
        # Ensure the data directory exists
        os.makedirs(os.path.dirname(LOCAL_PATH), exist_ok=True)
        with open(LOCAL_PATH, "w", encoding="utf-8") as f:
            json.dump(remote, f, indent=2)
        print("Data updated successfully")
        return True  # Data changed
    print("No changes in data")
    return False  # No change
