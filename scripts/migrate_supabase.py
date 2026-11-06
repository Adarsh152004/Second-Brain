"""Run production schema migration on Supabase PostgreSQL."""
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg2
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


def run_migration():
    db_url = settings.database_url
    if not db_url or "[YOUR-PASSWORD]" in db_url:
        if settings.postgres_password:
            db_url = f"postgresql://{settings.postgres_user}:{settings.postgres_password}@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
        else:
            print("ERROR: Please set your database password in .env (either in DATABASE_URL or POSTGRES_PASSWORD).")
            print("Example:")
            print(f"DATABASE_URL=postgresql://postgres:your_secret_password@{settings.postgres_host}:5432/postgres")
            sys.exit(1)

    migration_file = Path("supabase/migrations/20261105000000_production_schema.sql")
    if not migration_file.exists():
        print(f"ERROR: Migration file {migration_file} not found.")
        sys.exit(1)

    print(f"Connecting to Supabase at {settings.postgres_host}...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
        conn.autocommit = True
        with conn.cursor() as cur:
            sql = migration_file.read_text(encoding="utf-8")
            print("Executing migration script...")
            cur.execute(sql)
            print("Migration successfully applied!")

            # Verify tables
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)
            tables = [row[0] for row in cur.fetchall()]
            print("Active public tables in Supabase:", tables)
        conn.close()
    except Exception as e:
        print(f"Failed to connect or migrate: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_migration()
