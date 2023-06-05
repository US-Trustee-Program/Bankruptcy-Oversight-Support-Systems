import sys
import requests
import json
from veracode_api_signing.plugin_requests import RequestsAuthPluginVeracodeHMAC

api_base = "https://api.veracode.us/was/configservice/v1"
headers = {"User-Agent": "USTP Script", "Content-Type":"application/json"}

try:
    # payload = json.loads('{"name":"USTP-CAMS-WEB-02","scans":[{"scan_config_request":{"target_url":{"url":"https://ustp-cams-webapp.azurewebsites.net/test"}},"action_type":"ADD"}]}')

    # print(payload)

    # print(json.dumps(payload))

    response = requests.get(api_base + "/analyses/d07344c1be597e7bf974aa9d0c9f83f0", auth=RequestsAuthPluginVeracodeHMAC(), headers=headers)

except requests.RequestException as e:
    print(e)
    sys.exit(1)

if response.ok:
    print(response.status_code)
else:
    print(response.status_code)
    print(response.text)