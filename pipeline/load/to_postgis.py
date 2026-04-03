import geopandas as gpd
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# =========================
# LOAD ENV
# =========================

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

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
    with engine.connect() as conn:
        conn.execute(text(f"""
            ALTER TABLE {TABLE_NAME}
            ADD COLUMN id SERIAL PRIMARY KEY;
        """))

    print(f"Data written to table: {TABLE_NAME}")


if __name__ == "__main__":
    main()