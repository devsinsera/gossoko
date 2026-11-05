export type VenueType =
  | 'gossoko_van'
  | 'cafe'
  | 'food_truck'
  | 'bakery'
  | 'servo'
  | 'snack_bar'
  | 'restaurant'
  | 'cafe_and_food_truck';

export type RatingAxis =
  | 'coffee_strength'
  | 'feed_size'
  | 'bang_for_buck'
  | 'speed'
  | 'ute_parking'
  | 'early_open'
  | 'service';

export type Ratings = Record<RatingAxis, number>;

export interface Venue {
  id: string;
  slug: string;
  name: string;
  venue_type: VenueType;
  tagline: string;
  description: string;
  suburb: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  open_now: boolean;
  opens_at: string;
  closes_at: string;
  price_level: 1 | 2 | 3;
  verified: boolean;
  trending: boolean;
  distance_km: number;
  ratings: Ratings;
  overall: number;
  review_count: number;
  hero_color: string;
  hero_accent: string;
  badges: string[];
  tags: string[];
  signature: string;
}

export interface Review {
  id: string;
  venue_id: string;
  user_handle: string;
  title: string;
  body: string;
  ratings: Ratings;
  overall: number;
  posted_at: string;
  helpful_count: number;
}

export interface User {
  id: string;
  handle: string;
  display_name: string;
  trade: string;
  suburb: string;
  avatar_color: string;
  initials: string;
  bio: string;
  joined: string;
  stats: {
    reviews: number;
    helpful_marks: number;
    venues_visited: number;
    streak_days: number;
  };
  badges: { code: string; label: string; color: string }[];
}

export const RATING_LABELS: Record<RatingAxis, string> = {
  coffee_strength: 'Coffee Strength',
  feed_size: 'Feed Size',
  bang_for_buck: 'Bang for Buck',
  speed: 'Speed',
  ute_parking: 'Ute Parking',
  early_open: 'Early Open',
  service: 'Service',
};

export const RATING_ORDER: RatingAxis[] = [
  'speed',
  'feed_size',
  'coffee_strength',
  'bang_for_buck',
  'ute_parking',
  'early_open',
  'service',
];

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  gossoko_van: 'Smoko Van',
  cafe: 'Café',
  food_truck: 'Food Truck',
  bakery: 'Bakery',
  servo: 'Servo',
  snack_bar: 'Snack Bar',
  restaurant: 'Restaurant',
  cafe_and_food_truck: 'Café + Truck',
};
