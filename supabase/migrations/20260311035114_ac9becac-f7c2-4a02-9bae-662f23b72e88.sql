
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses integer DEFAULT NULL,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vouchers readable by authenticated" ON public.vouchers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Founders can manage vouchers" ON public.vouchers
  FOR ALL TO public USING (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Admins can manage vouchers" ON public.vouchers
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Add voucher columns to ic_orders
ALTER TABLE public.ic_orders 
  ADD COLUMN voucher_code text DEFAULT NULL,
  ADD COLUMN discount_amount numeric DEFAULT 0,
  ADD COLUMN final_price numeric DEFAULT NULL;
