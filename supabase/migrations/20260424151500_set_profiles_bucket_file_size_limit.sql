/*
  # Set Profiles Storage Bucket File Size Limit

  Caps uploads to the shared profiles bucket at 5 MB. This matches the
  application-level limits used by company logos, profile photos, and website
  image uploads stored in this bucket.
*/

UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'profiles';
