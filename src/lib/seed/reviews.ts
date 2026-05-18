import type { Review } from './types';

export const REVIEWS: Review[] = [
  {
    id: 'r_001', venue_id: 'v_smokostop', user_handle: 'sparky_dave',
    title: 'Best within 5km of the depot',
    body: 'Been hitting this van every morning for three months. Dave behind the counter remembers my order. B&E roll is genuinely huge for $9. Coffee is hot, strong, in the cup in 90 seconds. Ute apron fits five rigs easy.',
    ratings: { coffee_strength: 5, feed_size: 5, bang_for_buck: 5, speed: 5, ute_parking: 5, early_open: 5, service: 5 },
    overall: 5.0, posted_at: '2026-05-12T05:24:00Z', helpful_count: 38,
  },
  {
    id: 'r_002', venue_id: 'v_smokostop', user_handle: 'big_steve_chippy',
    title: 'Roll passes the lunch-box test',
    body: 'Fits in a standard lunchbox if you cut it in half — you won\'t want to. Coffee a touch under-extracted today but they were slammed.',
    ratings: { coffee_strength: 4, feed_size: 5, bang_for_buck: 5, speed: 4, ute_parking: 5, early_open: 5, service: 5 },
    overall: 4.7, posted_at: '2026-05-09T05:11:00Z', helpful_count: 22,
  },
  {
    id: 'r_003', venue_id: 'v_crowbar', user_handle: 'plumber_kate',
    title: 'Worth the detour off the M1',
    body: 'Hot food bar from 6 is the move — bacon, hash, scrambled, beans, all proper. Coffee is the best in Newstead by a mile. Lose a star for parking, fight for a spot after 7.',
    ratings: { coffee_strength: 5, feed_size: 4, bang_for_buck: 4, speed: 4, ute_parking: 2, early_open: 5, service: 5 },
    overall: 4.1, posted_at: '2026-05-10T06:48:00Z', helpful_count: 19,
  },
  {
    id: 'r_004', venue_id: 'v_hardhat', user_handle: 'rachel_concrete',
    title: 'Bottomless filter is the move',
    body: 'On a long pour day this saves my life. $4 for unlimited refills, the wrap is solid. Lose a star — found them at the wrong location once, follow the socials.',
    ratings: { coffee_strength: 4, feed_size: 4, bang_for_buck: 5, speed: 5, ute_parking: 5, early_open: 5, service: 4 },
    overall: 4.6, posted_at: '2026-05-14T04:22:00Z', helpful_count: 14,
  },
  {
    id: 'r_005', venue_id: 'v_bpbowen', user_handle: 'brickie_jimbo',
    title: 'Underrated 24/7 feed',
    body: 'Coffee is whatever, but the Big Brekkie box at 5am hits different. Pies are hot, fast, and $3 each. Will keep coming back.',
    ratings: { coffee_strength: 3, feed_size: 5, bang_for_buck: 5, speed: 4, ute_parking: 5, early_open: 5, service: 3 },
    overall: 4.3, posted_at: '2026-05-08T05:00:00Z', helpful_count: 27,
  },
  {
    id: 'r_006', venue_id: 'v_uteparkcafe', user_handle: 'sparky_dave',
    title: 'Apron is genuinely huge',
    body: '20 utes plus trailers, no joke. Service slows when a whole crew rolls in at 6:30 but the food is solid. The Tradesman breakfast is unreal.',
    ratings: { coffee_strength: 4, feed_size: 5, bang_for_buck: 4, speed: 3, ute_parking: 5, early_open: 4, service: 5 },
    overall: 4.3, posted_at: '2026-05-15T06:35:00Z', helpful_count: 11,
  },
  {
    id: 'r_007', venue_id: 'v_concretecup', user_handle: 'big_steve_chippy',
    title: 'Cash-only but worth the ATM run',
    body: 'Best ristretto in the north. Tiny van, two stools, queue moves fast. Bring cash, the eftpos has never worked and never will.',
    ratings: { coffee_strength: 5, feed_size: 2, bang_for_buck: 5, speed: 5, ute_parking: 4, early_open: 5, service: 5 },
    overall: 4.4, posted_at: '2026-05-11T04:45:00Z', helpful_count: 16,
  },
  {
    id: 'r_008', venue_id: 'v_4ambakery', user_handle: 'plumber_kate',
    title: 'Steak-and-mushroom pie is a religion',
    body: 'Sold out by 9am every day for a reason. Pastry is buttery, filling is steak you can recognise. Coffee is bad — don\'t come for the coffee.',
    ratings: { coffee_strength: 2, feed_size: 5, bang_for_buck: 5, speed: 4, ute_parking: 4, early_open: 5, service: 4 },
    overall: 4.1, posted_at: '2026-05-13T05:32:00Z', helpful_count: 31,
  },
  {
    id: 'r_009', venue_id: 'v_steelcap', user_handle: 'tilers_united',
    title: 'Triple-stack will see you through to knock-off',
    body: 'Watched her stack a triple roast beef like she was building a brick wall. $12 for two days of food. Will be back.',
    ratings: { coffee_strength: 2, feed_size: 5, bang_for_buck: 5, speed: 3, ute_parking: 5, early_open: 4, service: 5 },
    overall: 4.1, posted_at: '2026-05-07T11:15:00Z', helpful_count: 9,
  },
  {
    id: 'r_010', venue_id: 'v_yatala', user_handle: 'rachel_concrete',
    title: 'Whole site eats here on big pour days',
    body: 'Phoned ahead a 30-order, ready when we rolled in. Wraps were hot, coffees lined up by number. This is how it should be done.',
    ratings: { coffee_strength: 4, feed_size: 5, bang_for_buck: 4, speed: 5, ute_parking: 5, early_open: 5, service: 5 },
    overall: 4.7, posted_at: '2026-05-16T04:55:00Z', helpful_count: 24,
  },
  {
    id: 'r_011', venue_id: 'v_diesel', user_handle: 'brickie_jimbo',
    title: 'Donuts keep me going past lunch',
    body: 'Fresh cinnamon donut every hour on the hour. Coffee is rocket fuel. Service can be grumpy at 5am but you didn\'t come here to chat.',
    ratings: { coffee_strength: 5, feed_size: 3, bang_for_buck: 5, speed: 5, ute_parking: 5, early_open: 5, service: 3 },
    overall: 4.4, posted_at: '2026-05-09T05:18:00Z', helpful_count: 13,
  },
  {
    id: 'r_012', venue_id: 'v_spanner', user_handle: 'plumber_kate',
    title: 'Pricey but the bacon-jam toastie though',
    body: 'A bit yuppie for a tradie review platform but the food is excellent. Don\'t bring the whole crew or you\'ll go broke. Limited parking out front.',
    ratings: { coffee_strength: 5, feed_size: 4, bang_for_buck: 3, speed: 4, ute_parking: 2, early_open: 3, service: 5 },
    overall: 3.7, posted_at: '2026-05-06T07:42:00Z', helpful_count: 8,
  },
  {
    id: 'r_013', venue_id: 'v_apprentice', user_handle: 'big_steve_chippy',
    title: '$10 schnitty is real food',
    body: 'Owner used to run sites — he gets it. Schnitty hangs off the plate, chips proper, gravy actually gravy. Cash discount means it\'s $9.50.',
    ratings: { coffee_strength: 3, feed_size: 5, bang_for_buck: 5, speed: 4, ute_parking: 3, early_open: 3, service: 4 },
    overall: 3.9, posted_at: '2026-05-15T12:10:00Z', helpful_count: 17,
  },
  {
    id: 'r_014', venue_id: 'v_sparkies', user_handle: 'sparky_dave',
    title: 'Dave gets it because Dave was us',
    body: 'Ex-sparky running a coffee van — you know the coffee is going to be quick. He knows what time the crews knock off and shifts the menu accordingly.',
    ratings: { coffee_strength: 4, feed_size: 3, bang_for_buck: 5, speed: 5, ute_parking: 4, early_open: 4, service: 5 },
    overall: 4.3, posted_at: '2026-05-12T10:08:00Z', helpful_count: 21,
  },
  {
    id: 'r_015', venue_id: 'v_knockoff', user_handle: 'tilers_united',
    title: 'Opens when you actually want a feed',
    body: '3pm opening is the genius move. Walk off-site, beer is cold, schnitty is hot, jug is on tap. Wouldn\'t go for breakfast but you wouldn\'t expect to.',
    ratings: { coffee_strength: 2, feed_size: 5, bang_for_buck: 4, speed: 3, ute_parking: 5, early_open: 1, service: 5 },
    overall: 3.6, posted_at: '2026-05-11T15:40:00Z', helpful_count: 15,
  },
];

export const REVIEWS_BY_VENUE = REVIEWS.reduce<Record<string, Review[]>>((acc, r) => {
  (acc[r.venue_id] ||= []).push(r);
  return acc;
}, {});

export const RECENT_REVIEWS = [...REVIEWS].sort((a, b) => b.posted_at.localeCompare(a.posted_at));
