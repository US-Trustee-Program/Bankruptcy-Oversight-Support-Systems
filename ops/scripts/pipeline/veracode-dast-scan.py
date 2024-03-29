#!/usr/bin/env python

import sys
import requests
from veracode_api_signing.plugin_requests import RequestsAuthPluginVeracodeHMAC

API_BASE = "https://api.veracode.us/was/configservice/v1"
REQUEST_HEADERS = {"User-Agent": "USTP Script",
                   "Content-Type": "application/json"}


def get_analysis_id(name):
    name = name.replace(" ", "%%20").strip()
    response = requests.get(
        "{}/analyses".format(API_BASE),
        params={'name': name},
        auth=RequestsAuthPluginVeracodeHMAC(),
        headers=REQUEST_HEADERS)
    if response.ok:
        data = response.json()
        return data['_embedded']['analyses'][0]['analysis_id']
    else:
        print(response.status_code)
        print(response.text)
        sys.exit(1)  # Request failed to retrieve analysis id


def schedule_dast_analysis(name, id):
    payload = {}
    payload['name'] = name
    payload['schedule'] = {
        'now': True,
        'duration': {
            'length': 1,
            'unit': 'DAY'
        }
    }
    response = requests.put(
        "{}/analyses/{}".format(API_BASE, id),
        params={'method': 'PATCH'},
        auth=RequestsAuthPluginVeracodeHMAC(),
        headers=REQUEST_HEADERS, json=payload)
    if response.ok:
        print(response.status_code)
        sys.exit(0)
    else:
        print(response.status_code)
        print(response.text)
        sys.exit(2)  # Request failed to schedule DAST scan


if len(sys.argv) < 2 or sys.argv[1].strip() == "":
    print("Missing arugment")
    sys.exit(3)
dast_name = sys.argv[1]

analysis_id = get_analysis_id(dast_name)
schedule_dast_analysis(dast_name, analysis_id)
