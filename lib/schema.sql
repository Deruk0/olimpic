CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'teacher')),
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  theme_palette text NOT NULL DEFAULT 'purple' CHECK (theme_palette IN ('purple', 'blue', 'turquoise')),
  UNIQUE (id, role)
);

CREATE TABLE IF NOT EXISTS teacher_profiles (
  teacher_id text PRIMARY KEY,
  role text NOT NULL DEFAULT 'teacher' CHECK (role = 'teacher'),
  subject text NOT NULL,
  FOREIGN KEY (teacher_id, role) REFERENCES accounts(id, role) ON DELETE CASCADE
);
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS subjects text[] NOT NULL DEFAULT '{}';
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS hourly_rate integer CHECK (hourly_rate BETWEEN 1 AND 1000000);

CREATE TABLE IF NOT EXISTS teacher_slots (
  id text PRIMARY KEY,
  teacher_id text NOT NULL REFERENCES teacher_profiles ON DELETE CASCADE,
  starts timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (teacher_id, starts)
);

CREATE TABLE IF NOT EXISTS booking_requests (
  id text PRIMARY KEY,
  slot_id text NOT NULL REFERENCES teacher_slots,
  student_id text NOT NULL,
  student_role text NOT NULL DEFAULT 'student' CHECK (student_role = 'student'),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, student_id),
  FOREIGN KEY (student_id, student_role) REFERENCES accounts(id, role)
);
CREATE UNIQUE INDEX IF NOT EXISTS booking_requests_confirmed_slot ON booking_requests (slot_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS booking_requests_student ON booking_requests (student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_students (
  teacher_id text REFERENCES teacher_profiles ON DELETE CASCADE,
  student_id text,
  student_role text NOT NULL DEFAULT 'student' CHECK (student_role = 'student'),
  PRIMARY KEY (teacher_id, student_id),
  FOREIGN KEY (student_id, student_role) REFERENCES accounts(id, role) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS teacher_students_student_id ON teacher_students (student_id);

CREATE TABLE IF NOT EXISTS account_avatars (
  account text PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,
  version text NOT NULL,
  bytes bytea NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  hash text PRIMARY KEY,
  account text NOT NULL REFERENCES accounts,
  teacher_id text REFERENCES teacher_profiles,
  expires timestamptz NOT NULL,
  used timestamptz,
  reusable boolean NOT NULL DEFAULT false,
  CHECK (teacher_id IS NULL OR NOT reusable)
);
CREATE TABLE IF NOT EXISTS sessions (
  hash text PRIMARY KEY,
  account text NOT NULL REFERENCES accounts,
  expires timestamptz NOT NULL,
  demo boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS assignments (
  id text PRIMARY KEY,
  teacher_id text NOT NULL REFERENCES teacher_profiles,
  student_id text NOT NULL,
  student_role text NOT NULL DEFAULT 'student' CHECK (student_role = 'student'),
  content jsonb NOT NULL,
  starts timestamptz NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1,
  UNIQUE (id, student_id),
  FOREIGN KEY (student_id, student_role) REFERENCES accounts(id, role)
);
CREATE INDEX IF NOT EXISTS assignments_student_starts ON assignments (student_id, starts);
CREATE INDEX IF NOT EXISTS assignments_teacher_starts ON assignments (teacher_id, starts);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id text REFERENCES assignments(id);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS entry_kind text NOT NULL DEFAULT 'lesson'
  CHECK ((entry_kind = 'lesson' AND due_at IS NULL AND lesson_id IS NULL) OR
         (entry_kind = 'homework' AND due_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS assignments_lesson_id ON assignments (lesson_id);

CREATE TABLE IF NOT EXISTS room_participants (
  lesson_id text REFERENCES assignments ON DELETE CASCADE,
  account_id text REFERENCES accounts ON DELETE CASCADE,
  token text NOT NULL,
  seen_at timestamptz,
  media integer NOT NULL DEFAULT 0,
  focused boolean,
  focus_seq integer NOT NULL DEFAULT 0,
  distraction_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (lesson_id, account_id)
);

CREATE TABLE IF NOT EXISTS room_signals (
  seq integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id text NOT NULL UNIQUE,
  lesson_id text NOT NULL REFERENCES assignments ON DELETE CASCADE,
  sender_token text NOT NULL,
  target_token text NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS room_signals_inbox ON room_signals (lesson_id, target_token, seq);

CREATE TABLE IF NOT EXISTS room_messages (
  seq integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id text NOT NULL UNIQUE,
  lesson_id text NOT NULL REFERENCES assignments ON DELETE CASCADE,
  sender_id text NOT NULL REFERENCES accounts,
  body text NOT NULL DEFAULT '',
  image bytea,
  mime text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((image IS NULL) = (mime IS NULL)),
  CHECK (body <> '' OR image IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS room_messages_inbox ON room_messages (lesson_id, seq);

CREATE TABLE IF NOT EXISTS submissions (
  assignment text,
  student text,
  files jsonb NOT NULL DEFAULT '[]',
  answers jsonb NOT NULL DEFAULT '{}',
  grades jsonb,
  submitted timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment, student),
  FOREIGN KEY (assignment, student) REFERENCES assignments(id, student_id)
);
CREATE TABLE IF NOT EXISTS attachments (
  id text PRIMARY KEY,
  student text NOT NULL,
  assignment text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  bytes bytea NOT NULL,
  FOREIGN KEY (assignment, student) REFERENCES submissions(assignment, student)
);
CREATE TABLE IF NOT EXISTS telegram_links (
  student_id text PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,
  id text NOT NULL UNIQUE,
  chat_id text NOT NULL UNIQUE,
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  student_id text PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,
  hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_jobs (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES accounts ON DELETE CASCADE,
  link_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('lesson', 'deadline', 'review', 'test')),
  assignment_id text REFERENCES assignments ON DELETE CASCADE,
  event_at timestamptz,
  body text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'skipped', 'failed')),
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_jobs_ready ON telegram_jobs (available_at, created_at) WHERE status='queued';
CREATE INDEX IF NOT EXISTS telegram_jobs_student_test ON telegram_jobs (student_id, created_at DESC) WHERE kind='test';

CREATE TABLE IF NOT EXISTS library_items (
  id text PRIMARY KEY,
  teacher_id text NOT NULL REFERENCES teacher_profiles,
  kind text NOT NULL CHECK (kind IN ('theory', 'task', 'work')),
  title text NOT NULL,
  ready boolean NOT NULL,
  data jsonb NOT NULL,
  updated timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_items_teacher_kind ON library_items (teacher_id, kind);
CREATE TABLE IF NOT EXISTS material_files (
  id text PRIMARY KEY,
  teacher_id text NOT NULL REFERENCES teacher_profiles,
  filename text NOT NULL,
  bytes bytea NOT NULL
);
