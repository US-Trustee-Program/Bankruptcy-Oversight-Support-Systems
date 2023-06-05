import sys
import requests
import json
import time
from veracode_api_signing.plugin_requests import RequestsAuthPluginVeracodeHMAC

api_base = "https://api.veracode.us/was/configservice/v1"
headers = {"User-Agent": "USTP Script", "Content-Type":"application/json"}

try:
    payload = json.loads('{"name":"CAMS Flexion","schedule":{"now":true,"duration":{"length":1,"unit":"DAY"}}}')

    response = requests.put(api_base + "/analyses/b022cc5c5616b85d0653acb6f5a5d5e0?method=PATCH", auth=RequestsAuthPluginVeracodeHMAC(), headers=headers, json=payload)

except requests.RequestException as e:
    print(e)
    sys.exit(1)

if response.ok:
    print(response.status_code)
    sys.exit(0)
else:
    print(response.status_code)
    print(response.text)
    sys.exit(1)
