import os
import geopandas as gpd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# =========================
# CONFIG
# =========================

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")

INPUT_PATH = "data/processed/osm_data.gpkg"

required = {
    "DB_USER": DB_USER,
    "DB_PASSWORD": DB_PASSWORD,
    "DB_HOST": DB_HOST,
    "DB_PORT": DB_PORT,
    "DB_NAME": DB_NAME,
}

missing = [k for k, v in required.items() if not v]
if missing:
    raise ValueError(f"Missing environment variables: {missing}")

# =========================
# DB CONNECTION
# =========================

db_url = URL.create(
    drivername="postgresql+psycopg2",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=int(DB_PORT),
    database=DB_NAME,
)

engine = create_engine(db_url)

# =========================
# CLEAN FUNCTION
# =========================

def clean_data(gdf, geom_types):
    print("Cleaning data...")

    gdf = gdf[gdf.geometry.notnull()].copy()
    gdf = gdf[gdf.geometry.geom_type.isin(geom_types)].copy()

    if any(gt in ["Polygon", "MultiPolygon"] for gt in geom_types):
        poly_mask = gdf.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
        if poly_mask.any():
            gdf.loc[poly_mask, "geometry"] = gdf.loc[poly_mask, "geometry"].buffer(0)

    gdf = gdf[gdf.is_valid].copy()
    gdf = gdf.drop_duplicates(subset="geometry")

    return gdf

def add_id_column(table_name):
    print(f"Adding id column to {table_name}...")

    with engine.begin() as conn:
        conn.execute(text(f"""
            ALTER TABLE {table_name}
            ADD COLUMN IF NOT EXISTS id SERIAL;
        """))

        conn.execute(text(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conrelid = '{table_name}'::regclass
                      AND contype = 'p'
                ) THEN
                    ALTER TABLE {table_name} ADD PRIMARY KEY (id);
                END IF;
            END
            $$;
        """))

    print(f"id added to {table_name}")


# =========================
# IMPORT FUNCTION
# =========================

def import_layer(layer_name, table_name, geom_types):
    print(f"\n--- Processing {layer_name} ---")

    gdf = gpd.read_file(INPUT_PATH, layer=layer_name)

    print(f"Original count: {len(gdf)}")

    gdf = clean_data(gdf, geom_types)

    print(f"Cleaned count: {len(gdf)}")

    gdf.to_postgis(
        name=table_name,
        con=engine,
        if_exists="replace",
        index=False,
        chunksize=5000,
    )
    add_id_column(table_name)
    print(f"Inserted into {table_name}")

# =========================
# CREATE INDEX
# =========================

def create_index():
    print("\nCreating spatial indexes...")

    with engine.connect() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_green_geom ON green USING GIST (geometry);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST (geometry);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_transport_geom ON transport USING GIST (geometry);"))
        conn.commit()

    print("Indexes created.")

# =========================
# MAIN
# =========================

def main():
    import_layer(
        layer_name="green_areas",
        table_name="green",
        geom_types=["Polygon", "MultiPolygon"],
    )

    import_layer(
        layer_name="buildings",
        table_name="buildings",
        geom_types=["Polygon", "MultiPolygon"],
    )

    import_layer(
        layer_name="transport",
        table_name="transport",
        geom_types=["Point"],
    )

    create_index()

    print("\nDONE - Everything is ready in PostGIS")

if __name__ == "__main__":
    main()
