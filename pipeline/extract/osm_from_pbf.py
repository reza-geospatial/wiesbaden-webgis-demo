import pyogrio
import geopandas as gpd
import pandas as pd
from pathlib import Path

# CONFIG

PBF_FILES = {
    "hessen": "data/pbf/hessen.pbf",
    "rlp": "data/pbf/rlp.pbf",
}

OUTPUT_PATH = "data/processed/osm_data.gpkg"

Path("data/processed").mkdir(parents=True, exist_ok=True)

# =========================
# HELPERS
# =========================

def filter_geometry(gdf, allowed_types):
    if gdf is None or len(gdf) == 0:
        return gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")

    gdf = gdf[gdf.geometry.notnull()].copy()
    gdf = gdf[gdf.geometry.geom_type.isin(allowed_types)].copy()
    return gdf


def clean_gdf(gdf):
    if len(gdf) == 0:
        return gdf

    gdf = gdf[gdf.geometry.notnull()].copy()

    poly_mask = gdf.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
    if poly_mask.any():
        gdf.loc[poly_mask, "geometry"] = gdf.loc[poly_mask, "geometry"].buffer(0)

    gdf = gdf[gdf.is_valid].copy()
    return gdf


def safe_read(pbf_path, layer, where=None):
    try:
        return pyogrio.read_dataframe(
            pbf_path,
            layer=layer,
            where=where
        )
    except Exception as e:
        print(f"⚠️ Failed: {layer} | {where}")
        print(e)
        return gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")

def ensure_columns(gdf, columns):
    gdf = gdf.copy()
    for col in columns:
        if col not in gdf.columns:
            gdf[col] = pd.NA
    return gdf


# EXTRACTION

def extract_layers(pbf_path, region_name):
    print(f"\nProcessing {region_name}...")

    buildings = safe_read(
        pbf_path,
        layer="multipolygons",
        where="building IS NOT NULL"
    )

    green = safe_read(
        pbf_path,
        layer="multipolygons",
        where="landuse IN ('forest','grass') OR leisure = 'park'"
    )

    transport = safe_read(
        pbf_path,
        layer="points",
        where=None
    )

    # GEOMETRY FILTER

    buildings = filter_geometry(buildings, ["Polygon", "MultiPolygon"])
    green = filter_geometry(green, ["Polygon", "MultiPolygon"])
    transport = filter_geometry(transport, ["Point"])

    # ENSURE EXPECTED COLUMNS

    buildings = ensure_columns(buildings, ["building"])
    green = ensure_columns(green, ["landuse", "leisure"])
    transport = ensure_columns(transport, ["highway", "railway", "public_transport"])

    # FILTER TRANSPORT IN PANDAS

    if len(transport) > 0:
        transport = transport[
            transport["highway"].eq("bus_stop")
            | transport["railway"].eq("station")
            | transport["public_transport"].eq("station")
        ].copy()

    # REDUCE COLUMNS

    buildings = buildings.reindex(columns=["geometry", "building"]).copy()
    green = green.reindex(columns=["geometry", "landuse", "leisure"]).copy()
    transport = transport.reindex(columns=["geometry", "highway", "railway", "public_transport"]).copy()

    print(f"{region_name}: green={len(green)}, buildings={len(buildings)}, transport={len(transport)}")

    return green, buildings, transport


# =========================
# MAIN PIPELINE
# =========================

def main():
    all_green = []
    all_buildings = []
    all_transport = []

    for region, path in PBF_FILES.items():
        print(f"Loading {path}...")

        green, buildings, transport = extract_layers(path, region)

        all_green.append(green)
        all_buildings.append(buildings)
        all_transport.append(transport)

    print("\nMerging datasets...")

    gdf_green = gpd.GeoDataFrame(pd.concat(all_green, ignore_index=True), crs="EPSG:4326")
    gdf_buildings = gpd.GeoDataFrame(pd.concat(all_buildings, ignore_index=True), crs="EPSG:4326")
    gdf_transport = gpd.GeoDataFrame(pd.concat(all_transport, ignore_index=True), crs="EPSG:4326")

    print("Cleaning geometries...")

    gdf_green = clean_gdf(gdf_green)
    gdf_buildings = clean_gdf(gdf_buildings)
    gdf_transport = clean_gdf(gdf_transport)

    print("Removing duplicates...")

    gdf_green = gdf_green.drop_duplicates(subset="geometry")
    gdf_buildings = gdf_buildings.drop_duplicates(subset="geometry")
    gdf_transport = gdf_transport.drop_duplicates(subset="geometry")

    print("\nSaving to GPKG...")

    gdf_green.to_file(OUTPUT_PATH, layer="green_areas", driver="GPKG")
    gdf_buildings.to_file(OUTPUT_PATH, layer="buildings", driver="GPKG")
    gdf_transport.to_file(OUTPUT_PATH, layer="transport", driver="GPKG")

    print("\nDONE - Data ready for PostGIS")


if __name__ == "__main__":
    main()
