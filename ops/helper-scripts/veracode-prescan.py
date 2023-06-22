#!/usr/bin/env python

import sys
import requests
import time
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


def schedule_dast_prescan(name, id):
    payload = {}
    payload['name'] = name

    response = requests.put(
        "{}/analyses/{}".format(API_BASE, id),
        params={'method': 'PATCH', 'run_verification': 'true'},
        auth=RequestsAuthPluginVeracodeHMAC(),
        headers=REQUEST_HEADERS,
        json=payload)

    if response.ok:
        print(response.status_code)
    else:
        print(response.status_code)
        print(response.text)
        sys.exit(1)


def status_check_dast_prescan(id):
    counter = 0
    while counter < 20:
        counter = counter + 1
        time.sleep(30)
        statusResp = requests.get(
            "{}/analyses/{}/scans".format(API_BASE, id),
            auth=RequestsAuthPluginVeracodeHMAC(),
            headers=REQUEST_HEADERS)

        data = statusResp.json()
        status = data['_embedded']['scans'][0]['latest_occurrence_status']['status_type']
        print("{} {}".format(counter, status))
        if status == 'FINISHED_VERIFYING_RESULTS':
            print("Veracode Prescan Status Good")
            sys.exit(0)
        elif status == 'VERIFICATION_FAILED':
            print("VERIFICATION_FAILED")
            sys.exit(2)

    print("Veracode Prescan timeout")
    sys.exit(2)


if len(sys.argv) < 2 or sys.argv[1].strip() == "":
    print("Missing arugment")
    sys.exit(3)
dast_name = sys.argv[1]

analysis_id = get_analysis_id(dast_name)
schedule_dast_prescan(dast_name, analysis_id)
status_check_dast_prescan(analysis_id)
