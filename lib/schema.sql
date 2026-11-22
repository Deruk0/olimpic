CREATE TABLE IF NOT EXISTS accounts(id text PRIMARY KEY, name text NOT NULL, role text NOT NULL CHECK(role IN ('student','curator','methodist')), goal text NOT NULL DEFAULT '');
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light' CHECK(theme IN ('light','dark'));
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS theme_palette text NOT NULL DEFAULT 'purple' CHECK(theme_palette IN ('purple','blue','turquoise'));
UPDATE accounts SET theme='light', theme_palette='blue' WHERE theme='blue';
CREATE TABLE IF NOT EXISTS student_avatars(account text PRIMARY KEY REFERENCES accounts ON DELETE CASCADE, version text NOT NULL, bytes bytea NOT NULL);
CREATE TABLE IF NOT EXISTS student_goal_profiles(
  student text PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,
  details jsonb NOT NULL,
  image bytea,
  image_version text,
  CHECK ((image IS NULL) = (image_version IS NULL))
);
CREATE TABLE IF NOT EXISTS invites(hash text PRIMARY KEY, account text NOT NULL REFERENCES accounts, expires timestamptz NOT NULL, used timestamptz);
CREATE TABLE IF NOT EXISTS sessions(hash text PRIMARY KEY, account text NOT NULL REFERENCES accounts, expires timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS groups(id text PRIMARY KEY, name text NOT NULL, curator text NOT NULL REFERENCES accounts);
CREATE TABLE IF NOT EXISTS members(student text PRIMARY KEY REFERENCES accounts, group_id text NOT NULL REFERENCES groups);
CREATE TABLE IF NOT EXISTS programs(level text PRIMARY KEY CHECK(level IN ('basic','advanced','diagnostic')), draft jsonb NOT NULL, published jsonb);
CREATE TABLE IF NOT EXISTS assignments(id text PRIMARY KEY, group_id text NOT NULL REFERENCES groups, kind text NOT NULL CHECK(kind IN ('diagnostic','lesson')), level text NOT NULL, content jsonb NOT NULL, starts timestamptz NOT NULL, meeting text NOT NULL);
CREATE TABLE IF NOT EXISTS submissions(assignment text REFERENCES assignments, student text REFERENCES accounts, files jsonb NOT NULL, grades jsonb, submitted timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(assignment,student));
CREATE TABLE IF NOT EXISTS attachments(id text PRIMARY KEY, student text NOT NULL, assignment text NOT NULL, filename text NOT NULL, mime text NOT NULL, bytes bytea NOT NULL, FOREIGN KEY(assignment,student) REFERENCES submissions(assignment,student));
CREATE TABLE IF NOT EXISTS trajectories(student text PRIMARY KEY REFERENCES accounts, level text NOT NULL, topics jsonb NOT NULL, published timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS guidance(group_id text REFERENCES groups, id text PRIMARY KEY, message text NOT NULL, created timestamptz NOT NULL DEFAULT now());
ALTER TABLE invites ADD COLUMN IF NOT EXISTS reusable boolean NOT NULL DEFAULT false;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS attendance(assignment text REFERENCES assignments, student text REFERENCES accounts, PRIMARY KEY(assignment,student));
CREATE TABLE IF NOT EXISTS library_items(id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('theory','task','work')), title text NOT NULL, ready boolean NOT NULL, data jsonb NOT NULL, updated timestamptz NOT NULL DEFAULT now());
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS sources jsonb;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS material_files(id text PRIMARY KEY, filename text NOT NULL, bytes bytea NOT NULL);

CREATE TABLE IF NOT EXISTS school_inquiries (
  id text PRIMARY KEY,
  submission_key text NOT NULL UNIQUE,
  name text NOT NULL,
  school_grade text CHECK (school_grade IN ('8', '9', 'other')),
  phone text,
  email text,
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  contacted_at timestamptz,
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS school_inquiries_order ON school_inquiries (created_at DESC, id DESC);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;
ALTER TABLE assignments ALTER COLUMN starts DROP NOT NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
