

# 🚴 Delivery Agent App — Implementation Plan

## Overview
A mobile-optimized PWA for delivery agents to receive orders, navigate deliveries, track earnings, and manage their profile. Dark-mode-first design with the specified color system, installable on any phone.

---

## Phase 1: Foundation

### Design System & Layout
- Dark theme with custom CSS variables: green (#00C851), dark bg (#0A0A0F), surface (#141419), amber (#FFB800), danger (#FF4757)
- Inter/DM Sans font, 16px card radius, 12px button radius
- Bottom tab navigation: Dashboard · Orders · Earnings · Profile
- Mobile-first responsive layout optimized for one-handed use
- PWA setup with manifest, service worker, and install prompt

### Database Schema (Lovable Cloud)
- **delivery_agents** — profile, vehicle type, agent code, stats, avatar URL
- **agent_availability** — online/offline/busy status, last_seen timestamp
- **delivery_orders** — full order records with status, addresses, fees, package details
- **agent_order_responses** — accept/reject/fee negotiation per order
- **delivery_tracking** — real-time GPS coordinates during active deliveries
- **order_status_timeline** — step-by-step delivery stage history
- **notifications** — in-app notification records with read/unread state
- **user_roles** — separate roles table for agent role verification
- RLS policies on all tables so agents only access their own data
- Supabase Auth with agent role guard

### Storage
- `avatars` bucket for agent profile photos
- `delivery-proofs` bucket for proof-of-delivery photos

---

## Phase 2: Core Screens

### 1. Agent Dashboard (`/agent/dashboard`)
- Hero section with avatar, greeting, animated availability toggle (Online/Offline/Busy)
- Today's stats row: Deliveries, Earnings, Rating (glassmorphism cards)
- Active delivery card with pulsing border, navigate button, order details
- Incoming order notification banner with 30-second countdown, accept/reject
- Realtime subscription for new order assignments
- Recent orders list (last 5) + quick action buttons

### 2. Orders Screen (`/agent/orders`)
- Tabbed interface: New · Active · Completed · Cancelled with count badges
- Order cards showing pickup/delivery addresses, distance, fee, package info, fragility badge
- Accept flow with bottom sheet for fee negotiation
- Reject flow with confirmation
- Order detail view with full status timeline and customer contact buttons (call + WhatsApp)

### 3. Active Delivery (`/agent/active-delivery`)
- Vertical status stepper (7 stages from Accepted → Delivered)
- Single "Advance Status" CTA button that updates to next step label
- Live GPS broadcasting every 10 seconds to `delivery_tracking` table
- Embedded map showing agent location, pickup pin, delivery pin
- Customer contact buttons (call + WhatsApp)
- Delivery notes display and "Open in Maps" navigation button

### 4. Complete Delivery (`/agent/complete-delivery`)
- Camera/gallery photo upload for proof of delivery (stored in Supabase Storage)
- Recipient confirmation checkbox
- Fee summary breakdown (base, distance, weight, fragility, weather, urgency surcharges)
- "Complete Delivery" CTA → updates status, agent stats, shows confetti success screen

---

## Phase 3: Analytics & Profile

### 5. Earnings Screen (`/agent/earnings`)
- Lifetime earnings hero number with today/this week chips
- Recharts line/bar chart with Daily · Weekly · Monthly toggle
- Summary stats row: total deliveries, weekly count, avg fee, rating
- Earnings history list with date range filter, sorted newest first

### 6. Agent Profile (`/agent/profile`)
- Avatar with upload, agent name + code badge, verification status
- Editable fields: name, phone, email, vehicle type selector (Bike/Car/Foot)
- Read-only performance stats: rating, deliveries, earnings, member since
- Save with success toast

---

## Phase 4: Notifications & Polish

### 7. Notifications System
- Supabase Realtime channel subscriptions for live in-app notifications
- Web Push API for background notifications
- Notification triggers: new order, order confirmed, earnings updated, order cancelled
- Notification center screen with read/unread state
- Bell icon with red badge counter in header

### Edge Functions
- Webhook function for HMAC-SHA256 signed status change notifications to external platforms
- Pricing calculation helper if needed

### Final Polish
- Framer Motion animations for card entrances, status transitions, chart renders
- PWA install page at `/install`
- Loading skeletons and error states on all screens
- Input validation with Zod on all forms

