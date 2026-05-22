UPDATE photos
SET r2_key = (
  SELECT g.tenant_id || '/' || photos.r2_key
  FROM galleries g
  WHERE g.id = photos.gallery_id
)
WHERE r2_key LIKE 'galleries/%'
  AND EXISTS (
    SELECT 1
    FROM galleries g
    WHERE g.id = photos.gallery_id
      AND g.tenant_id IS NOT NULL
  );
