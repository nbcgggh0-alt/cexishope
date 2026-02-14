-- Add currency column to cexi_users table if it doesn't exist
ALTER TABLE public.cexi_users 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MYR';

-- Update existing users to have a default currency
UPDATE public.cexi_users 
SET currency = 'MYR' 
WHERE currency IS NULL;
