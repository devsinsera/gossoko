# Gossoko App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web app for Australian tradies to discover, rate, and share food venues (gossoko bars, cafes, food trucks, bakeries, servos, gossoko vans).

**Architecture:** 
- Next.js 15 with App Router for fast, SEO-friendly frontend
- Supabase (PostgreSQL + Auth) as backend/database
- Tailwind CSS with dark mode default and safety orange accents
- Component-driven UI with reusable, focused components
- Server actions for API layer (secure, type-safe)
- Mobile-first responsive design with industrial aesthetic

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase (Auth + PostgreSQL), Zod for validation

---

## File Structure

```
gossoko/
├── .env.local                          # Supabase keys, Auth URLs
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── .gitignore
├── public/
│   ├── logo.svg                        # Placeholder logo
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with providers
│   │   ├── page.tsx                    # Landing page
│   │   ├── (auth)/
│   │   │   ├── layout.tsx              # Auth layout wrapper
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── onboarding/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx              # Main app layout with nav
│   │       ├── feed/page.tsx           # Home feed
│   │       ├── map/page.tsx            # Map view
│   │       ├── add-spot/page.tsx       # Add new venue
│   │       ├── rankings/page.tsx       # Venue rankings
│   │       └── profile/page.tsx        # User profile
│   ├── components/
│   │   ├── ui/                         # Reusable base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── rating.tsx
│   │   │   └── loader.tsx
│   │   ├── layout/
│   │   │   ├── bottom-nav.tsx          # Mobile nav tabs
│   │   │   ├── header.tsx              # App header
│   │   │   └── layout-wrapper.tsx      # Main layout container
│   │   ├── feed/
│   │   │   └── spot-card.tsx           # Venue card for feed
│   │   ├── forms/
│   │   │   ├── login-form.tsx
│   │   │   ├── signup-form.tsx
│   │   │   └── add-spot-form.tsx
│   │   └── theme-toggle.tsx
│   ├── hooks/
│   │   ├── use-auth.ts                 # Auth context hook
│   │   ├── use-spots.ts                # Data fetching for venues
│   │   └── use-ratings.ts              # User ratings hook
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client config
│   │   ├── supabase-server.ts          # Server-side Supabase
│   │   └── utils.ts                    # Helper functions
│   ├── types/
│   │   ├── index.ts                    # Shared types
│   │   └── database.ts                 # Supabase-generated types
│   ├── styles/
│   │   └── globals.css                 # Global styles, Tailwind directives
│   ├── context/
│   │   └── auth-context.tsx            # Auth state management
│   └── server/
│       └── actions.ts                  # Server actions (API layer)
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql      # Database setup
        └── 002_seed_data.sql           # Sample data (optional)
```

---

## Task Breakdown

### Task 1: Initialize Next.js 15 Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Create Next.js 15 project**

```bash
npx create-next-app@latest gossoko --typescript --tailwind --app --no-eslint --src-dir
cd gossoko
```

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs zod lucide-react clsx class-variance-authority
npm install --save-dev typescript @types/node @types/react
```

- [ ] **Step 3: Configure TypeScript strict mode**

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "allowJs": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Setup environment variables**

**File:** `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

- [ ] **Step 5: Setup .gitignore**

**File:** `.gitignore`

```
node_modules/
.next/
.env.local
.env.local.backup
.DS_Store
*.log
dist/
.supabase/
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 15 project with Supabase and Tailwind"
```

---

### Task 2: Configure Tailwind CSS with Dark Mode and Brand Colors

