# Gossoko Community Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Gossoko from a venue discovery app into a vibrant, gamified community platform where tradies build identity, compete on leaderboards, earn badges, and share discoveries in an authentic, Aussie-humored environment.

**Architecture:**
- Extended Supabase schema for profiles, follows, activities, badges, reputation
- Real-time activity feed with ranking algorithm prioritizing engagement and recency
- Badge system with unlock conditions based on user actions (reviews, discoveries, engagement)
- Weekly leaderboard calculations with regional and category-specific rankings
- Real-time notifications for follows, comments, likes, and badge unlocks
- Shareable cards optimized for social media with custom styling

**Tech Stack:** Next.js 15, React, Supabase (PostgreSQL + Real-time), TypeScript, Tailwind CSS, Lucide icons

---

## File Structure

```
src/
├── app/(app)/
│   ├── profile/
│   │   ├── [userId]/page.tsx
│   │   └── edit/page.tsx
│   ├── leaderboards/
│   │   ├── page.tsx
│   │   ├── best-in-[region]/page.tsx
│   │   ├── best-bakeries/page.tsx
│   │   └── top-food-trucks/page.tsx
│   ├── activity/page.tsx
│   └── badges/page.tsx
├── components/
│   ├── profile/
│   │   ├── profile-header.tsx
│   │   ├── trade-badge-selector.tsx
│   │   ├── favorite-spots-section.tsx
│   │   ├── badges-showcase.tsx
│   │   └── edit-profile-form.tsx
│   ├── social/
│   │   ├── activity-card.tsx
│   │   ├── follow-button.tsx
│   │   ├── comment-section.tsx
│   │   ├── reaction-buttons.tsx
│   │   └── activity-feed.tsx
│   ├── leaderboard/
│   │   ├── leaderboard-table.tsx
│   │   ├── rank-position.tsx
│   │   └── regional-selector.tsx
│   ├── gamification/
│   │   ├── badge-unlock-modal.tsx
│   │   ├── badge-card.tsx
│   │   └── reputation-meter.tsx
│   └── sharing/
│       ├── shareable-card.tsx
│       └── share-modal.tsx
├── hooks/
│   ├── use-profile.ts
│   ├── use-follow.ts
│   ├── use-activity-feed.ts
│   ├── use-leaderboard.ts
│   ├── use-badges.ts
│   ├── use-notifications.ts
│   └── use-reputation.ts
├── lib/
│   ├── gamification.ts
│   ├── reputation.ts
│   ├── leaderboard-calc.ts
│   ├── feed-algorithm.ts
│   └── share-utils.ts
├── server/
│   ├── profile-actions.ts
│   ├── social-actions.ts
│   ├── leaderboard-actions.ts
│   ├── badge-actions.ts
│   └── notification-actions.ts
├── types/
│   ├── profile.ts
│   ├── social.ts
│   ├── badges.ts
│   └── leaderboard.ts
└── styles/
    └── community.css
```

---

## Tasks

### Task 1: Extend Database Schema for Community Features

**Files:**
- Create: `supabase/migrations/003_community_schema.sql`
- Create: `src/types/profile.ts`
- Create: `src/types/social.ts`
- Create: `src/types/badges.ts`
- Create: `src/types/leaderboard.ts`

- [ ] **Step 1: Create SQL migration for community tables**

**File:** `supabase/migrations/003_community_schema.sql`

```sql
-- Update users table with profile fields
alter table public.users add column if not exists trade_type text check (trade_type in ('sparky', 'chippy', 'plumber', 'roofer', 'landscaper', 'concretor', 'fifo', 'mechanic', null));
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists reputation_score integer default 0 not null;
alter table public.users add column if not exists review_count integer default 0 not null;
alter table public.users add column if not exists followers_count integer default 0 not null;
alter table public.users add column if not exists following_count integer default 0 not null;

-- Create follows table
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

-- Create activities table
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('review', 'comment', 'like', 'follow', 'new_spot', 'badge_unlocked')),
  related_spot_id uuid references public.spots(id) on delete cascade,
  related_user_id uuid references public.users(id) on delete cascade,
  related_rating_id uuid references public.ratings(id) on delete cascade,
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create reactions table
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like', 'love', 'fire', 'clap')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, activity_id, reaction_type)
);

-- Create badges table
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text not null,
  icon_emoji text not null,
  unlock_condition text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create user_badges table (junction)
create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  unlocked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, badge_id)
);

-- Create leaderboard_entries table (denormalized for performance)
create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  period text not null check (period in ('weekly', 'alltime')),
  region text,
  category text,
  rank integer not null,
  score integer not null,
  week_start date,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, period, region, category, week_start)
);

-- Create notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('follow', 'comment', 'reaction', 'badge_unlocked', 'mentioned')),
  from_user_id uuid references public.users(id) on delete cascade,
  related_activity_id uuid references public.activities(id) on delete cascade,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create favorites table
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  spot_id uuid not null references public.spots(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, spot_id)
);

-- Create indexes
create index follows_follower_idx on public.follows(follower_id);
create index follows_following_idx on public.follows(following_id);
create index activities_user_id_idx on public.activities(user_id);
create index activities_created_at_idx on public.activities(created_at desc);
create index comments_activity_id_idx on public.comments(activity_id);
create index reactions_activity_id_idx on public.reactions(activity_id);
create index user_badges_user_id_idx on public.user_badges(user_id);
create index leaderboard_entries_period_idx on public.leaderboard_entries(period, region, category);
create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_is_read_idx on public.notifications(is_read);
create index favorites_user_id_idx on public.favorites(user_id);

-- Enable RLS
alter table public.follows enable row level security;
alter table public.activities enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.favorites enable row level security;

-- RLS Policies
create policy "Follows are readable by anyone"
  on public.follows for select using (true);

create policy "Users can create follows"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can delete own follows"
  on public.follows for delete using (auth.uid() = follower_id);

create policy "Activities are readable by anyone"
  on public.activities for select using (true);

create policy "Users can create own activities"
  on public.activities for insert with check (auth.uid() = user_id);

create policy "Comments are readable by anyone"
  on public.comments for select using (true);

create policy "Users can create comments"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.comments for delete using (auth.uid() = user_id);

create policy "Reactions are readable by anyone"
  on public.reactions for select using (true);

create policy "Users can create reactions"
  on public.reactions for insert with check (auth.uid() = user_id);

create policy "Users can delete own reactions"
  on public.reactions for delete using (auth.uid() = user_id);

create policy "Badges are readable by anyone"
  on public.badges for select using (true);

create policy "User badges are readable by anyone"
  on public.user_badges for select using (true);

create policy "Leaderboard entries are readable by anyone"
  on public.leaderboard_entries for select using (true);

create policy "Users can read own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update using (auth.uid() = user_id);

create policy "Favorites are private"
  on public.favorites for select using (auth.uid() = user_id);

create policy "Users can create own favorites"
  on public.favorites for insert with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Define TypeScript types for profile**

**File:** `src/types/profile.ts`

```typescript
export type TradeType = 'sparky' | 'chippy' | 'plumber' | 'roofer' | 'landscaper' | 'concretor' | 'fifo' | 'mechanic'

