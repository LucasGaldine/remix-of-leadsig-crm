/*
  # Add Profile Settings Columns

  ## Overview
  Adds timezone and notification preferences columns to the profiles table to support comprehensive profile management.

  ## Changes Made
  
  ### 1. New Columns
  - `timezone` (text) - User's preferred timezone (e.g., 'America/New_York')
  - `notification_preferences` (jsonb) - Stores notification settings as JSON
    - Structure: { "email": boolean, "sms": boolean, "push": boolean, "newLeads": boolean, "jobUpdates": boolean }
  
  ### 2. Notes
  - Both columns are nullable to support existing users
  - Default notification preferences favor all notifications enabled
  - Common timezones include: America/New_York, America/Chicago, America/Denver, America/Los_Angeles, etc.
*/

-- Add timezone column
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';

-- Add notification preferences column
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email": true, "sms": true, "push": true, "newLeads": true, "jobUpdates": true}'::jsonb;
