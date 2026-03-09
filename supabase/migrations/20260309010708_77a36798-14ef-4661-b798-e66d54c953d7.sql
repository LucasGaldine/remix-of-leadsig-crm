
-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  account_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on normalized address per account to prevent duplicates
CREATE UNIQUE INDEX idx_customers_unique_address 
ON public.customers (account_id, lower(trim(address))) 
WHERE address IS NOT NULL AND trim(address) != '';

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view customers in their account"
ON public.customers FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR account_id::text IN (
  SELECT a.id::text FROM public.customers a WHERE a.created_by = auth.uid() LIMIT 0
) OR created_by = auth.uid());

CREATE POLICY "Users can view own customers"
ON public.customers FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can insert customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own customers"
ON public.customers FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can delete own customers"
ON public.customers FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
