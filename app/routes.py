import json
import os
from datetime import datetime

from flask import Blueprint, render_template

LOCAL_VULN = "data/known_exploited_vulnerabilities.json"
main = Blueprint("main", __name__)


def load_vulnerabilities():
    if not os.path.exists(LOCAL_VULN):
        return None
    with open(LOCAL_VULN, "r", encoding="utf-8") as f:
        return json.load(f)


def get_recent_vulns(vulns, days=30):
    recent = []
    now = datetime.utcnow().date()
    for v in vulns:
        try:
            date_added = datetime.strptime(v["dateAdded"], "%Y-%m-%d").date()
            if (now - date_added).days <= days:
                recent.append(v)
        except Exception:
            continue
    return recent


def get_high_priority_vulns(vulns):
    return [
        v for v in vulns if v.get("knownRansomwareCampaignUse", "Unknown") == "Known"
    ]


@main.route("/")
def index():
    data = load_vulnerabilities()
    if not data:
        return "No vulnerability data found. Please run update_kev.py first.", 404
    vulns = data.get("vulnerabilities", [])
    recent = get_recent_vulns(vulns)
    high_priority = get_high_priority_vulns(vulns)
    return render_template(
        "index.html",
        catalogVersion=data.get("catalogVersion"),
        dateReleased=data.get("dateReleased"),
        count=data.get("count"),
        recent=recent,
        high_priority=high_priority,
        vulns=vulns,
    )
