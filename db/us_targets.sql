-- Switch lead finding from the India test cities to US home-service businesses.
-- Safe to run more than once.

-- 1. Stop the India searches (kept for history) and park their unprocessed leads.
UPDATE search_queries SET done = true WHERE lng BETWEEN 68 AND 98 AND NOT done;
UPDATE leads SET status = 'rejected', notes = 'Old India test lead'
WHERE status = 'pending' AND query_id IN (SELECT id FROM search_queries WHERE lng BETWEEN 68 AND 98);

-- 2. US searches: owner-run trades in growing Sun Belt suburbs.
INSERT INTO search_queries (query, lng, lat)
SELECT n.niche || ' in ' || c.city, c.lng, c.lat
FROM (VALUES
  (1, 'Plano, TX',    -96.6989, 33.0198),
  (2, 'McKinney, TX', -96.6397, 33.1972),
  (3, 'Chandler, AZ', -111.8413, 33.3062),
  (4, 'Gilbert, AZ',  -111.7890, 33.3528),
  (5, 'Lakeland, FL', -81.9498, 28.0395),
  (6, 'Cary, NC',     -78.7811, 35.7915)
) AS c(ord, city, lng, lat)
CROSS JOIN (VALUES
  (1, 'roofing contractors'), (2, 'HVAC contractors'), (3, 'plumbers'), (4, 'landscaping companies'),
  (5, 'pest control'), (6, 'garage door repair'), (7, 'tree service'), (8, 'pressure washing')
) AS n(ord, niche)
WHERE NOT EXISTS (SELECT 1 FROM search_queries q WHERE q.query = n.niche || ' in ' || c.city)
ORDER BY c.ord, n.ord;

SELECT count(*) FILTER (WHERE NOT done) AS us_searches_waiting,
       (SELECT count(*) FROM leads WHERE notes = 'Old India test lead') AS india_leads_parked
FROM search_queries;
