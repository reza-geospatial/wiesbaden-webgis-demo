import requests
import geopandas as gpd

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"

QUERY = """
[out:json][timeout:60];
(
  way["leisure"="park"](50.05,8.2,50.15,8.35);
  way["landuse"="forest"](50.05,8.2,50.15,8.35);
  way["landuse"="grass"](50.05,8.2,50.15,8.35);
);
out geom;
"""


def fetch_osm_data():
    for attempt in range(3):
        try:
            print(f"Request attempt {attempt + 1}...")

            response = requests.get(
                OVERPASS_URL,
                params={"data": QUERY},
                timeout=120
            )

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"Attempt {attempt + 1} failed: {e}")

    raise Exception("Failed to fetch OSM data")

def to_geodataframe(data):
    features = []

    for el in data["elements"]:
        if "geometry" not in el:
            continue

        coords = [(p["lon"], p["lat"]) for p in el["geometry"]]

        geom = {
            "type": "Polygon",
            "coordinates": [coords]
        }

        features.append({
            "geometry": geom,
            "properties": el.get("tags", {})
        })

    gdf = gpd.GeoDataFrame.from_features(features, crs="EPSG:4326")
    return gdf


def save_data(gdf):
    output_path = "data/raw/green_osm.geojson"
    gdf.to_file(output_path, driver="GeoJSON")
    print(f"Saved {len(gdf)} features to {output_path}")


def main():
    print("Fetching OSM data...")
    data = fetch_osm_data()

    print("Converting to GeoDataFrame...")
    gdf = to_geodataframe(data)

    print("Saving data...")
    save_data(gdf)


if __name__ == "__main__":
    main()