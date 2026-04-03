import requests
from pathlib import Path

urls = {
    "hessen": "https://download.geofabrik.de/europe/germany/hessen-latest.osm.pbf",
    "rlp": "https://download.geofabrik.de/europe/germany/rheinland-pfalz-latest.osm.pbf"
}

Path("data/pbf").mkdir(parents=True, exist_ok=True)

for name, url in urls.items():
    print(f"Downloading {name}...")
    response = requests.get(url, stream=True)

    with open(f"data/pbf/{name}.pbf", "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

print("Download complete ✔")