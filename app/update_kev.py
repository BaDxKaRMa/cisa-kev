import json
import os

import requests

SCHEMA_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities_schema.json"
VULN_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
LOCAL_SCHEMA = "data/known_exploited_vulnerabilities_schema.json"
LOCAL_VULN = "data/known_exploited_vulnerabilities.json"


def download_file(url):
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.text


def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    os.makedirs("data", exist_ok=True)
    remote_schema_text = download_file(SCHEMA_URL)
    local_schema = load_json(LOCAL_SCHEMA)
    remote_schema = json.loads(remote_schema_text)
    if not local_schema or local_schema.get("$id") != remote_schema.get("$id"):
        print("Updating local schema file.")
        save_file(LOCAL_SCHEMA, remote_schema_text)
    else:
        print("Local schema is up to date.")
    remote_vuln_text = download_file(VULN_URL)
    local_vuln = load_json(LOCAL_VULN)
    remote_vuln = json.loads(remote_vuln_text)
    if not local_vuln or local_vuln.get("catalogVersion") != remote_vuln.get(
        "catalogVersion"
    ):
        print("Updating local vulnerabilities file.")
        save_file(LOCAL_VULN, remote_vuln_text)
    else:
        print("Local vulnerabilities file is up to date.")


if __name__ == "__main__":
    main()