export const TRADE_TYPE_LABELS: Record<TradeType, string> = {
  sparky: 'Sparky',
  chippy: 'Chippy',
  plumber: 'Plumber',
  roofer: 'Roofer',
  landscaper: 'Landscaper',
  concretor: 'Concretor',
  fifo: 'FIFO',
  mechanic: 'Mechanic',
}

export const TRADE_TYPE_EMOJIS: Record<TradeType, string> = {
  sparky: '⚡',
  chippy: '🔨',
  plumber: '🔧',
  roofer: '🏠',
  landscaper: '🌱',
  concretor: '🪨',
  fifo: '✈️',
  mechanic: '🚗',
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  trade_type: TradeType | null
  reputation_score: number
  review_count: number
  followers_count: number
  following_count: number
  created_at: string
  updated_at: string
}

export interface UserProfileWithStats extends UserProfile {
  isFollowing?: boolean
  followersList?: string[]
}
```

- [ ] **Step 3: Define TypeScript types for social**

**File:** `src/types/social.ts`

```typescript
export type ActivityType = 'review' | 'comment' | 'like' | 'follow' | 'new_spot' | 'badge_unlocked'
export type ReactionType = 'like' | 'love' | 'fire' | 'clap'

export interface Activity {
  id: string
  user_id: string
  activity_type: ActivityType
  related_spot_id: string | null
  related_user_id: string | null
  related_rating_id: string | null
  content: string | null
  created_at: string
}

export interface ActivityWithUser extends Activity {
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
    trade_type: string | null
  }
  spot?: {
    id: string
    name: string
  }
  reactions: ReactionWithUser[]
  comments: CommentWithUser[]
  _count?: {
    reactions: number
    comments: number
  }
}

export interface Comment {
  id: string
  user_id: string
  activity_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface CommentWithUser extends Comment {
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface Reaction {
  id: string
  user_id: string
  activity_id: string
  reaction_type: ReactionType
  created_at: string
}

export interface ReactionWithUser extends Reaction {
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  notification_type: string
  from_user_id: string | null
  related_activity_id: string | null
  is_read: boolean
  created_at: string
}
```

- [ ] **Step 4: Define TypeScript types for badges and leaderboards**

**File:** `src/types/badges.ts`

```typescript
export interface Badge {
  id: string
  code: string
  name: string
  description: string
  icon_emoji: string
  unlock_condition: string
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  unlocked_at: string
  badge?: Badge
}

export const GOSSOKO_BADGES: Badge[] = [
  {
    id: 'top-feed-hunter',
    code: 'top_feed_hunter',
    name: 'Top Feed Hunter',
    description: 'Found 10+ venue with the biggest feeds',
    icon_emoji: '🍖',
    unlock_condition: 'spots_found >= 10',
    created_at: new Date().toISOString(),
  },
  {
    id: 'coffee-king',
    code: 'coffee_king',
    name: 'Coffee King',
    description: 'Rated 20+ venues for coffee strength',
    icon_emoji: '☕',
    unlock_condition: 'coffee_ratings >= 20',
    created_at: new Date().toISOString(),
  },
  {
    id: 'hidden-gem-finder',
    code: 'hidden_gem_finder',
    name: 'Hidden Gem Finder',
    description: 'Discovered 5 spots that became trending',
    icon_emoji: '💎',
    unlock_condition: 'trending_discoveries >= 5',
    created_at: new Date().toISOString(),
  },
  {
    id: 'early-bird',
    code: 'early_bird',
    name: 'Early Bird',
    description: 'Visited spots before 5am 10 times',
    icon_emoji: '🌅',
    unlock_condition: 'early_visits >= 10',
    created_at: new Date().toISOString(),
  },
  {
    id: 'gossoko-legend',
    code: 'gossoko_legend',
    name: 'Gossoko Legend',
    description: 'Reached 1000+ reputation points',
    icon_emoji: '👑',
    unlock_condition: 'reputation >= 1000',
    created_at: new Date().toISOString(),
  },
]
```

**File:** `src/types/leaderboard.ts`

```typescript
export type LeaderboardPeriod = 'weekly' | 'alltime'

export interface LeaderboardEntry {
  id: string
  user_id: string
  period: LeaderboardPeriod
  region: string | null
  category: string | null
  rank: number
  score: number
  week_start: string | null
  updated_at: string
}

export interface LeaderboardEntryWithUser extends LeaderboardEntry {
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
    trade_type: string | null
  }
}

export interface RegionalLeaderboard {
  region: string
  entries: LeaderboardEntryWithUser[]
}

export const REGIONS = [
  'Brisbane',
  'Gold Coast',
  'Sunshine Coast',
  'Toowoomba',
  'Cairns',
]

export const CATEGORIES = [
  'Best Bakery',
  'Best Coffee',
  'Best Feed Size',
  'Fastest Service',
  'Best Value',
  'Food Trucks',
]
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_community_schema.sql src/types/profile.ts src/types/social.ts src/types/badges.ts src/types/leaderboard.ts
git commit -m "feat: add community database schema and TypeScript types"
```

---

### Task 2: Create Profile Page and Edit Form

**Files:**
- Create: `src/components/profile/profile-header.tsx`
- Create: `src/components/profile/badges-showcase.tsx`
- Create: `src/components/profile/edit-profile-form.tsx`
- Create: `src/app/(app)/profile/[userId]/page.tsx`
- Create: `src/app/(app)/profile/edit/page.tsx`
- Create: `src/hooks/use-profile.ts`

- [ ] **Step 1: Create profile header component**

**File:** `src/components/profile/profile-header.tsx`

```typescript
'use client'

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FollowButton } from '@/components/social/follow-button'
import { TRADE_TYPE_LABELS, TRADE_TYPE_EMOJIS } from '@/types/profile'
import type { UserProfileWithStats } from '@/types/profile'

interface ProfileHeaderProps {
  profile: UserProfileWithStats
  isOwnProfile: boolean
}

