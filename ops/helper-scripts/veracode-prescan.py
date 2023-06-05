import sys
import requests
import json
from veracode_api_signing.plugin_requests import RequestsAuthPluginVeracodeHMAC

api_base = "https://api.veracode.us/was/configservice/v1"
headers = {"User-Agent": "USTP Script", "Content-Type":"application/json"}

try:
    payload = json.loads('{"name":"CAMS Flexion"}')

    response = requests.put(api_base + "/analyses/b022cc5c5616b85d0653acb6f5a5d5e0?method=PATCH&run_verification=true", auth=RequestsAuthPluginVeracodeHMAC(), headers=headers, json=payload)

except requests.RequestException as e:
    print(e)
    sys.exit(1)

if response.ok:
    print(response.status_code)
else:
    print(response.status_code)
    print(response.text)
