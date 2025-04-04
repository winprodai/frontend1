-- Create user_settings table for 2FA and other user preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_method TEXT DEFAULT 'email',
  verification_attempts INTEGER DEFAULT 0,
  last_verification_attempt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_settings_user_id_key UNIQUE (user_id)
);

-- Add comment to the table
COMMENT ON TABLE public.user_settings IS 'Stores user settings including two-factor authentication preferences';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Set up RLS (Row Level Security)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for access control
CREATE POLICY "Users can view their own settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create a function to automatically create user settings when a new user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create a separate table for verification codes
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'two_factor', 'password_reset', etc.
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  CONSTRAINT verification_codes_user_id_purpose_key UNIQUE (user_id, purpose)
);

-- Add comment to the table
COMMENT ON TABLE public.verification_codes IS 'Stores temporary verification codes for 2FA and other purposes';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON public.verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON public.verification_codes(expires_at);

-- Set up RLS (Row Level Security)
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for access control
CREATE POLICY "Users can view their own verification codes"
  ON public.verification_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create a function to clean up expired verification codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.verification_codes
  WHERE expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to periodically clean up expired codes
CREATE TRIGGER cleanup_expired_codes
  AFTER INSERT ON public.verification_codes
  EXECUTE FUNCTION public.cleanup_expired_verification_codes();