**Files:**
- Create: `tailwind.config.ts`
- Create: `src/styles/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Configure Tailwind with custom theme**

**File:** `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          500: '#FF6B35',  // Safety orange (primary brand)
          600: '#E55A1F',
          700: '#CC4413',
        },
        slate: {
          900: '#0F172A',
          950: '#030712',
        },
      },
      backgroundColor: {
        dark: '#0F172A',
        'dark-secondary': '#1E293B',
      },
      textColor: {
        'light': '#F1F5F9',
        'muted': '#94A3B8',
      },
      fontSize: {
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      borderRadius: {
        'lg': '0.5rem',
        'xl': '0.75rem',
      },
      spacing: {
        'safe-bottom': 'max(1rem, env(safe-area-inset-bottom))',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 2: Write global styles**

**File:** `src/styles/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  @apply scroll-smooth;
}

body {
  @apply bg-slate-900 text-light antialiased;
}

/* Dark mode default (always on) */
:root {
  color-scheme: dark;
}

.container {
  @apply mx-auto px-4 max-w-2xl;
}

.safe-area-inset-bottom {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

/* Smooth transitions */
* {
  @apply transition-colors duration-200;
}

button, a {
  @apply outline-none;
}

/* Remove input number spinner */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}
```

- [ ] **Step 3: Create root layout with Tailwind provider**

**File:** `src/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import './styles/globals.css'

export const metadata: Metadata = {
  title: 'Gossoko - Find the Best Gossoko Near the Worksite',
  description: 'Discover and rate the best food spots for tradies - snack bars, cafes, food trucks, bakeries, servos, and gossoko vans.',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-light">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/styles/globals.css src/app/layout.tsx
git commit -m "feat: configure Tailwind CSS with dark mode and brand colors"
```

---

### Task 3: Setup Supabase Client and Database Schema

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/supabase-server.ts`
- Create: `src/types/database.ts`
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create Supabase client (browser)**

**File:** `src/lib/supabase.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 2: Create Supabase server client**

**File:** `src/lib/supabase-server.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions),
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 3: Define TypeScript database types**

**File:** `src/types/database.ts`

```typescript
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          updated_at?: string
        }
      }
      spots: {
        Row: {
          id: string
          name: string
          description: string | null
          type: 'gossoko_bar' | 'cafe' | 'food_truck' | 'bakery' | 'servo' | 'gossoko_van'
          latitude: number
          longitude: number
          address: string
          phone: string | null
          website: string | null
          image_url: string | null
          created_by: string
          created_at: string
          updated_at: string
          rating_count: number
          average_rating: number
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          type: 'gossoko_bar' | 'cafe' | 'food_truck' | 'bakery' | 'servo' | 'gossoko_van'
          latitude: number
          longitude: number
          address: string
          phone?: string | null
          website?: string | null
          image_url?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          rating_count?: number
          average_rating?: number
        }
        Update: {
          name?: string
          description?: string | null
          type?: 'gossoko_bar' | 'cafe' | 'food_truck' | 'bakery' | 'servo' | 'gossoko_van'
          latitude?: number
          longitude?: number
          address?: string
          phone?: string | null
          website?: string | null
          image_url?: string | null
          updated_at?: string
          rating_count?: number
          average_rating?: number
        }
      }
      ratings: {
        Row: {
          id: string
          spot_id: string
          user_id: string
          score: number
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          spot_id: string
          user_id: string
          score: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          score?: number
          comment?: string | null
          updated_at?: string
        }
      }
    }
  }
}
```

- [ ] **Step 4: Create SQL migration**

**File:** `supabase/migrations/001_initial_schema.sql`

```sql
-- Create users table (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create spots table
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null check (type in ('gossoko_bar', 'cafe', 'food_truck', 'bakery', 'servo', 'gossoko_van')),
  latitude numeric not null,
  longitude numeric not null,
  address text not null,
  phone text,
  website text,
  image_url text,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  rating_count integer default 0 not null,
  average_rating numeric default 0 not null
);

-- Create ratings table
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  score integer not null check (score >= 1 and score <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(spot_id, user_id)
);

-- Create indexes for performance
create index spots_created_by_idx on public.spots(created_by);
create index spots_type_idx on public.spots(type);
create index spots_location_idx on public.spots(latitude, longitude);
create index ratings_spot_id_idx on public.ratings(spot_id);
create index ratings_user_id_idx on public.ratings(user_id);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.spots enable row level security;
alter table public.ratings enable row level security;

-- RLS Policies
-- Users can read their own data and public profiles
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can read all profiles"
  on public.users for select
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Anyone can read spots
create policy "Spots are publicly readable"
  on public.spots for select
  using (true);

-- Users can create spots
create policy "Users can create spots"
  on public.spots for insert
  with check (auth.uid() = created_by);

