import geopandas as gpd
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

# =========================
# LOAD ENV
# =========================

load_dotenv()

DB_USER = "rmohammadi"
DB_PASSWORD = "reza06450645" 
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "webgis_demo"

TABLE_NAME = "green_areas"
INPUT_PATH = "data/processed/green_clean.geojson"


# =========================

def get_engine():
    connection_string = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    return create_engine(connection_string)


def main():
    print("Loading data...")
    gdf = gpd.read_file(INPUT_PATH)

    print(f"Features: {len(gdf)}")

    print("Connecting to PostGIS...")
    engine = get_engine()

    print("Writing to database...")
    gdf.to_postgis(
        TABLE_NAME,
        engine,
        if_exists="replace",
        index=False
    )

    print(f"Data written to table: {TABLE_NAME}")


if __name__ == "__main__":
    main()