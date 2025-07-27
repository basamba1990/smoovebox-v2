DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'buckets' 
        AND table_schema = 'storage'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE storage.buckets ADD COLUMN type TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'buckets_analytics' 
        AND table_schema = 'storage'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE storage.buckets_analytics ADD COLUMN type TEXT;
    END IF;
END $$;
