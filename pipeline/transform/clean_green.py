import geopandas as gpd

INPUT_PATH = "data/raw/green_osm.geojson"
OUTPUT_PATH = "data/processed/green_clean.geojson"


def clean_data(gdf):
    # del invalid geometry
    gdf = gdf[gdf.geometry.notnull()]
    gdf = gdf[gdf.is_valid]

    # Keep only Polygon
    gdf = gdf[gdf.geometry.type.isin(["Polygon", "MultiPolygon"])]

    gdf["geometry"] = gdf["geometry"].buffer(0)

    gdf = gdf[["geometry"]]

    return gdf


def main():
    print("Loading raw data...")
    gdf = gpd.read_file(INPUT_PATH)

    print(f"Original count: {len(gdf)}")

    gdf_clean = clean_data(gdf)

    print(f"Cleaned count: {len(gdf_clean)}")

    gdf_clean.to_file(OUTPUT_PATH, driver="GeoJSON")
    print(f"Saved cleaned data to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()