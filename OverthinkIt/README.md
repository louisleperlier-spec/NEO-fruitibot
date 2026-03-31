# Overthink It — Mac Menu Bar App

> A completely unnecessary AI app that turns simple decisions into existential crises.

## What it does

You type a mundane question ("should I have a second coffee?"), and the app:
1. Assigns an **Anxiety Level** from 1–10 (always too high)
2. Lists **5 escalating "What if..." scenarios**
3. Delivers a **Bottom Line** that is dramatic, unhelpful, and oddly comforting

## Monetization

- **Free tier**: 3 overthinks per day
- **PRO**: $3.99/month via StoreKit 2 → unlimited overthinks

## Tech Stack

- Swift + SwiftUI (macOS 13+)
- Menu bar app (no Dock icon)
- Claude Haiku API for fast, cheap AI responses
- StoreKit 2 for subscriptions
- No backend needed — fully client-side

## Setup

### Requirements
- Xcode 15+
- macOS 13 Ventura or later
- Claude API key (console.anthropic.com)
- Apple Developer account (for App Store)

### Run locally

1. Open `OverthinkIt/` in Xcode via `Package.swift`
2. Set your Claude API key in app Settings
3. Use the `StoreKit.storekit` config file for local subscription testing

### App Store setup

1. Create app in App Store Connect
2. Add in-app purchase: `com.overthink.monthly` — Auto-Renewable Subscription, $3.99/month
3. Enable StoreKit Testing in your scheme

## Cost per use

Claude Haiku costs ~$0.00025 per overthink (500 tokens).
At 3.99/month with 100 uses/month = **99.97% margin** after Apple's 30% cut.

## Distribution

- Primary: Mac App Store
- Alternative: Direct download with Gumroad (no Apple cut)
- Marketing: TikTok demos, ProductHunt launch, Twitter/X

## App Store metadata

**Name**: Overthink It
**Subtitle**: AI-powered anxiety for every decision
**Category**: Utilities / Productivity
**Keywords**: anxiety, decision, AI, funny, productivity, overthinking
