PRAGMA foreign_keys = ON;
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  property_json TEXT NOT NULL CHECK(json_valid(property_json)),
  estimate_json TEXT NOT NULL CHECK(json_valid(estimate_json)),
  pricing_json TEXT NOT NULL CHECK(json_valid(pricing_json)),
  conditions_json TEXT NOT NULL CHECK(json_valid(conditions_json)),
  notes TEXT NOT NULL DEFAULT '',
  preferred_date TEXT NOT NULL DEFAULT '',
  time_window TEXT NOT NULL DEFAULT '',
  access_instructions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('new','needs_review','contacted','approved','scheduled','completed','declined','cancelled')),
  private_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX quotes_created ON quotes(created_at DESC);
CREATE INDEX quotes_status ON quotes(status, created_at DESC);
CREATE INDEX quotes_email ON quotes(customer_email);
CREATE TABLE cleaning_areas (
  id TEXT NOT NULL,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK(service IN ('driveway','sidewalk','patio')),
  geometry_json TEXT NOT NULL CHECK(json_valid(geometry_json)),
  square_feet REAL NOT NULL CHECK(square_feet > 0),
  billable_square_feet REAL NOT NULL CHECK(billable_square_feet >= 0),
  contribution_cents INTEGER NOT NULL CHECK(contribution_cents >= 0),
  PRIMARY KEY(quote_id, id)
);
CREATE INDEX areas_quote ON cleaning_areas(quote_id);
CREATE INDEX areas_service ON cleaning_areas(service, quote_id);
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX contacts_created ON contacts(created_at DESC);
CREATE TABLE email_records (
  id TEXT PRIMARY KEY,
  quote_id TEXT REFERENCES quotes(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('customer','business','contact')),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text_content TEXT NOT NULL,
  reply_to TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','preview')) DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_id TEXT,
  last_error TEXT,
  first_attempt_at TEXT,
  locked_until TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(quote_id, kind),
  UNIQUE(contact_id, kind),
  CHECK((quote_id IS NOT NULL AND contact_id IS NULL) OR (quote_id IS NULL AND contact_id IS NOT NULL))
);
CREATE INDEX email_quote ON email_records(quote_id);
CREATE INDEX email_status ON email_records(status, updated_at);
CREATE TABLE email_attempts (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL REFERENCES email_records(id) ON DELETE CASCADE,
  attempted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  safe_error TEXT
);
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(expires_at);