export function ProfileHeader({ profile, isOwnProfile }: ProfileHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Cover + Avatar */}
      <div className="relative h-32 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg overflow-hidden">
        {profile.avatar_url && (
          <Image
            src={profile.avatar_url}
            alt={profile.full_name || 'Avatar'}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
            fill
          />
        )}

        <div className="absolute bottom-0 left-4 transform translate-y-1/2">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-900 overflow-hidden flex items-center justify-center text-4xl">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name || 'Avatar'}
                fill
                className="object-cover"
              />
            ) : (
              '👤'
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="pt-8 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-light">{profile.full_name || 'Unknown'}</h1>
            {profile.trade_type && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl">{TRADE_TYPE_EMOJIS[profile.trade_type]}</span>
                <span className="text-muted">{TRADE_TYPE_LABELS[profile.trade_type]}</span>
              </div>
            )}
          </div>

          {isOwnProfile ? (
            <a href="/profile/edit">
              <Button size="sm" variant="secondary">
                Edit Profile
              </Button>
            </a>
          ) : (
            <FollowButton userId={profile.id} isFollowing={profile.isFollowing || false} />
          )}
        </div>

        {profile.bio && (
          <p className="text-muted text-sm">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 pt-2 border-t border-slate-700">
          <div className="text-center">
            <div className="text-lg font-bold text-orange-500">{profile.review_count}</div>
            <div className="text-xs text-muted">Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-500">{profile.followers_count}</div>
            <div className="text-xs text-muted">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-500">{profile.following_count}</div>
            <div className="text-xs text-muted">Following</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-500">{profile.reputation_score}</div>
            <div className="text-xs text-muted">Reputation</div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create badges showcase component**

**File:** `src/components/profile/badges-showcase.tsx`

```typescript
'use client'

import { Card } from '@/components/ui/card'
import type { UserBadge } from '@/types/badges'

interface BadgesShowcaseProps {
  badges: UserBadge[]
}

export function BadgesShowcase({ badges }: BadgesShowcaseProps) {
  if (badges.length === 0) {
    return (
      <Card className="text-center py-8">
        <p className="text-muted">No badges yet. Keep exploring!</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-light">Badges</h2>
      <div className="grid grid-cols-3 gap-3">
        {badges.map((badge) => (
          <div key={badge.id} className="flex flex-col items-center gap-2 p-3 bg-slate-800 rounded-lg">
            <div className="text-4xl">{badge.badge?.icon_emoji}</div>
            <p className="text-xs text-light text-center font-medium">{badge.badge?.name}</p>
            <p className="text-xs text-muted">
              {new Date(badge.unlocked_at).toLocaleDateString('en-AU')}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create edit profile form**

**File:** `src/components/profile/edit-profile-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { TRADE_TYPE_LABELS, TRADE_TYPE_EMOJIS } from '@/types/profile'
import type { TradeType, UserProfile } from '@/types/profile'
import { updateUserProfile } from '@/server/profile-actions'

interface EditProfileFormProps {
  profile: UserProfile
}

export function EditProfileForm({ profile }: EditProfileFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    bio: profile.bio || '',
    trade_type: profile.trade_type || ('sparky' as TradeType),
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await updateUserProfile(profile.id, formData)
      router.push(`/profile/${profile.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <Card className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-light">Edit Profile</h1>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          required
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-light">Trade Type</label>
          <select
            name="trade_type"
            value={formData.trade_type}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-light focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
          >
            {Object.entries(TRADE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {TRADE_TYPE_EMOJIS[key as TradeType]} {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-light">Bio</label>
          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="Tell us about yourself"
            rows={4}
            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-light placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" size="lg" loading={loading} className="flex-1">
            Save Changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
```

- [ ] **Step 4: Create use-profile hook**

**File:** `src/hooks/use-profile.ts`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { UserProfileWithStats } from '@/types/profile'

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfileWithStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (fetchError) throw fetchError

        // Check if current user is following
        const { data: authData } = await supabase.auth.getUser()
        let isFollowing = false

        if (authData.user?.id && authData.user.id !== userId) {
          const { data: followData } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', authData.user.id)
            .eq('following_id', userId)
            .single()

          isFollowing = !!followData
        }

        setProfile({ ...data, isFollowing })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [userId, supabase])

  return { profile, loading, error }
}
```

- [ ] **Step 5: Create user profile page**

**File:** `src/app/(app)/profile/[userId]/page.tsx`

```typescript
'use client'

import { useAuth } from '@/hooks/use-auth'
import { useProfile } from '@/hooks/use-profile'
import { Header } from '@/components/layout/header'
import { Card } from '@/components/ui/card'
import { ProfileHeader } from '@/components/profile/profile-header'
import { BadgesShowcase } from '@/components/profile/badges-showcase'
import { Loader } from '@/components/ui/loader'

export default function ProfilePage({ params }: { params: { userId: string } }) {
  const { user: currentUser } = useAuth()
  const { profile, loading } = useProfile(params.userId)
  const isOwnProfile = currentUser?.id === params.userId

  if (loading) {
    return (
      <>
        <Header title="Profile" />
        <div className="container py-12 flex justify-center">
          <Loader />
        </div>
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <Header title="Profile" />
        <div className="container py-12 text-center text-muted">
          <p>User not found</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={profile.full_name || 'Profile'} />

      <div className="container py-6 space-y-6">
        <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />

        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-light">Recent Reviews</h2>
          <p className="text-muted text-sm">User's recent reviews will appear here</p>
        </Card>

        <BadgesShowcase badges={[]} />
      </div>
    </>
  )
}
```

- [ ] **Step 6: Create edit profile page**

**File:** `src/app/(app)/profile/edit/page.tsx`

```typescript
'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { EditProfileForm } from '@/components/profile/edit-profile-form'
import { Loader } from '@/components/ui/loader'
import { createClient } from '@/lib/supabase'
import type { UserProfile } from '@/types/profile'

export default function EditProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    async function fetchProfile() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setProfile(data)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [user, router, supabase])

  if (loading) {
    return (
      <>
        <Header title="Edit Profile" />
        <div className="container py-12 flex justify-center">
          <Loader />
        </div>
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <Header title="Edit Profile" />
        <div className="container py-12 text-center text-muted">
          <p>Failed to load profile</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Edit Profile" />
      <div className="container py-6">
        <EditProfileForm profile={profile} />
      </div>
    </>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/profile/ src/app/\(app\)/profile/ src/hooks/use-profile.ts
git commit -m "feat: add user profile pages and edit form"
```

---

### Task 3: Implement Follow System

**Files:**
- Create: `src/components/social/follow-button.tsx`
- Create: `src/server/social-actions.ts`
- Create: `src/hooks/use-follow.ts`

- [ ] **Step 1: Create follow button component**

**File:** `src/components/social/follow-button.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { followUser, unfollowUser } from '@/server/social-actions'

interface FollowButtonProps {
  userId: string
  isFollowing: boolean
}

export function FollowButton({ userId, isFollowing: initialIsFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)

  async function handleToggleFollow() {
    setLoading(true)
    try {
      if (isFollowing) {
        await unfollowUser(userId)
      } else {
        await followUser(userId)
      }
      setIsFollowing(!isFollowing)
    } catch (error) {
      console.error('Failed to toggle follow:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={isFollowing ? 'secondary' : 'primary'}
      size="sm"
      onClick={handleToggleFollow}
      loading={loading}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  )
}
```

- [ ] **Step 2: Create social server actions**

**File:** `src/server/social-actions.ts`

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function followUser(userIdToFollow: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (user.id === userIdToFollow) throw new Error('Cannot follow yourself')

  const { error } = await supabase.from('follows').insert({
    follower_id: user.id,
    following_id: userIdToFollow,
  })

  if (error) throw error

  // Update follower counts
  await updateFollowCounts(user.id, userIdToFollow)
}

export async function unfollowUser(userIdToUnfollow: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', userIdToUnfollow)

  if (error) throw error

  // Update follower counts
  await updateFollowCounts(user.id, userIdToUnfollow)
}

export async function getFollowersCount(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { count, error } = await supabase
    .from('follows')
    .select('id', { count: 'exact' })
    .eq('following_id', userId)

  if (error) throw error
  return count || 0
}

export async function getFollowingCount(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { count, error } = await supabase
    .from('follows')
    .select('id', { count: 'exact' })
    .eq('follower_id', userId)

  if (error) throw error
  return count || 0
}

async function updateFollowCounts(followerId: string, followingId: string) {
  const supabase = await createServerSupabaseClient()

  const followersCount = await getFollowersCount(followingId)
  const followingCount = await getFollowingCount(followerId)

  await Promise.all([
    supabase.from('users').update({ followers_count: followersCount }).eq('id', followingId),
    supabase.from('users').update({ following_count: followingCount }).eq('id', followerId),
  ])
}

export async function isFollowing(followingId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', followingId)
    .single()

  return !!data
}
```

- [ ] **Step 3: Create use-follow hook**

**File:** `src/hooks/use-follow.ts`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export function useFollow(userId: string) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function checkFollowStatus() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user || user.id === userId) {
          setIsFollowing(false)
          setLoading(false)
          return
        }

        const { data } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .single()

        setIsFollowing(!!data)
      } finally {
        setLoading(false)
      }
    }

    checkFollowStatus()
  }, [userId, supabase])

  return { isFollowing, loading }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/social/follow-button.tsx src/server/social-actions.ts src/hooks/use-follow.ts
git commit -m "feat: implement follow system with server actions"
```

---

### Task 4: Create Activity Feed Card Component

**Files:**
- Create: `src/components/social/activity-card.tsx`
- Create: `src/components/social/reaction-buttons.tsx`

- [ ] **Step 1: Create reaction buttons component**

**File:** `src/components/social/reaction-buttons.tsx`

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { ReactionType } from '@/types/social'

const REACTIONS: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  fire: '🔥',
  clap: '👏',
}

interface ReactionButtonsProps {
  activityId: string
  reactionCounts?: Record<ReactionType, number>
  userReaction?: ReactionType | null
}

export function ReactionButtons({ activityId, reactionCounts = {}, userReaction }: ReactionButtonsProps) {
  const [reactions, setReactions] = useState(reactionCounts)
  const [currentReaction, setCurrentReaction] = useState(userReaction)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleReaction(reactionType: ReactionType) {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (currentReaction === reactionType) {
        // Remove reaction
        await supabase
          .from('reactions')
          .delete()
          .eq('activity_id', activityId)
          .eq('user_id', user.id)
          .eq('reaction_type', reactionType)

        setReactions((prev) => ({
          ...prev,
          [reactionType]: Math.max(0, (prev[reactionType] || 0) - 1),
        }))
        setCurrentReaction(null)
      } else {
        // Remove previous reaction if exists
        if (currentReaction) {
          await supabase
            .from('reactions')
            .delete()
            .eq('activity_id', activityId)
            .eq('user_id', user.id)
            .eq('reaction_type', currentReaction)
        }

        // Add new reaction
        await supabase.from('reactions').insert({
          activity_id: activityId,
          user_id: user.id,
          reaction_type: reactionType,
        })

        if (currentReaction) {
          setReactions((prev) => ({
            ...prev,
            [currentReaction]: Math.max(0, (prev[currentReaction] || 0) - 1),
          }))
        }

        setReactions((prev) => ({
          ...prev,
          [reactionType]: (prev[reactionType] || 0) + 1,
        }))
        setCurrentReaction(reactionType)
      }
    } catch (error) {
      console.error('Failed to add reaction:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {(Object.keys(REACTIONS) as ReactionType[]).map((reactionType) => (
        <button
          key={reactionType}
          onClick={() => handleReaction(reactionType)}
          disabled={loading}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            currentReaction === reactionType
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-slate-700 text-muted hover:bg-slate-600'
          }`}
        >
          <span>{REACTIONS[reactionType]}</span>
          <span>{reactions[reactionType] || 0}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create activity card component**

