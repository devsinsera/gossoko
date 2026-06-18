-- Gossoko — seed data (venues)
-- 15 Brisbane tradie venues. Idempotent via slug uniqueness.

SET search_path TO gossoko, public, extensions, auth;

INSERT INTO venues (
  slug, name, type, tagline, description, suburb, address, state, postcode,
  latitude, longitude, opens_at, closes_at, price_level, is_verified, trending,
  distance_km, rating, review_count, hero_color, hero_accent, tags, signature,
  moderation_status
) VALUES
  ('the-smoko-stop',     'The Smoko Stop',         'gossoko_van', 'Bowen Hills coffee van — chippies & sparkies welcome.',
   'Mobile coffee van parked on Abbotsford Rd opposite the BCC depot. Espresso runs from 4:30am, bacon-and-egg rolls by 5. Cash + tap accepted, big trailer apron for ute parking.',
   'Bowen Hills',    'Abbotsford Rd opp. depot',    'QLD', '4006', -27.4470, 153.0381, '04:30', '11:30', 2, true,  true,  1.2,  4.86, 184, '#1a1310', '#FF7A00', ARRAY['Espresso','B&E Roll','Tap Pay'],            'Double-shot flat white + B&E roll',         'approved'),

  ('crowbar-coffee',     'Crowbar Coffee',         'cafe',         'Newstead café in a converted forge — strong coffee, no nonsense.',
   'Industrial-fitout café with roller doors that open onto Doggett St. Beans from a Northgate roaster. Hot food bar from 6am, big lunch crowd from 11.',
   'Newstead',       '88 Doggett St',                'QLD', '4006', -27.4500, 153.0488, '05:00', '15:00', 2, true,  false, 2.1,  4.43, 312, '#181210', '#C1410D', ARRAY['Single Origin','Hot Food','Indoor Seating'], 'The "Sledge" — quad-shot long black',     'approved'),

  ('hard-hat-coffee-co', 'Hard Hat Coffee Co.',    'gossoko_van', 'Rotating van — Eagle Farm Mon-Wed, Pinkenba Thu-Fri.',
   'Custom-built coffee trailer that follows the big jobs. Posts location daily on socials. Bottomless filter for $4, espresso menu plus protein wraps.',
   'Eagle Farm',     'Lomandra Pl (Mon–Wed)',        'QLD', '4009', -27.4338, 153.0850, '04:00', '11:00', 1, true,  true,  5.4,  4.57, 96,  '#181410', '#FFB23A', ARRAY['Filter Coffee','Wraps','Protein Bars'],     'Bottomless filter + bacon wrap',            'approved'),

  ('big-brekkie-bp-bowen', 'Big Brekkie BP Bowen', 'servo',        '24/7 servo with a proper hot bar — pies, snags, all-day brekkie.',
   'Servo with an unusually serious kitchen — full English brekkie until 11am, $3 pies all day, dual coffee machines so the queue moves fast.',
   'Bowen Hills',    'Bowen Bridge Rd',              'QLD', '4006', -27.4434, 153.0357, '00:00', '23:59', 1, true,  false, 1.6,  4.29, 421, '#161513', '#A8E000', ARRAY['24/7','Pies','Drive-thru Fuel'],            'Big Brekkie box + double shot',             'approved'),

  ('ute-park-cafe',      'Ute Park Café',          'cafe',         'Hamilton café with the biggest ute apron in town.',
   'Family-run café on Kingsford Smith Drive with a huge gravel lot — fits 20 utes plus trailers. Big breakfasts, good filter, friendly staff who remember your order.',
   'Hamilton',       '418 Kingsford Smith Dr',       'QLD', '4007', -27.4400, 153.0700, '05:30', '14:00', 2, true,  false, 4.0,  4.29, 208, '#171410', '#FF7A00', ARRAY['Big Brekkie','Trailer Parking','Outdoor'],  'The "Tradesman" — eggs, bacon, hash, snags', 'approved'),

  ('site-feed-express',  'Site Feed Express',      'food_truck',   'Hot food truck — does on-site catering runs by request.',
   'Black-and-orange truck that posts up at the Eagle Farm racecourse car park Mon-Sat. Hot rolls, mince-and-cheese pies, decent coffee. Will deliver bulk orders to job sites within 5km.',
   'Eagle Farm',     'Eagle Farm Racecourse car park','QLD', '4009', -27.4338, 153.0850, '04:30', '12:00', 2, false, true,  5.6,  4.43, 71,  '#171210', '#FF5500', ARRAY['Hot Rolls','Catering','Bulk Orders'],       'Mince-and-cheese pie + sausage roll',       'approved'),

  ('concrete-cup',       'Concrete Cup',            'gossoko_van', 'Northgate freight yard coffee van — runs out by 8am most days.',
   'Tiny black caravan with a single barista who knows everyone. Cash only, but the line moves like clockwork. Open from 4am for the early shift.',
   'Northgate',      'Toombul Rd freight gate',      'QLD', '4013', -27.4012, 153.0712, '04:00', '10:00', 1, true,  false, 7.1,  4.43, 142, '#181210', '#FFB23A', ARRAY['Cash Only','Espresso','Locals'],            'Double ristretto + bacon and egg sanga',    'approved'),

  ('the-4am-bakery',     'The 4am Bakery',          'bakery',       'Stafford bakery — open before the sun, sold out by 9.',
   'Hot bread out of the oven at 4am sharp. Hand-rolled pies, big sausage rolls, lamingtons. Cheap coffee, but you don''t come here for the coffee.',
   'Stafford',       'Stafford Rd',                  'QLD', '4053', -27.4030, 153.0205, '04:00', '14:00', 1, true,  false, 8.2,  4.14, 267, '#191410', '#F2C200', ARRAY['Pies','Fresh Bread','Lamingtons'],          'Steak-and-mushroom pie',                    'approved'),

  ('steel-cap-sammies',  'Steel Cap Sammies',       'snack_bar',    'Geebung sandwich bar that builds the biggest rolls in Brisbane.',
   'Counter-only sandwich shop. Order at the front, watch them build it. Choose-your-own meats, salads, sauces. Plates available if you want to dine in.',
   'Geebung',        '215 Newman Rd',                'QLD', '4034', -27.3636, 153.0625, '05:00', '14:30', 1, false, false, 9.4,  4.14, 158, '#171411', '#A8E000', ARRAY['Sandwiches','Build-Your-Own','Cash + Tap'], 'Triple-stack roast beef on white',          'approved'),

  ('diesel-and-donuts',  'Diesel & Donuts',         'food_truck',   'Salisbury food truck — diesel coffee, hot donuts, no nonsense.',
   'Loud, fast, busy. Coffee strong enough to wake the dead, donuts fresh every hour. Truck-friendly with a big concrete pad.',
   'Salisbury',      'Evans Rd industrial estate',   'QLD', '4107', -27.5750, 153.0381, '04:30', '13:00', 1, false, true,  12.3, 4.43, 88,  '#1a1310', '#FF5500', ARRAY['Donuts','Strong Coffee','Truck Lot'],       'Hot cinnamon donut + diesel filter',        'approved'),

  ('spanner-espresso',   'Spanner Espresso',        'cafe',         'Woolloongabba café in an old mechanic''s — bench seats from a Holden.',
   'Beautifully fitted-out workshop conversion. Specialty coffee, brunch menu, a bit pricier but the service is sharp and the food slaps. Limited ute parking.',
   'Woolloongabba',  '94 Stanley St',                'QLD', '4102', -27.4900, 153.0350, '05:30', '14:00', 3, true,  false, 3.8,  3.71, 244, '#161311', '#FF9533', ARRAY['Specialty','Brunch','Indoor'],              'Bacon-jam toastie + flat white',            'approved'),

  ('sparkies-smoko',     'Sparkie''s Smoko',        'gossoko_van', 'Coorparoo van run by an ex-sparky. He gets it.',
   'Old delivery van converted to a coffee rig. Started by Dave (ex-sparky) after he hung up the pliers. Mix of regulars from the industrial strip on Old Cleveland Rd.',
   'Coorparoo',      'Old Cleveland Rd strip',       'QLD', '4151', -27.4960, 153.0676, '05:00', '11:00', 1, true,  false, 6.0,  4.29, 117, '#181311', '#FF7A00', ARRAY['Espresso','Snacks','Friendly'],             'Long black + caramel slice',                'approved'),

  ('the-apprentices-lunch', 'The Apprentice''s Lunch', 'cafe',     'Bowen Hills cheap-eats café. Apprentice budget, foreman portions.',
   '$10 hot lunches Mon-Fri. Massive serves, basic décor, fast service. Cash discount of 5%. Owned by a former site manager who hated paying $25 for a sandwich.',
   'Bowen Hills',    '52 Brookes St',                'QLD', '4006', -27.4458, 153.0408, '06:00', '14:00', 1, false, true,  1.4,  3.86, 53,  '#191411', '#F2C200', ARRAY['$10 Lunch','Cash Discount','Hot Meals'],    '$10 schnitty + chips + gravy',              'approved'),

  ('knock-off-kitchen',  'Knock-Off Kitchen',       'restaurant',   'Capalaba post-shift feed — opens when the tools go down.',
   'Started as a food truck, now a proper sit-down spot. Opens at 3pm Mon-Fri for the after-shift rush. Cold beer on tap, big meals, no fuss.',
   'Capalaba',       '101 Old Cleveland Rd',         'QLD', '4157', -27.5279, 153.1872, '15:00', '21:00', 2, true,  false, 18.7, 3.57, 196, '#181412', '#E63946', ARRAY['Beer on Tap','Sit-Down','Late Open'],       'Schnitty + jug of XXXX Gold',               'approved'),

  ('yatala-tradies-co',  'Yatala Tradies Co.',      'cafe_and_food_truck', 'Yatala dual setup — café inside, hot truck out front.',
   'Equally good if you want to sit down or grab and go. Truck handles the early shift (4:30am), café opens at 6am for the longer feeds. Massive industrial estate clientele.',
   'Yatala',         'Heron Place industrial estate','QLD', '4207', -27.7460, 153.2050, '04:30', '15:00', 2, true,  true,  38.4, 4.57, 305, '#171410', '#FF7A00', ARRAY['Dine-in + Take','Truck Lot','Bulk Orders'], 'Big breakfast wrap + double-shot',          'approved')
ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;