-- Users can update own spots
create policy "Users can update own spots"
  on public.spots for update
  using (auth.uid() = created_by);

-- Anyone can read ratings
create policy "Ratings are publicly readable"
  on public.ratings for select
  using (true);

-- Users can create ratings
create policy "Users can create ratings"
  on public.ratings for insert
  with check (auth.uid() = user_id);

-- Users can update own ratings
create policy "Users can update own ratings"
  on public.ratings for update
  using (auth.uid() = user_id);

-- Users can delete own ratings
create policy "Users can delete own ratings"
  on public.ratings for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 5: Create index.ts for type exports**

**File:** `src/types/index.ts`

```typescript
export type { Database } from './database'

export type Spot = Database['public']['Tables']['spots']['Row']
export type SpotInsert = Database['public']['Tables']['spots']['Insert']
export type SpotUpdate = Database['public']['Tables']['spots']['Update']

export type Rating = Database['public']['Tables']['ratings']['Row']
export type RatingInsert = Database['public']['Tables']['ratings']['Insert']

export type User = Database['public']['Tables']['users']['Row']

export type SpotType = 'gossoko_bar' | 'cafe' | 'food_truck' | 'bakery' | 'servo' | 'gossoko_van'
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase-server.ts src/types/ supabase/
git commit -m "feat: setup Supabase client and database schema"
```

---

### Task 4: Create Auth Context and Login/Signup Logic

**Files:**
- Create: `src/context/auth-context.tsx`
- Create: `src/hooks/use-auth.ts`
- Create: `src/server/actions.ts`

- [ ] **Step 1: Create Auth Context**

**File:** `src/context/auth-context.tsx`

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) throw error

    // Create user profile
    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        email,
        full_name: fullName,
      })
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}
```

- [ ] **Step 2: Create useAuth hook**

**File:** `src/hooks/use-auth.ts`

```typescript
'use client'

import { useAuthContext } from '@/context/auth-context'

export function useAuth() {
  return useAuthContext()
}
```

- [ ] **Step 3: Create server actions for data fetching**

**File:** `src/server/actions.ts`

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Spot, Rating } from '@/types'

export async function getSpots(limit = 20, offset = 0) {
  const supabase = await createServerSupabaseClient()

  const { data, error, count } = await supabase
    .from('spots')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return { data: data as Spot[], count }
}

export async function getSpotById(id: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Spot
}

export async function getRatingsForSpot(spotId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Rating[]
}

export async function getTopRatedSpots(limit = 10) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .order('average_rating', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as Spot[]
}

export async function createSpot(spot: {
  name: string
  description: string | null
  type: string
  latitude: number
  longitude: number
  address: string
  phone: string | null
  website: string | null
  image_url: string | null
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('spots')
    .insert({
      ...spot,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as Spot
}

export async function createRating(spotId: string, score: number, comment: string | null) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('ratings')
    .insert({
      spot_id: spotId,
      user_id: user.id,
      score,
      comment,
    })
    .select()
    .single()

  if (error) throw error

  // Update spot average rating
  await updateSpotRating(spotId)

  return data as Rating
}

async function updateSpotRating(spotId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: ratings, error: ratingsError } = await supabase
    .from('ratings')
    .select('score')
    .eq('spot_id', spotId)

  if (ratingsError) return

  const average = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : 0

  await supabase
    .from('spots')
    .update({
      average_rating: average,
      rating_count: ratings.length,
    })
    .eq('id', spotId)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/context/auth-context.tsx src/hooks/use-auth.ts src/server/actions.ts
git commit -m "feat: create auth context and server actions"
```

---

### Task 5: Create Reusable UI Components (Base Library)

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/rating.tsx`
- Create: `src/components/ui/loader.tsx`

- [ ] **Step 1: Create Button component**

**File:** `src/components/ui/button.tsx`

```typescript
import clsx from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'font-medium rounded-lg transition-colors duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700',
    secondary: 'bg-slate-700 text-light hover:bg-slate-600 active:bg-slate-500',
    ghost: 'text-light hover:bg-slate-800 active:bg-slate-700',
  }

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg w-full',
  }

  return (
    <button
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="inline-block animate-spin">⌛</span> : children}
    </button>
  )
}
```

- [ ] **Step 2: Create Card component**

**File:** `src/components/ui/card.tsx`

```typescript
import clsx from 'clsx'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated'
}

