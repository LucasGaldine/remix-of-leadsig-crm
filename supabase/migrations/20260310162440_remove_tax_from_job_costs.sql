/*
  # Remove tax tracking from job costs

  1. Overview
    - Job costs should only show the actual costs to the business
    - Tax is a customer-facing concept that belongs on estimates/invoices
    - Remove tax tracking columns from leads table

  2. Changes
    - Drop tax_rate, tax, subtotal, total_with_tax columns from leads table
    - These fields are still maintained on estimates and invoices for customer pricing
*/

-- Remove tax tracking columns from leads table
ALTER TABLE leads 
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS tax,
  DROP COLUMN IF EXISTS subtotal,
  DROP COLUMN IF EXISTS total_with_tax;