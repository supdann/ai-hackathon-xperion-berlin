-- Run this SQL on Railway PostgreSQL to enable pgvector extension
-- This must be run BEFORE running the migrations

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
