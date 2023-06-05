import sys
import requests
import json
import time
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
    counter = 0
    while counter < 20:
      counter = counter + 1
      time.sleep(30)
      statusResp = requests.get(api_base + "/analyses/b022cc5c5616b85d0653acb6f5a5d5e0/scans", auth=RequestsAuthPluginVeracodeHMAC(), headers=headers)

      data = statusResp.json()
      status = data['_embedded']['scans'][0]['latest_occurrence_status']['status_type']
      print("{} {}".format(count, status))
      if status == 'FINISHED_VERIFYING_RESULTS':
          print("Veracode Prescan Status Good")
          sys.exit(0)

    print("Veracode Prescan timeout")
    sys.exit(2)

else:
    print(response.status_code)
    print(response.text)
    sys.exit(1)
