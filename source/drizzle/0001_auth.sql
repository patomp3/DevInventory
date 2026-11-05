-- Better Auth tables (design.md §6.2, §19.3) + login throttling
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN image text;

CREATE TABLE session (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_user_id_idx ON session (user_id);

CREATE TABLE account (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,            -- 'credential' | 'google' (เฟส 2)
  password text,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX account_user_id_idx ON account (user_id);

CREATE TABLE verification (
  id uuid PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- จำกัด login 5 ครั้ง / 15 นาที ต่ออีเมล + IP (design.md §14)
CREATE TABLE login_attempts (
  id bigserial PRIMARY KEY,
  email citext NOT NULL,
  ip text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_lookup ON login_attempts (email, ip, attempted_at DESC);
