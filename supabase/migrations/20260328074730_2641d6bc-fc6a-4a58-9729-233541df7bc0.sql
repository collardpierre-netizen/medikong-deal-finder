CREATE TABLE public.invest_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  amount INTEGER NOT NULL,
  shares INTEGER NOT NULL,
  country TEXT NOT NULL DEFAULT 'BE',
  tax_reduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT,
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  national_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE public.invest_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invest subscriptions" ON public.invest_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can insert their own subscriptions" ON public.invest_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anonymous can insert subscriptions" ON public.invest_subscriptions
  FOR INSERT TO anon
  WITH CHECK (true);