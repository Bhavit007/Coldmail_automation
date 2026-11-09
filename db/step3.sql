-- Step 3: log of every outreach message, and when a lead was sent. Safe to run more than once.
CREATE TABLE IF NOT EXISTS outreach (
  id          serial PRIMARY KEY,
  lead_id     int NOT NULL REFERENCES leads(id),
  channel     text NOT NULL,              -- email / instagram / facebook
  status      text NOT NULL,              -- sent / failed / queued (manual DM) / done
  to_address  text,                       -- email address or profile link
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  done_at     timestamptz
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_at timestamptz;
