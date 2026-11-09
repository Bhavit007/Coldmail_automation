-- Runs once, the first time Postgres starts with an empty database.

-- The fixed list of searches. Each row remembers where it stopped, so runs never repeat work.
CREATE TABLE search_queries (
  id          serial PRIMARY KEY,
  query       text    NOT NULL,            -- e.g. 'cafes in Mumbai'
  lng         double precision NOT NULL,   -- city centre, used to focus the search
  lat         double precision NOT NULL,
  next_token  text    NOT NULL DEFAULT '', -- where to continue (next page)
  done        boolean NOT NULL DEFAULT false,
  total_found int     NOT NULL DEFAULT 0,
  total_new   int     NOT NULL DEFAULT 0,
  last_run_at timestamptz
);

-- One row per business. dedupe_key (phone, or name+address) keeps duplicates out.
CREATE TABLE leads (
  id          serial PRIMARY KEY,
  dedupe_key  text NOT NULL UNIQUE,
  name        text,
  category    text,
  address     text,
  city        text,
  phone       text,
  website     text,
  email       text,
  source      text NOT NULL DEFAULT 'amazon_location',
  query_id    int REFERENCES search_queries(id),
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO search_queries (query, lng, lat) VALUES
  ('cafes in Mumbai',        72.8777, 19.0760),
  ('salons in Mumbai',       72.8777, 19.0760),
  ('gyms in Mumbai',         72.8777, 19.0760),
  ('boutiques in Mumbai',    72.8777, 19.0760),
  ('bakeries in Mumbai',     72.8777, 19.0760),
  ('cafes in Bengaluru',     77.5946, 12.9716),
  ('salons in Bengaluru',    77.5946, 12.9716),
  ('gyms in Bengaluru',      77.5946, 12.9716),
  ('boutiques in Bengaluru', 77.5946, 12.9716),
  ('bakeries in Bengaluru',  77.5946, 12.9716),
  ('cafes in Jaipur',        75.7873, 26.9124),
  ('salons in Jaipur',       75.7873, 26.9124),
  ('gyms in Jaipur',         75.7873, 26.9124),
  ('boutiques in Jaipur',    75.7873, 26.9124),
  ('bakeries in Jaipur',     75.7873, 26.9124);
