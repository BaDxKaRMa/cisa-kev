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
    try:
        remote = fetch_cisa_data()
        local = load_local_data()
        if local != remote:
            # Ensure the data directory exists
            os.makedirs(os.path.dirname(LOCAL_PATH), exist_ok=True)
            with open(LOCAL_PATH, "w") as f:
                json.dump(remote, f, indent=2)
            print("Data updated successfully")
            return True  # Data changed
        print("No changes in data")
        return False  # No change
    except Exception as e:
        print(f"Error updating data: {e}")
        # If there's an error fetching remote data, try to use local data
        local = load_local_data()
        if local is None:
            raise e  # Re-raise if no local data exists
        return False  # Use existing local data
