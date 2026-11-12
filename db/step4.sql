-- Lead sources: each search names the plug-in branch that runs it. Safe to run more than once.
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'amazon_text';

-- The US word searches give ~10 places each; the nearby grid and Google Maps cover the same ground better.
UPDATE search_queries SET done = true WHERE source = 'amazon_text' AND lng < -60 AND NOT done;

-- New searches, interleaved so consecutive runs try every source:
--   amazon_nearby: a 3x3 grid of points (~4.5 km apart) over each city, all trade categories at once
--   google_maps / claude_search: niche + city
WITH cities(c_ord, city, lng, lat) AS (VALUES
  (1, 'Plano, TX',    -96.6989, 33.0198),
  (2, 'McKinney, TX', -96.6397, 33.1972),
  (3, 'Chandler, AZ', -111.8413, 33.3062),
  (4, 'Gilbert, AZ',  -111.7890, 33.3528),
  (5, 'Lakeland, FL', -81.9498, 28.0395),
  (6, 'Cary, NC',     -78.7811, 35.7915)
),
niches(k, niche) AS (VALUES
  (1, 'roofing contractors'), (2, 'HVAC contractors'), (3, 'plumbers'), (4, 'landscaping companies'),
  (5, 'pest control'), (6, 'garage door repair'), (7, 'tree service'), (8, 'pressure washing')
),
grid(k, dx, dy) AS (
  SELECT row_number() OVER (ORDER BY y, x), x, y FROM generate_series(-1, 1) x, generate_series(-1, 1) y
),
wanted(c_ord, k, s_ord, query, lng, lat, source) AS (
  SELECT c.c_ord, g.k, 1, 'trade businesses near ' || c.city || ' (grid ' || g.k || '/9)',
         round((c.lng + g.dx * 0.05)::numeric, 4), round((c.lat + g.dy * 0.04)::numeric, 4), 'amazon_nearby'
  FROM cities c CROSS JOIN grid g
  UNION ALL
  SELECT c.c_ord, n.k, 2, n.niche || ' in ' || c.city, c.lng, c.lat, 'google_maps' FROM cities c CROSS JOIN niches n
  UNION ALL
  SELECT c.c_ord, n.k, 3, n.niche || ' in ' || c.city, c.lng, c.lat, 'claude_search' FROM cities c CROSS JOIN niches n
)
INSERT INTO search_queries (query, lng, lat, source)
SELECT w.query, w.lng, w.lat, w.source FROM wanted w
WHERE NOT EXISTS (SELECT 1 FROM search_queries q WHERE q.query = w.query AND q.source = w.source)
ORDER BY w.c_ord, w.k, w.s_ord;

SELECT source, count(*) FILTER (WHERE NOT done) AS waiting FROM search_queries GROUP BY source ORDER BY source;