export function Card({ variant = 'default', className, ...props }: CardProps) {
  const variants = {
    default: 'bg-slate-800 border border-slate-700',
    elevated: 'bg-slate-800 shadow-lg',
  }

  return (
    <div
      className={clsx('rounded-lg p-4', variants[variant], className)}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Create Input component**

**File:** `src/components/ui/input.tsx`

```typescript
import clsx from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-2 text-light">{label}</label>}
      <input
        className={clsx(
          'w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-light placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create Badge component**

**File:** `src/components/ui/badge.tsx`

```typescript
import clsx from 'clsx'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'orange' | 'success' | 'warning'
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-slate-700 text-light',
    orange: 'bg-orange-500/20 text-orange-400',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
  }

  return (
    <span
      className={clsx('inline-block px-3 py-1 rounded-full text-xs font-medium', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 5: Create Rating component**

**File:** `src/components/ui/rating.tsx`

```typescript
interface RatingProps {
  score: number
  maxScore?: number
  interactive?: boolean
  onChange?: (score: number) => void
}

export function Rating({ score, maxScore = 5, interactive = false, onChange }: RatingProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxScore }).map((_, i) => {
        const starScore = i + 1
        const isFilled = starScore <= Math.round(score)

        return (
          <button
            key={i}
            onClick={() => interactive && onChange?.(starScore)}
            disabled={!interactive}
            className={`text-2xl transition-transform ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
            type="button"
          >
            {isFilled ? '⭐' : '☆'}
          </button>
        )
      })}
      <span className="ml-2 text-sm text-muted">{score.toFixed(1)}</span>
    </div>
  )
}
```

- [ ] **Step 6: Create Loader component**

**File:** `src/components/ui/loader.tsx`

```typescript
export function Loader() {
  return (
    <div className="flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat: create reusable UI component library"
```

---

### Task 6: Create Layout Components (Header, Nav, Container)

**Files:**
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/bottom-nav.tsx`
- Create: `src/components/layout/layout-wrapper.tsx`

- [ ] **Step 1: Create Header component**

**File:** `src/components/layout/header.tsx`

```typescript
import clsx from 'clsx'

interface HeaderProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
}

export function Header({ title, subtitle, showBack = false, onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700">
      <div className="container flex items-center justify-between py-4">
        {showBack && (
          <button
            onClick={onBack}
            className="text-light hover:text-orange-500 transition-colors"
          >
            ← Back
          </button>
        )}
        <div className={clsx(!showBack && 'flex-1')}>
          {title && <h1 className="text-2xl font-bold text-light">{title}</h1>}
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create Bottom Navigation component**

**File:** `src/components/layout/bottom-nav.tsx`

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const navItems = [
  { href: '/feed', label: 'Feed', icon: '📰' },
  { href: '/map', label: 'Map', icon: '🗺️' },
  { href: '/add-spot', label: 'Add', icon: '➕' },
  { href: '/rankings', label: 'Rankings', icon: '🏆' },
  { href: '/profile', label: 'Profile', icon: '👤' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 safe-area-inset-bottom">
      <div className="container flex justify-between items-center h-16 px-2">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors text-xs font-medium',
                isActive
                  ? 'text-orange-500 bg-slate-700'
                  : 'text-muted hover:text-light',
              )}
            >
              <span className="text-xl mb-1">{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Create Layout Wrapper component**

**File:** `src/components/layout/layout-wrapper.tsx`

```typescript
import { BottomNav } from './bottom-nav'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <main className="flex-1 pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/
git commit -m "feat: create layout components (header, nav, wrapper)"
```

---

### Task 7: Create Auth Pages (Login, Signup, Onboarding)

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/onboarding/page.tsx`
- Create: `src/components/forms/login-form.tsx`
- Create: `src/components/forms/signup-form.tsx`

- [ ] **Step 1: Create Auth Layout**

**File:** `src/app/(auth)/layout.tsx`

```typescript
import { AuthProvider } from '@/context/auth-context'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {children}
      </div>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Create Login Form component**

**File:** `src/components/forms/login-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

export function LoginForm() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      router.push('/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
      <h1 className="text-3xl font-bold text-light text-center">Gossoko</h1>
      <p className="text-center text-muted">Find the best gossoko near the worksite</p>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Button size="lg" loading={loading}>
        Sign In
      </Button>

      <div className="text-center text-sm text-muted">
        Don't have an account?{' '}
        <a href="/signup" className="text-orange-500 hover:text-orange-400">
          Sign up
        </a>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create Signup Form component**

**File:** `src/components/forms/signup-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

export function SignupForm() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  })
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      await signUp(formData.email, formData.password, formData.fullName)
      router.push('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
      <h1 className="text-3xl font-bold text-light text-center">Join Gossoko</h1>
      <p className="text-center text-muted">Create your account</p>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <Input
        label="Full Name"
        type="text"
        placeholder="John Doe"
        name="fullName"
        value={formData.fullName}
        onChange={handleChange}
        required
      />

      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        name="email"
        value={formData.email}
        onChange={handleChange}
        required
      />

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        name="password"
        value={formData.password}
        onChange={handleChange}
        required
      />

      <Input
        label="Confirm Password"
        type="password"
        placeholder="••••••••"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        required
      />

      <Button size="lg" loading={loading}>
        Create Account
      </Button>

      <div className="text-center text-sm text-muted">
        Already have an account?{' '}
        <a href="/login" className="text-orange-500 hover:text-orange-400">
          Sign in
        </a>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Create Login page**

**File:** `src/app/(auth)/login/page.tsx`

```typescript
import { LoginForm } from '@/components/forms/login-form'

export const metadata = {
  title: 'Login - Gossoko',
  description: 'Sign in to your Gossoko account',
}

export default function LoginPage() {
  return <LoginForm />
}
```

- [ ] **Step 5: Create Signup page**

**File:** `src/app/(auth)/signup/page.tsx`

```typescript
import { SignupForm } from '@/components/forms/signup-form'

export const metadata = {
  title: 'Sign Up - Gossoko',
  description: 'Create your Gossoko account',
}

export default function SignupPage() {
  return <SignupForm />
}
```

- [ ] **Step 6: Create Onboarding page**

**File:** `src/app/(auth)/onboarding/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const handleComplete = () => {
    router.push('/feed')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {step === 1 && (
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold text-light">Welcome to Gossoko</h1>
            <p className="text-muted text-lg">Find the best gossoko near the worksite</p>
            <Button size="lg" onClick={() => setStep(2)}>
              Get Started
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-light text-center">How it works</h2>
            <ul className="space-y-4 text-light">
              <li className="flex gap-3">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="font-semibold">Find spots</p>
                  <p className="text-sm text-muted">Browse nearby food spots on the map</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <p className="font-semibold">Rate and review</p>
                  <p className="text-sm text-muted">Share your experience with the community</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-2xl">➕</span>
                <div>
                  <p className="font-semibold">Add new spots</p>
                  <p className="text-sm text-muted">Found a hidden gem? Add it for others</p>
                </div>
              </li>
            </ul>
            <Button size="lg" onClick={handleComplete}>
              Start Exploring
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/ src/components/forms/
git commit -m "feat: create authentication pages and forms"
```

---

### Task 8: Create Main App Layout with Auth Guard

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update Root Layout with AuthProvider**

**File:** `src/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import './styles/globals.css'
import { AuthProvider } from '@/context/auth-context'

export const metadata: Metadata = {
  title: 'Gossoko - Find the Best Gossoko Near the Worksite',
  description: 'Discover and rate the best food spots for tradies - snack bars, cafes, food trucks, bakeries, servos, and gossoko vans.',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-light">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create App Layout with Navigation and Auth Guard**

**File:** `src/app/(app)/layout.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { LayoutWrapper } from '@/components/layout/layout-wrapper'
import { Loader } from '@/components/ui/loader'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <LayoutWrapper>{children}</LayoutWrapper>
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: add AuthProvider and app layout with auth guard"
```

---

### Task 9: Create Landing Page

**Files:**
- Create: `src/app/page.tsx`

- [ ] **Step 1: Create Landing Page**

**File:** `src/app/page.tsx`

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Gossoko - Find the Best Gossoko Near the Worksite',
  description: 'Discover and rate the best food spots for tradies',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700">
        <div className="container py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-orange-500">Gossoko</h1>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="ghost" size="md">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="md">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 text-center space-y-8">
        <h2 className="text-5xl font-bold text-light">
          Find the best gossoko near the worksite
        </h2>
        <p className="text-xl text-muted max-w-2xl mx-auto">
          Discover top-rated snack bars, cafes, food trucks, bakeries, servos, and gossoko vans.
          Rate your favorite spots and share with the community.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg">
              Join Gossoko
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center space-y-3">
            <div className="text-4xl">📍</div>
            <h3 className="text-xl font-bold text-light">Find Spots</h3>
            <p className="text-muted">Browse nearby food locations on an interactive map</p>
          </div>
          <div className="text-center space-y-3">
            <div className="text-4xl">⭐</div>
            <h3 className="text-xl font-bold text-light">Rate & Review</h3>
            <p className="text-muted">Share your experience and help the community discover great spots</p>
          </div>
          <div className="text-center space-y-3">
            <div className="text-4xl">➕</div>
            <h3 className="text-xl font-bold text-light">Add Spots</h3>
            <p className="text-muted">Found a hidden gem? Add it to the map for everyone</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 text-center space-y-6">
        <h3 className="text-3xl font-bold text-light">Ready to explore?</h3>
        <Link href="/signup">
          <Button size="lg">
            Get Started for Free
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-20">
        <div className="container py-8 text-center text-muted text-sm">
          <p>© 2024 Gossoko. Built for Australian tradies.</p>
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: create landing page with CTA"
```

---

### Task 10: Create Home Feed Page and Spot Card

**Files:**
- Create: `src/components/feed/spot-card.tsx`
- Create: `src/app/(app)/feed/page.tsx`

- [ ] **Step 1: Create Spot Card component**

**File:** `src/components/feed/spot-card.tsx`

```typescript
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Rating } from '@/components/ui/rating'
import type { Spot } from '@/types'

const spotTypeLabels: Record<string, string> = {
  gossoko_bar: 'Gossoko Bar',
  cafe: 'Cafe',
  food_truck: 'Food Truck',
  bakery: 'Bakery',
  servo: 'Servo',
  gossoko_van: 'Gossoko Van',
}

const spotTypeEmojis: Record<string, string> = {
  gossoko_bar: '🏢',
  cafe: '☕',
  food_truck: '🚚',
  bakery: '🥐',
  servo: '⛽',
  gossoko_van: '🚐',
}

export function SpotCard({ spot }: { spot: Spot }) {
  return (
    <Link href={`/spot/${spot.id}`}>
      <Card className="hover:border-orange-500 cursor-pointer transition-all hover:shadow-lg">
        {spot.image_url && (
          <div className="w-full h-40 bg-slate-700 rounded-lg mb-4 overflow-hidden">
            <img
              src={spot.image_url}
              alt={spot.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold text-light flex-1">{spot.name}</h3>
            <Badge variant="orange">{spotTypeEmojis[spot.type]} {spotTypeLabels[spot.type]}</Badge>
          </div>

          {spot.description && (
            <p className="text-sm text-muted line-clamp-2">{spot.description}</p>
          )}

          <p className="text-sm text-muted">{spot.address}</p>

          <div className="flex items-center justify-between pt-2 border-t border-slate-700">
            <Rating score={spot.average_rating} />
            <span className="text-xs text-muted">{spot.rating_count} reviews</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Create Feed page with infinite scroll foundation**

**File:** `src/app/(app)/feed/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { SpotCard } from '@/components/feed/spot-card'
import { Loader } from '@/components/ui/loader'
import { getSpots } from '@/server/actions'
import type { Spot } from '@/types'

export default function FeedPage() {
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  const LIMIT = 10

  useEffect(() => {
    loadSpots(0)
  }, [])

  async function loadSpots(newOffset: number) {
    try {
      setLoading(true)
      const { data, count } = await getSpots(LIMIT, newOffset)
      setSpots((prev) => (newOffset === 0 ? data : [...prev, ...data]))
      setOffset(newOffset + LIMIT)
      setHasMore(count ? newOffset + LIMIT < count : false)
    } catch (error) {
      console.error('Failed to load spots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadSpots(offset)
    }
  }

  return (
    <>
      <Header title="Gossoko Feed" subtitle="Discover nearby spots" />

      <div className="container py-6 space-y-4">
        {spots.length === 0 && loading ? (
          <div className="py-12 flex justify-center">
            <Loader />
          </div>
        ) : spots.length === 0 ? (
          <div className="py-12 text-center text-muted">
            <p>No spots found. Check back soon or add one yourself!</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {spots.map((spot) => (
                <SpotCard key={spot.id} spot={spot} />
              ))}
            </div>

            {hasMore && (
              <div className="py-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/spot-card.tsx src/app/\(app\)/feed/page.tsx
git commit -m "feat: create home feed with spot cards"
```

---

### Task 11: Create Map, Add Spot, Rankings, and Profile Skeleton Pages

**Files:**
- Create: `src/app/(app)/map/page.tsx`
- Create: `src/app/(app)/add-spot/page.tsx`
- Create: `src/app/(app)/rankings/page.tsx`
- Create: `src/app/(app)/profile/page.tsx`

- [ ] **Step 1: Create Map page skeleton**

**File:** `src/app/(app)/map/page.tsx`

```typescript
import { Header } from '@/components/layout/header'

export const metadata = {
  title: 'Map - Gossoko',
  description: 'Find spots near you on the map',
}

export default function MapPage() {
  return (
    <>
      <Header title="Map" subtitle="Find spots near you" />
      <div className="container py-12 text-center text-muted">
        <p className="text-lg">Map view coming soon</p>
        <p className="text-sm mt-2">Interactive map with location-based discovery</p>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Create Add Spot page skeleton**

**File:** `src/app/(app)/add-spot/page.tsx`

```typescript
import { Header } from '@/components/layout/header'

export const metadata = {
  title: 'Add Spot - Gossoko',
  description: 'Add a new food spot',
}

export default function AddSpotPage() {
  return (
    <>
      <Header title="Add a Spot" subtitle="Share a food spot with the community" />
      <div className="container py-12 text-center text-muted">
        <p className="text-lg">Add spot form coming soon</p>
        <p className="text-sm mt-2">Submit your favorite gossoko location</p>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Create Rankings page skeleton**

**File:** `src/app/(app)/rankings/page.tsx`

```typescript
import { Header } from '@/components/layout/header'

export const metadata = {
  title: 'Rankings - Gossoko',
  description: 'Top-rated food spots',
}

export default function RankingsPage() {
  return (
    <>
      <Header title="Top Spots" subtitle="Highest rated near you" />
      <div className="container py-12 text-center text-muted">
        <p className="text-lg">Rankings coming soon</p>
        <p className="text-sm mt-2">See the best-rated spots in your area</p>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Create Profile page skeleton**

**File:** `src/app/(app)/profile/page.tsx`

```typescript
'use client'

import { useAuth } from '@/hooks/use-auth'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function ProfilePage() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <>
      <Header title="Profile" />

      <div className="container py-6 space-y-6">
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-light">{user?.email}</h2>
            <p className="text-sm text-muted">Account</p>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="font-bold text-light">Your Activity</h3>
            <p className="text-sm text-muted mt-2">Your spots and ratings will appear here</p>
          </div>
        </Card>

        <Button variant="secondary" size="lg" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/map/page.tsx src/app/\(app\)/add-spot/page.tsx src/app/\(app\)/rankings/page.tsx src/app/\(app\)/profile/page.tsx
git commit -m "feat: create skeleton pages for map, add-spot, rankings, profile"
```

---

### Task 12: Create Utility Helpers and Final Polish

**Files:**
- Create: `src/lib/utils.ts`
- Modify: `public/` with logo placeholder

- [ ] **Step 1: Create utility functions**

**File:** `src/lib/utils.ts`

```typescript
export function formatDistance(value: number): string {
  if (value < 1000) return `${Math.round(value)}m`
  return `${(value / 1000).toFixed(1)}km`
}

export function formatTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function spotTypeToColor(type: string): string {
  const colors: Record<string, string> = {
    gossoko_bar: 'bg-blue-500',
    cafe: 'bg-amber-600',
    food_truck: 'bg-red-500',
    bakery: 'bg-yellow-500',
    servo: 'bg-green-500',
    gossoko_van: 'bg-purple-500',
  }
  return colors[type] || 'bg-slate-500'
}
```

- [ ] **Step 2: Create placeholder logo SVG**

**File:** `public/logo.svg`

```xml
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#0F172A"/>
  <circle cx="100" cy="100" r="80" fill="#FF6B35"/>
  <text x="100" y="120" font-size="60" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">S</text>
</svg>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts public/logo.svg
git commit -m "feat: add utility helpers and logo placeholder"
```

---

### Task 13: Setup Next.js Configuration and Environment

**Files:**
- Modify: `next.config.ts`
- Modify: `.env.local`

- [ ] **Step 1: Configure Next.js**

**File:** `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com'],
  },
  reactStrictMode: true,
  swcMinify: true,
}

export default nextConfig
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat: configure Next.js image optimization"
```

---

### Task 14: Database Seeding and Final Testing

**Files:**
- Create: `supabase/migrations/002_seed_data.sql`

- [ ] **Step 1: Create seed data migration**

**File:** `supabase/migrations/002_seed_data.sql`

```sql
-- Seed sample user (replace with actual user ID from auth)
-- NOTE: This should be replaced with real user IDs after auth setup

-- For testing, we'll insert sample spots once a real user exists
-- This script should be run AFTER at least one user signs up

-- Example spot structure:
INSERT INTO public.spots (
  name, description, type, latitude, longitude, address, phone, website, image_url, created_by, average_rating, rating_count
) VALUES
  (
    'Joe''s Gossoko Bar',
    'Best meat pies in the city. Fresh daily, always hot.',
    'gossoko_bar',
    -37.8136,
    144.9631,
    '123 Flinders St, Melbourne VIC 3000',
    '03 9654 1234',
    'https://example.com',
    NULL,
    NULL,
    4.5,
    12
  );

-- Note: Created_by will be NULL until actual user signup. 
-- For production, use actual Supabase user IDs
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/002_seed_data.sql
git commit -m "feat: add seed data structure for testing"
```

---

### Task 15: Verify Project Structure and Build

**Files:**
- Verify all files created
- Run build test

- [ ] **Step 1: Verify project structure**

```bash
find src -type f -name "*.tsx" -o -name "*.ts" | sort
```

Expected output includes all component, hook, and page files created above.

- [ ] **Step 2: Install dependencies and build**

```bash
npm install
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Start dev server and smoke test**

```bash
npm run dev
```

Visit `http://localhost:3000` and verify:
- Landing page loads
- Navigation to login/signup works
- UI components render with correct colors/spacing
- Dark mode is applied by default
- Mobile viewport looks correct

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Gossoko app scaffold with all pages and components"
```

---

## Spec Coverage Check

✅ **Project scaffold** - Task 1 (Next.js setup), Task 2 (Tailwind config)
✅ **Folder structure** - All tasks create files in organized structure
✅ **Database structure** - Task 3 (Supabase schema with RLS)
✅ **Reusable component architecture** - Task 5 (UI components), Task 6 (Layout)
✅ **Authentication system** - Task 4 (Auth context), Task 7 (Login/Signup)
✅ **User onboarding** - Task 7 (Onboarding page)
✅ **Home feed structure** - Task 10 (Feed page with cards)
✅ **Global theme** - Task 2 (Tailwind with dark mode + orange accents)
✅ **Navigation tabs** - Task 6 (Bottom nav with 5 tabs)
✅ **App logo placeholder** - Task 12 (Logo SVG)
✅ **Responsive layout** - All tasks use Tailwind responsive classes
✅ **Polished UI** - Industrial aesthetic with safety orange, dark backgrounds, rounded cards
✅ **Production-ready code** - TypeScript strict mode, proper error handling, RLS on database

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-gossoko-build.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach would you prefer?**
