"""Ensures data paths point at temp locations so the test suite never
touches a real knowledge base."""
import os
import tempfile

os.environ.setdefault("CHROMA_PATH", tempfile.mkdtemp(prefix="sb-chroma-"))
os.environ.setdefault("MEMORY_DB_PATH", tempfile.mktemp(suffix=".db"))
os.environ.setdefault("DOCUMENTS_PATH", tempfile.mkdtemp(prefix="sb-docs-"))
