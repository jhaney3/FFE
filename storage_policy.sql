-- Storage Policies for Public Buckets

-- Allow public access to read files in inventory_photos bucket
CREATE POLICY "Public Read Access inventory_photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'inventory_photos');

-- Allow public access to upload files to inventory_photos bucket
CREATE POLICY "Public Insert Access inventory_photos"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'inventory_photos');

-- Allow public access to read files in floor_plans bucket
CREATE POLICY "Public Read Access floor_plans"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'floor_plans');

-- Allow public access to upload files to floor_plans bucket
CREATE POLICY "Public Insert Access floor_plans"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'floor_plans');
