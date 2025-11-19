#!/usr/bin/env python3
import urllib.request
import json
import csv
import glob

def get_api_result(url: str) -> dict:
    try:
        with urllib.request.urlopen(url) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
        raise RuntimeError(f"Failed run DataCite query: {e}")

def clients() -> list:
    params = urllib.parse.urlencode({
        'page[size]': 1000
    })
    clients_url = f"https://api.datacite.org/clients?{params}"

    result = {}

    while True:
        response = get_api_result(clients_url)
        for client in response["data"]:
            result[client["id"]] = client
        print(f"Clients retrieved {len(result)} of {response['meta']['total']}")
        
        if response['links'].get('next'):
            clients_url = response['links']['next']
        else:
            break

    return result

def add_client_info_to_csv(csv_file: str, clients: dict):
    
    with open(csv_file, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    for row in rows:
        client_id = row.get("dataCiteClientId")

        if client_id:
            client = clients.get(client_id)
            row["dataCiteClientName"] = client["attributes"]["name"] if client else "Unknown"
            row["dataCiteClientType"] = client["attributes"]["clientType"] if client else "Unknown"

    with open(csv_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

if __name__ == "__main__":
    client_list = clients()
    print(f"Total clients retrieved: {len(client_list)}")

    for csv_file in glob.glob("outputs/*.csv"):
        add_client_info_to_csv(csv_file, client_list)
        print(f"Add client info to: {csv_file}")