**File:** `src/components/social/activity-card.tsx`

```typescript
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { ReactionButtons } from './reaction-buttons'
import { TRADE_TYPE_EMOJIS } from '@/types/profile'
import type { ActivityWithUser } from '@/types/social'

interface ActivityCardProps {
  activity: ActivityWithUser
}

const ACTIVITY_LABELS: Record<string, string> = {
  review: 'reviewed',
  comment: 'commented on',
  like: 'liked',
  follow: 'followed',
  new_spot: 'found',
  badge_unlocked: 'unlocked badge',
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const user = activity.user
  const label = ACTIVITY_LABELS[activity.activity_type] || 'did something'

  return (
    <Card className="space-y-4">
      {/* Header */}
      <Link href={`/profile/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg overflow-hidden">
          {user.avatar_url ? (
            <Image src={user.avatar_url} alt={user.full_name || 'User'} fill className="object-cover" />
          ) : (
            '👤'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-light truncate">
            {user.full_name || 'Anonymous'}
            {user.trade_type && <span className="ml-2">{TRADE_TYPE_EMOJIS[user.trade_type as any]}</span>}
          </p>
          <p className="text-xs text-muted">
            {label} {activity.spot?.name && `"${activity.spot.name}"`}
          </p>
        </div>
      </Link>

      {/* Content */}
      {activity.content && (
        <p className="text-light text-sm">{activity.content}</p>
      )}

      {/* Reactions */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-700">
        <ReactionButtons activityId={activity.id} />
        {activity._count && (
          <div className="text-xs text-muted ml-auto">
            {activity._count.comments} comments
          </div>
        )}
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/social/activity-card.tsx src/components/social/reaction-buttons.tsx
git commit -m "feat: create activity card with reactions"
```

---

### Task 5: Create Activity Feed Page

**Files:**
- Create: `src/components/social/activity-feed.tsx`
- Create: `src/hooks/use-activity-feed.ts`
- Create: `src/server/social-actions.ts` (add new functions)
- Create: `src/app/(app)/activity/page.tsx`

- [ ] **Step 1: Create activity feed hook**

**File:** `src/hooks/use-activity-feed.ts`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { ActivityWithUser } from '@/types/social'

export function useActivityFeed(limit = 20) {
  const [activities, setActivities] = useState<ActivityWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    loadActivities(0)
  }, [])

  async function loadActivities(newOffset: number) {
    try {
      setLoading(true)
      const { data, error, count } = await supabase
        .from('activities')
        .select(
          `*,
          user:user_id(id, full_name, avatar_url, trade_type),
          spot:related_spot_id(id, name),
          reactions(id, user_id, reaction_type),
          comments(id)`,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(newOffset, newOffset + limit - 1)

      if (error) throw error

      const enriched = data?.map((activity) => ({
        ...activity,
        user: activity.user as any,
        spot: activity.spot as any,
        reactions: activity.reactions as any,
        _count: {
          reactions: activity.reactions?.length || 0,
          comments: activity.comments?.length || 0,
        },
      })) || []

      setActivities((prev) => (newOffset === 0 ? enriched : [...prev, ...enriched]))
      setOffset(newOffset + limit)
      setHasMore(count ? newOffset + limit < count : false)
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      loadActivities(offset)
    }
  }

  return { activities, loading, hasMore, loadMore }
}
```

- [ ] **Step 2: Create activity feed component**

**File:** `src/components/social/activity-feed.tsx`

```typescript
'use client'

import { ActivityCard } from './activity-card'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useActivityFeed } from '@/hooks/use-activity-feed'

export function ActivityFeed() {
  const { activities, loading, hasMore, loadMore } = useActivityFeed(15)

  if (loading && activities.length === 0) {
    return (
      <div className="py-12 flex justify-center">
        <Loader />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="py-12 text-center text-muted">
        <p className="text-lg">No activity yet</p>
        <p className="text-sm mt-1">Follow tradies to see their discoveries and reviews</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}

      {hasMore && (
        <div className="py-6 text-center">
          <Button onClick={loadMore} disabled={loading} variant="secondary">
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create activity page**

**File:** `src/app/(app)/activity/page.tsx`

```typescript
import { Header } from '@/components/layout/header'
import { ActivityFeed } from '@/components/social/activity-feed'

export const metadata = {
  title: 'Activity - Gossoko',
  description: 'See what tradies are discovering and rating',
}

export default function ActivityPage() {
  return (
    <>
      <Header title="Activity Feed" subtitle="See what tradies are discovering" />

      <div className="container py-6">
        <ActivityFeed />
      </div>
    </>
  )
}
```

- [ ] **Step 4: Add activity creation function to social-actions**

**File:** `src/server/social-actions.ts` (append to existing file)

```typescript
export async function createActivity(
  activityType: string,
  content: string | null,
  relatedSpotId?: string,
  relatedUserId?: string,
  relatedRatingId?: string,
) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('activities')
    .insert({
      user_id: user.id,
      activity_type: activityType,
      content,
      related_spot_id: relatedSpotId,
      related_user_id: relatedUserId,
      related_rating_id: relatedRatingId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getActivityFeed(limit = 20, offset = 0) {
  const supabase = await createServerSupabaseClient()

  const { data, error, count } = await supabase
    .from('activities')
    .select(
      `*,
      user:user_id(id, full_name, avatar_url, trade_type),
      spot:related_spot_id(id, name),
      reactions(id, user_id, reaction_type),
      comments(id)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return { data: data || [], count }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/social/activity-feed.tsx src/hooks/use-activity-feed.ts src/app/\(app\)/activity/page.tsx src/server/social-actions.ts
git commit -m "feat: create activity feed page with real-time updates"
```

---

### Task 6: Implement Gamification and Badge System

**Files:**
- Create: `src/lib/gamification.ts`
- Create: `src/server/badge-actions.ts`
- Create: `src/components/gamification/badge-unlock-modal.tsx`

- [ ] **Step 1: Create gamification logic**

**File:** `src/lib/gamification.ts`

```typescript
import { GOSSOKO_BADGES } from '@/types/badges'

export interface BadgeUnlockResult {
  badgeId: string
  badgeName: string
  isNewUnlock: boolean
}

export async function checkAndUnlockBadges(userId: string, userStats: {
  reviewCount: number
  spotsFound: number
  earlyVisits: number
  trendingDiscoveries: number
  coffeeRatings: number
  reputationScore: number
}): Promise<BadgeUnlockResult[]> {
  const unlocks: BadgeUnlockResult[] = []

  // Top Feed Hunter: 10+ venue discoveries
  if (userStats.spotsFound >= 10) {
    const badge = GOSSOKO_BADGES.find(b => b.code === 'top_feed_hunter')
    if (badge) {
      unlocks.push({
        badgeId: badge.id,
        badgeName: badge.name,
        isNewUnlock: true,
      })
    }
  }

  // Coffee King: 20+ coffee ratings
  if (userStats.coffeeRatings >= 20) {
    const badge = GOSSOKO_BADGES.find(b => b.code === 'coffee_king')
    if (badge) {
      unlocks.push({
        badgeId: badge.id,
        badgeName: badge.name,
        isNewUnlock: true,
      })
    }
  }

  // Hidden Gem Finder: 5 trending discoveries
  if (userStats.trendingDiscoveries >= 5) {
    const badge = GOSSOKO_BADGES.find(b => b.code === 'hidden_gem_finder')
    if (badge) {
      unlocks.push({
        badgeId: badge.id,
        badgeName: badge.name,
        isNewUnlock: true,
      })
    }
  }

  // Early Bird: 10 early visits
  if (userStats.earlyVisits >= 10) {
    const badge = GOSSOKO_BADGES.find(b => b.code === 'early_bird')
    if (badge) {
      unlocks.push({
        badgeId: badge.id,
        badgeName: badge.name,
        isNewUnlock: true,
      })
    }
  }

  // Gossoko Legend: 1000+ reputation
  if (userStats.reputationScore >= 1000) {
    const badge = GOSSOKO_BADGES.find(b => b.code === 'gossoko_legend')
    if (badge) {
      unlocks.push({
        badgeId: badge.id,
        badgeName: badge.name,
        isNewUnlock: true,
      })
    }
  }

  return unlocks
}

export function calculateReputationScore(stats: {
  reviewCount: number
  reactionCount: number
  commentCount: number
  followerCount: number
  spotContributions: number
}): number {
  let score = 0

  // Base points for activities
  score += stats.reviewCount * 10 // 10 points per review
  score += stats.reactionCount * 1 // 1 point per reaction
  score += stats.commentCount * 3 // 3 points per comment
  score += stats.followerCount * 5 // 5 points per follower
  score += stats.spotContributions * 15 // 15 points per new spot

  return Math.max(0, score)
}
```

- [ ] **Step 2: Create badge server actions**

**File:** `src/server/badge-actions.ts`

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkAndUnlockBadges } from '@/lib/gamification'
import { GOSSOKO_BADGES } from '@/types/badges'

export async function initializeBadges() {
  const supabase = await createServerSupabaseClient()

  // Insert all badges (idempotent)
  for (const badge of GOSSOKO_BADGES) {
    await supabase
      .from('badges')
      .upsert({
        id: badge.id,
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon_emoji: badge.icon_emoji,
        unlock_condition: badge.unlock_condition,
      })
      .eq('code', badge.code)
  }
}

export async function getUserBadges(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badge:badge_id(*)')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })

  if (error) throw error
  return data
}

export async function unlockBadgeForUser(userId: string, badgeId: string) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('user_badges')
    .insert({
      user_id: userId,
      badge_id: badgeId,
    })
    .onConflict('user_id,badge_id')
    .ignore()

  if (error && error.code !== 'PGRST116') throw error // Ignore duplicate key error

  // Create notification
  await supabase.from('notifications').insert({
    user_id: userId,
    notification_type: 'badge_unlocked',
    related_activity_id: null,
  })
}

export async function checkUserBadgeProgress(userId: string) {
  const supabase = await createServerSupabaseClient()

  // Get user stats
  const [reviewsRes, spotsRes, badgesRes, reputationRes] = await Promise.all([
    supabase.from('ratings').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('spots').select('id', { count: 'exact' }).eq('created_by', userId),
    supabase.from('user_badges').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('users').select('reputation_score').eq('id', userId).single(),
  ])

  const stats = {
    reviewCount: reviewsRes.count || 0,
    spotsFound: spotsRes.count || 0,
    earlyVisits: 0, // Would need to check timestamps
    trendingDiscoveries: 0, // Would need engagement data
    coffeeRatings: 0, // Would need rating category data
    reputationScore: reputationRes.data?.reputation_score || 0,
  }

  // Check for unlocks
  const unlocks = await checkAndUnlockBadges(userId, stats)

  for (const unlock of unlocks) {
    if (unlock.isNewUnlock) {
      await unlockBadgeForUser(userId, unlock.badgeId)
    }
  }

  return unlocks
}
```

- [ ] **Step 3: Create badge unlock modal**

**File:** `src/components/gamification/badge-unlock-modal.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Badge } from '@/types/badges'

interface BadgeUnlockModalProps {
  isOpen: boolean
  badge: Badge | null
  onClose: () => void
}

export function BadgeUnlockModal({ isOpen, badge, onClose }: BadgeUnlockModalProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen && badge) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        onClose()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, badge, onClose])

  if (!badge || !show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div className="animate-bounce pointer-events-auto bg-gradient-to-b from-orange-500 to-orange-600 rounded-2xl p-8 text-center space-y-4 shadow-2xl max-w-xs">
        <div className="text-6xl">{badge.icon_emoji}</div>
        <h2 className="text-2xl font-bold text-white">Badge Unlocked!</h2>
        <p className="text-white font-bold">{badge.name}</p>
        <p className="text-orange-100 text-sm">{badge.description}</p>
        <div className="pt-2 animate-pulse">✨</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/gamification.ts src/server/badge-actions.ts src/components/gamification/badge-unlock-modal.tsx
git commit -m "feat: implement badge system and gamification logic"
```

---

### Task 7: Create Leaderboards Page

**Files:**
- Create: `src/components/leaderboard/leaderboard-table.tsx`
- Create: `src/server/leaderboard-actions.ts`
- Create: `src/app/(app)/leaderboards/page.tsx`
- Create: `src/app/(app)/leaderboards/best-in-[region]/page.tsx`

- [ ] **Step 1: Create leaderboard table component**

**File:** `src/components/leaderboard/leaderboard-table.tsx`

```typescript
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TRADE_TYPE_EMOJIS } from '@/types/profile'
import type { LeaderboardEntryWithUser } from '@/types/leaderboard'

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithUser[]
  title: string
  subtitle?: string
}

export function LeaderboardTable({ entries, title, subtitle }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-muted">No leaderboard data yet</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-light">{title}</h2>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-700">
          {entries.map((entry, index) => (
            <Link
              key={entry.id}
              href={`/profile/${entry.user_id}`}
              className="flex items-center gap-4 p-4 hover:bg-slate-700/50 transition-colors"
            >
              {/* Rank */}
              <div className="w-12 text-center">
                {index === 0 && <span className="text-2xl">🥇</span>}
                {index === 1 && <span className="text-2xl">🥈</span>}
                {index === 2 && <span className="text-2xl">🥉</span>}
                {index > 2 && <span className="text-lg font-bold text-muted">#{entry.rank}</span>}
              </div>

              {/* User Info */}
              <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-lg">
                {entry.user.avatar_url ? (
                  <Image src={entry.user.avatar_url} alt={entry.user.full_name || 'User'} fill className="object-cover" />
                ) : (
                  '👤'
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-light font-bold truncate">{entry.user.full_name || 'Unknown'}</p>
                  {entry.user.trade_type && (
                    <span className="text-lg flex-shrink-0">{TRADE_TYPE_EMOJIS[entry.user.trade_type as any]}</span>
                  )}
                </div>
                <Badge variant="default" className="text-xs mt-1">
                  {entry.score} points
                </Badge>
              </div>

              {/* Score */}
              <div className="text-right">
                <p className="text-lg font-bold text-orange-500">{entry.score}</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create leaderboard server actions**

**File:** `src/server/leaderboard-actions.ts`

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { LeaderboardEntryWithUser } from '@/types/leaderboard'

export async function getWeeklyLeaderboard(limit = 50) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*, user:user_id(*)')
    .eq('period', 'weekly')
    .isNull('region')
    .isNull('category')
    .order('rank')
    .limit(limit)

  if (error) throw error
  return (data as LeaderboardEntryWithUser[]) || []
}

export async function getAllTimeLeaderboard(limit = 50) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*, user:user_id(*)')
    .eq('period', 'alltime')
    .isNull('region')
    .isNull('category')
    .order('rank')
    .limit(limit)

  if (error) throw error
  return (data as LeaderboardEntryWithUser[]) || []
}

export async function getRegionalLeaderboard(region: string, limit = 50) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*, user:user_id(*)')
    .eq('period', 'weekly')
    .eq('region', region)
    .isNull('category')
    .order('rank')
    .limit(limit)

  if (error) throw error
  return (data as LeaderboardEntryWithUser[]) || []
}

export async function getCategoryLeaderboard(category: string, limit = 50) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*, user:user_id(*)')
    .eq('period', 'weekly')
    .eq('category', category)
    .isNull('region')
    .order('rank')
    .limit(limit)

  if (error) throw error
  return (data as LeaderboardEntryWithUser[]) || []
}
```

- [ ] **Step 3: Create leaderboards hub page**

**File:** `src/app/(app)/leaderboards/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LeaderboardTable } from '@/components/leaderboard/leaderboard-table'
import { getWeeklyLeaderboard } from '@/server/leaderboard-actions'
import { REGIONS, CATEGORIES } from '@/types/leaderboard'
import type { LeaderboardEntryWithUser } from '@/types/leaderboard'

export const metadata = {
  title: 'Leaderboards - Gossoko',
  description: 'Top tradies and venues',
}

export default function LeaderboardsPage() {
  const [topTradie, setTopTradie] = useState<LeaderboardEntryWithUser[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const data = await getWeeklyLeaderboard(5)
        setTopTradie(data)
      } finally {
        setLoading(false)
      }
    }

    loadLeaderboard()
  }, [])

  return (
    <>
      <Header title="Leaderboards" subtitle="Top tradies and venues" />

      <div className="container py-6 space-y-8">
        {/* Top This Week */}
        {topTradie && !loading && (
          <div>
            <LeaderboardTable
              entries={topTradie}
              title="🔥 Top This Week"
              subtitle="Fastest rising food hunters"
            />
          </div>
        )}

        {/* Regional Leaderboards */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-light">Regional Rankings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REGIONS.map((region) => (
              <Link key={region} href={`/leaderboards/best-in-${region.toLowerCase()}`}>
                <Card className="p-6 hover:border-orange-500 cursor-pointer transition-colors">
                  <div className="text-3xl mb-2">📍</div>
                  <h3 className="text-lg font-bold text-light">Best in {region}</h3>
                  <p className="text-sm text-muted mt-1">Top 50 tradies</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Category Leaderboards */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-light">Category Rankings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATEGORIES.map((category) => (
              <Card key={category} className="p-6">
                <h3 className="text-lg font-bold text-light">{category}</h3>
                <p className="text-sm text-muted mt-1">Best {category.toLowerCase()}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Create regional leaderboard page**

**File:** `src/app/(app)/leaderboards/best-in-[region]/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { LeaderboardTable } from '@/components/leaderboard/leaderboard-table'
import { getRegionalLeaderboard } from '@/server/leaderboard-actions'
import { REGIONS } from '@/types/leaderboard'
import type { LeaderboardEntryWithUser } from '@/types/leaderboard'
import { Loader } from '@/components/ui/loader'

export default function RegionalLeaderboardPage({ params }: { params: { region: string } }) {
  const [entries, setEntries] = useState<LeaderboardEntryWithUser[] | null>(null)
  const [loading, setLoading] = useState(true)

  const regionName = params.region
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const data = await getRegionalLeaderboard(regionName, 50)
        setEntries(data)
      } finally {
        setLoading(false)
      }
    }

    loadLeaderboard()
  }, [regionName])

  if (loading) {
    return (
      <>
        <Header title={`Best in ${regionName}`} />
        <div className="container py-12 flex justify-center">
          <Loader />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={`Best in ${regionName}`} subtitle="Top tradies this week" />

      <div className="container py-6">
        {entries && (
          <LeaderboardTable
            entries={entries}
            title={`Top Tradies in ${regionName}`}
            subtitle="Week of current date"
          />
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/leaderboard/ src/server/leaderboard-actions.ts src/app/\(app\)/leaderboards/
git commit -m "feat: create leaderboards with regional and category rankings"
```

---

### Task 8: Create Shareable Card Components

**Files:**
- Create: `src/lib/share-utils.ts`
- Create: `src/components/sharing/shareable-card.tsx`
- Create: `src/components/sharing/share-modal.tsx`

- [ ] **Step 1: Create share utilities**

**File:** `src/lib/share-utils.ts`

```typescript
export function generateShareableCardSVG(
  userName: string,
  trade: string,
  message: string,
  emoji: string,
): string {
  return `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="1200" height="630" fill="#0F172A"/>
      
      <!-- Accent bar -->
      <rect width="100" height="630" fill="#FF6B35"/>
      
      <!-- Header -->
      <text x="150" y="80" font-size="48" font-weight="bold" fill="#FF6B35" font-family="Arial">
        Gossoko
      </text>
      
      <!-- Message -->
      <text x="150" y="200" font-size="52" font-weight="bold" fill="#FFFFFF" font-family="Arial" text-anchor="start" word-spacing="10">
        ${message}
      </text>
      
      <!-- Emoji -->
      <text x="150" y="350" font-size="120" text-anchor="start">
        ${emoji}
      </text>
      
      <!-- User info -->
      <text x="150" y="480" font-size="32" font-weight="bold" fill="#FFFFFF" font-family="Arial">
        ${userName}
      </text>
      
      <text x="150" y="530" font-size="24" fill="#94A3B8" font-family="Arial">
        ${trade} • Found on Gossoko
      </text>
      
      <!-- Call to action -->
      <rect x="150" y="560" width="200" height="50" rx="10" fill="#FF6B35"/>
      <text x="250" y="595" font-size="20" font-weight="bold" fill="#0F172A" text-anchor="middle" font-family="Arial">
        Download Gossoko
      </text>
    </svg>
  `
}

export function downloadShareCard(svg: string, filename: string) {
  const link = document.createElement('a')
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  link.download = filename
  link.click()
}
```

- [ ] **Step 2: Create shareable card component**

**File:** `src/components/sharing/shareable-card.tsx`

```typescript
'use client'

import { Card } from '@/components/ui/card'
import type { UserProfile } from '@/types/profile'

interface ShareableCardProps {
  user: UserProfile
  message: string
  emoji: string
  onScreenshot?: () => void
}

export function ShareableCard({ user, message, emoji, onScreenshot }: ShareableCardProps) {
  return (
    <Card className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 p-8 space-y-6">
      {/* Accent bar on left */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-orange-600" />

      {/* Gossoko branding */}
      <div>
        <h1 className="text-3xl font-bold text-orange-500">Gossoko</h1>
      </div>

      {/* Message */}
      <div>
        <p className="text-3xl font-bold text-light leading-tight">{message}</p>
      </div>

      {/* Large emoji */}
      <div className="text-7xl">{emoji}</div>

      {/* User info */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-light">{user.full_name}</h2>
        <p className="text-muted text-lg">
          {user.trade_type ? user.trade_type.charAt(0).toUpperCase() + user.trade_type.slice(1) : 'Tradie'} •
          Found on Gossoko
        </p>
      </div>

      {/* CTA */}
      <div className="pt-4">
        <div className="inline-block bg-orange-500 text-slate-900 px-6 py-3 rounded-lg font-bold">
          Download Gossoko
        </div>
      </div>

      {onScreenshot && (
        <button
          onClick={onScreenshot}
          className="text-xs text-muted hover:text-light transition-colors"
        >
          📸 Screenshot this card
        </button>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: Create share modal**

**File:** `src/components/sharing/share-modal.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShareableCard } from './shareable-card'
import type { UserProfile } from '@/types/profile'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserProfile
  message: string
  emoji: string
}

export function ShareModal({ isOpen, onClose, user, message, emoji }: ShareModalProps) {
  const [sharing, setSharing] = useState(false)

  if (!isOpen) return null

  const handleShare = async (platform: 'twitter' | 'instagram' | 'facebook') => {
    setSharing(true)
    try {
      const shareText = `Check out ${message} on Gossoko! ${emoji}`

      if (platform === 'twitter') {
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
          '_blank',
        )
      } else if (platform === 'facebook') {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareText)}`,
          '_blank',
        )
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-light">Share Your Discovery</h2>
          <button
            onClick={onClose}
            className="text-2xl text-muted hover:text-light transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-center justify-center">
          <ShareableCard user={user} message={message} emoji={emoji} />

          <div className="space-y-3 w-full lg:w-auto">
            <Button
              variant="primary"
              onClick={() => handleShare('twitter')}
              loading={sharing}
              className="w-full"
            >
              Share on Twitter/X
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleShare('facebook')}
              loading={sharing}
              className="w-full"
            >
              Share on Facebook
            </Button>
            <Button
              variant="secondary"
              onClick={onClose}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted text-center">
          💡 Tip: Screenshot the card to share on Instagram Stories
        </p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/share-utils.ts src/components/sharing/
git commit -m "feat: create shareable cards optimized for social media"
```

---

### Task 9: Create Reputation and Notifications System

**Files:**
- Create: `src/lib/reputation.ts`
- Create: `src/server/notification-actions.ts`
- Create: `src/hooks/use-notifications.ts`

- [ ] **Step 1: Create reputation calculation logic**

**File:** `src/lib/reputation.ts`

```typescript
export interface ReputationBreakdown {
  reviewsPoints: number
  engagementPoints: number
  followerPoints: number
  contribPoints: number
  total: number
}

export function calculateUserReputation(stats: {
  reviewCount: number
  reactionsReceived: number
  commentsReceived: number
  followerCount: number
  spotContributions: number
  badgesCount: number
}): ReputationBreakdown {
  const reviewsPoints = stats.reviewCount * 10
  const engagementPoints = (stats.reactionsReceived * 1) + (stats.commentsReceived * 3)
  const followerPoints = Math.floor(stats.followerCount * 5)
  const contribPoints = (stats.spotContributions * 15) + (stats.badgesCount * 50)

  return {
    reviewsPoints,
    engagementPoints,
    followerPoints,
    contribPoints,
    total: reviewsPoints + engagementPoints + followerPoints + contribPoints,
  }
}

export function getReputationTier(score: number): {
  tier: string
  emoji: string
  nextMilestone: number
} {
  if (score >= 5000) return { tier: 'Gossoko Royalty', emoji: '👑', nextMilestone: Infinity }
  if (score >= 2000) return { tier: 'Gossoko Legend', emoji: '🌟', nextMilestone: 5000 }
  if (score >= 1000) return { tier: 'Gossoko Master', emoji: '⭐', nextMilestone: 2000 }
  if (score >= 500) return { tier: 'Gossoko Pro', emoji: '🎖️', nextMilestone: 1000 }
  if (score >= 200) return { tier: 'Gossoko Regular', emoji: '🏅', nextMilestone: 500 }
  if (score >= 50) return { tier: 'Gossoko Explorer', emoji: '🧭', nextMilestone: 200 }
  return { tier: 'New Tradie', emoji: '🌱', nextMilestone: 50 }
}
```

- [ ] **Step 2: Create notification server actions**

**File:** `src/server/notification-actions.ts`

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function getNotifications(limit = 20) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notifications')
    .select(
      `*,
      from_user:from_user_id(id, full_name, avatar_url, trade_type),
      activity:related_activity_id(id, content, activity_type)`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) throw error
}

export async function markAllNotificationsAsRead() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) throw error
}

