
import json
import re
import sys
import uuid
from datetime import datetime

default_url = "https://www.zaproxy.org/"
placeholder_file = "test/dats/dast-scan-results.md"

def strip_html(text):
    """Remove HTML tags from text and return clean text."""
    if not text:
        return ""
    # Replace closing tags with spaces to separate content
    clean = re.sub(r'</[^>]+>', ' ', text)
    # Remove remaining HTML tags
    clean = re.sub(r'<[^>]+>', '', clean)
    # Decode HTML entities if any
    clean = clean.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'")
    return clean.strip()


def extract_first_url(reference_text):
    """Extract the first valid HTTP/HTTPS URL from reference text that may contain HTML."""
    if not reference_text:
        return default_url

    # First strip HTML tags
    clean_text = strip_html(reference_text)

    # Split by whitespace to separate multiple URLs
    parts = clean_text.split()

    return next(
        (
            part.rstrip('.,;')
            for part in parts
            if part.startswith(('http://', 'https://'))
        ),
        default_url,
    )


def zap_json_to_sarif(zap_json):
    rule_ids = {}
    results = []
    rules = []

    for alert in zap_json.get("site", [{}])[0].get("alerts", []):
        rule_id = alert["pluginid"]
        name = alert["name"]
        severity = alert["riskdesc"].split(" ")[0].lower()
        description = strip_html(alert["desc"])  # Strip HTML from description
        help_uri = extract_first_url(alert.get("reference", ""))  # Extract first URL

        if rule_id not in rule_ids:
            rule = {
                "id": rule_id,
                "name": name,
                "shortDescription": {"text": name},
                "fullDescription": {"text": description},
                "helpUri": help_uri,
                "properties": {
                    "severity": severity
                }
            }
            rule_ids[rule_id] = True
            rules.append(rule)

        for instance in alert.get("instances", []):
            uri = instance.get("uri", "unknown")
            evidence = instance.get("evidence", "")
            result = {
                "ruleId": rule_id,
                "level": map_severity(severity),
                "message": {"text": name},
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {
                                "uri": placeholder_file
                            },
                            "region": {
                                "startLine": 1,
                                "startColumn": 1
                            }
                        },
                        "logicalLocations": [
                            {
                                "kind": "url",
                                "name": uri
                            }
                        ]
                    }
                ]
            }
            if evidence:
                result["partialFingerprints"] = {
                    "evidence": str(uuid.uuid5(uuid.NAMESPACE_URL, evidence))
                }
            results.append(result)

    # return the sarif document
    return {
        "version": "2.1.0",
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "OWASP ZAP",
                        "informationUri": "https://www.zaproxy.org/",
                        "rules": rules
                    }
                },
                "results": results
            }
        ]
    }

def map_severity(severity):
    return {
        "high": "error",
        "medium": "warning",
        "low": "note",
        "informational": "note"
    }.get(severity.lower(), "none")

def main():
    if len(sys.argv) != 3:
        print("Usage: python zap_json_to_sarif.py input.json output.sarif")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r") as f:
        zap_data = json.load(f)

    sarif_data = zap_json_to_sarif(zap_data)

    with open(output_path, "w") as f:
        json.dump(sarif_data, f, indent=2)

    print(f"Converted {input_path} to SARIF at {output_path}")

if __name__ == "__main__":
    main()
