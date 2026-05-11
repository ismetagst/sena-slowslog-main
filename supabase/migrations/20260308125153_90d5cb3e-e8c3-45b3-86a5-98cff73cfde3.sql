
-- Create IC order status enum
CREATE TYPE public.ic_order_status AS ENUM ('pending', 'approved', 'rejected');

-- Create IC orders table
CREATE TABLE public.ic_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('yearly', 'forever')),
  transfer_proof_url TEXT,
  status ic_order_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ic_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON public.ic_orders
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own orders
CREATE POLICY "Users can insert own orders" ON public.ic_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Founders can view all orders
CREATE POLICY "Founders can view all orders" ON public.ic_orders
  FOR SELECT USING (public.has_role(auth.uid(), 'founder'));

-- Founders can update orders (approve/reject)
CREATE POLICY "Founders can update orders" ON public.ic_orders
  FOR UPDATE USING (public.has_role(auth.uid(), 'founder'));

-- Storage bucket for transfer proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('transfer-proofs', 'transfer-proofs', true);

-- Storage RLS: users can upload their own proofs
CREATE POLICY "Users can upload transfer proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'transfer-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage RLS: anyone can view transfer proofs
CREATE POLICY "Transfer proofs are viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'transfer-proofs');