export async function createNotification(
  userId: string,
  notificationType: string,
  fromUserId?: string,
  relatedActivityId?: string,
) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      notification_type: notificationType,
      from_user_id: fromUserId,
      related_activity_id: relatedActivityId,
    })

  if (error) throw error
}

export async function getUnreadNotificationsCount() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return 0
  return count || 0
}
```

- [ ] **Step 3: Create notifications hook**

**File:** `src/hooks/use-notifications.ts`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setUnreadCount(0)
          setLoading(false)
          return
        }

        const { count, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('is_read', false)

        if (!error) {
          setUnreadCount(count || 0)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUnreadCount()

    // Subscribe to real-time notification changes
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchUnreadCount()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return { unreadCount, loading }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/reputation.ts src/server/notification-actions.ts src/hooks/use-notifications.ts
git commit -m "feat: implement reputation system and real-time notifications"
```

---

### Task 10: Final Polish and Testing

**Files:**
- Create: `src/styles/community.css` (for animations)
- Modify: `src/app/layout.tsx` (add notification context)

- [ ] **Step 1: Add community styles**

**File:** `src/styles/community.css`

```css
/* Badge unlock animation */
@keyframes badge-unlock {
  0% {
    transform: scale(0) rotate(-45deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

.badge-unlock {
  animation: badge-unlock 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Leaderboard rank pulse */
@keyframes rank-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(255, 107, 53, 0);
  }
}

.rank-pulse {
  animation: rank-pulse 2s infinite;
}

/* Shareable card glow */
@keyframes card-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 107, 53, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(255, 107, 53, 0.6);
  }
}

.shareable-card:hover {
  animation: card-glow 2s ease-in-out infinite;
}

/* Notification toast slide */
@keyframes notification-slide {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification-toast {
  animation: notification-slide 0.3s ease-out;
}
```

