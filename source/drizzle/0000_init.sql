-- Dev Inventory — migration 0000 (design.md §6.2, §6.4)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TYPE visibility_setting AS ENUM ('inherit','private','workspace_view','workspace_edit');
CREATE TYPE visibility_effective AS ENUM ('private','workspace_view','workspace_edit');
CREATE TYPE item_type AS ENUM ('note','snippet','script','file','link');
CREATE TYPE workspace_role AS ENUM ('admin','member');

CREATE TABLE workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  default_visibility visibility_effective NOT NULL DEFAULT 'workspace_view',
  login_methods text[] NOT NULL DEFAULT '{password}',
  allowed_email_domains text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(login_methods) >= 1)
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id),
  email citext UNIQUE NOT NULL,
  display_name text NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  is_super_admin boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invites (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  email citext NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invites_pending_email ON invites (email) WHERE used_at IS NULL;

CREATE TABLE collections (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  parent_id uuid REFERENCES collections(id),
  depth smallint NOT NULL CHECK (depth BETWEEN 1 AND 3),
  name text NOT NULL,
  description text,
  icon text,
  owner_id uuid NOT NULL REFERENCES users(id),
  visibility visibility_setting NOT NULL,
  effective_visibility visibility_effective NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NOT NULL OR visibility <> 'inherit')
);

CREATE TABLE items (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  collection_id uuid REFERENCES collections(id),
  type item_type NOT NULL,
  title text NOT NULL,
  summary text,
  body text,
  url text,
  script_meta jsonb,
  owner_id uuid NOT NULL REFERENCES users(id),
  visibility visibility_setting NOT NULL DEFAULT 'inherit',
  effective_visibility visibility_effective NOT NULL,
  version int NOT NULL DEFAULT 1,
  search_text text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES users(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (collection_id IS NOT NULL OR visibility <> 'inherit')
);

CREATE TABLE item_code_blocks (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  filename text,
  language text NOT NULL,
  content text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attachments (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  item_id uuid NOT NULL REFERENCES items(id),
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes <= 52428800),
  sha256 text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE TABLE item_tags (
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE item_versions (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  edited_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version)
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- audit_logs เป็น append-only (design.md §11): ห้าม UPDATE / DELETE / TRUNCATE แม้เป็นเจ้าของตาราง
CREATE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();

-- index หลัก (§6.4)
CREATE INDEX items_acl_idx     ON items (workspace_id, effective_visibility, owner_id) WHERE deleted_at IS NULL;
CREATE INDEX items_collection  ON items (collection_id) WHERE deleted_at IS NULL;
CREATE INDEX items_updated     ON items (workspace_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX items_search_trgm ON items USING gin (search_text gin_trgm_ops);
CREATE INDEX items_title_trgm  ON items USING gin (lower(title) gin_trgm_ops);
CREATE INDEX tags_slug_trgm    ON tags  USING gin (slug gin_trgm_ops);
CREATE INDEX audit_ws_time     ON audit_logs (workspace_id, created_at DESC);
CREATE INDEX collections_parent ON collections (workspace_id, parent_id) WHERE deleted_at IS NULL;
