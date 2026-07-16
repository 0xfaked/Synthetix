import urllib.request
import json
import re

url = "https://www.postman.com/api-evangelist/precious-metals/documentation/en7iqh2/realtime-forex-tick-data-currency-conversion-api"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    # find embedded json state or anything looking like an api key
    match = re.search(r'window\.__INITIAL_STATE__=(.*?);</script>', html)
    if match:
        data = match.group(1)
        print("Found initial state json")
        # search for 'api_key' in json
        for match in re.finditer(r'.{0,50}api_key.{0,50}', data, re.IGNORECASE):
            print(match.group(0))
        for match in re.finditer(r'.{0,50}apikey.{0,50}', data, re.IGNORECASE):
            print(match.group(0))
        for match in re.finditer(r'https?://[^\s\"\'\\]+', data):
            if '1forge' in match.group(0) or 'convert' in match.group(0) or 'quote' in match.group(0):
                print(match.group(0))
    else:
        print("No initial state found")
        for match in re.finditer(r'.{0,50}api_key.{0,50}', html, re.IGNORECASE):
            print(match.group(0))
except Exception as e:
    print(e)