- [ ] **Step 2: Add community CSS to globals**

**File:** `src/styles/globals.css` (append)

```css
@import './community.css';
```

- [ ] **Step 3: Verify all components and pages work**

Run through checklist:
- [ ] Profile pages load without errors
- [ ] Follow button works and updates counts
- [ ] Activity feed shows recent activities
- [ ] Badges display correctly
- [ ] Leaderboards load regional data
- [ ] Shareable cards render for screenshots
- [ ] Notifications badge appears in header

- [ ] **Step 4: Commit all changes**

```bash
git add src/styles/community.css src/styles/globals.css
git commit -m "feat: add community animations and finalize community platform"
```

---

## Spec Coverage Check

✅ **User profiles** - Task 2 (profile pages with trade types, bios, badges)
✅ **Trade tags** - Task 2 (8 trade types with emojis)
✅ **Follow system** - Task 3 (follow/unfollow with counts)
✅ **Activity feed** - Task 5 (viral-style cards with real-time updates)
✅ **Comment system** - Task 4 (reaction buttons with real-time)
✅ **Like/react system** - Task 4 (4 reaction types)
✅ **Tradie badges** - Task 6 (5 gamified badges)
✅ **Leaderboards** - Task 7 (weekly, regional, category)
✅ **Weekly rankings** - Task 7 (week-based leaderboards)
✅ **Gamification** - Task 6 (badge unlock system)
✅ **Notifications** - Task 9 (real-time notification system)
✅ **Reputation system** - Task 9 (reputation scoring by tier)
✅ **Regional rankings** - Task 7 (Brisbane, Gold Coast, etc.)
✅ **Shareable UI cards** - Task 8 (social media optimized)
✅ **Authentic Aussie tone** - All components (blue collar, fun, authentic)
✅ **Not corporate/polished** - Design intentionally feels alive and user-driven

---

## Execution Handoff

Plan complete and saved to `gossoko-community-plan.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach would you prefer?**