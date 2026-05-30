# Graph Report - .  (2026-05-30)

## Corpus Check
- Corpus is ~751 words - fits in a single context window. You may not need a graph.

## Summary
- 25 nodes · 34 edges · 4 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Bot Core & AI Integration|Bot Core & AI Integration]]
- [[_COMMUNITY_Package Metadata|Package Metadata]]
- [[_COMMUNITY_Visual Rendering Functions|Visual Rendering Functions]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]

## God Nodes (most connected - your core abstractions)
1. `renderPoster()` - 8 edges
2. `hex2rgba()` - 5 edges
3. `drawLeaf()` - 3 edges
4. `drawDrop()` - 3 edges
5. `drawFlare()` - 3 edges
6. `handleGeneration()` - 3 edges
7. `scripts` - 2 edges
8. `getDesignData()` - 2 edges
9. `rrect()` - 2 edges
10. `wrapText()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `renderPoster()` --calls--> `rrect()`  [EXTRACTED]
  bot.js → bot.js  _Bridges community 0 → community 2_

## Communities (4 total, 0 thin omitted)

### Community 0 - "Bot Core & AI Integration"
Cohesion: 0.25
Nodes (7): Anthropic, bot, getDesignData(), handleGeneration(), rrect(), { Telegraf }, wrapText()

### Community 1 - "Package Metadata"
Cohesion: 0.33
Nodes (5): main, name, scripts, start, version

### Community 2 - "Visual Rendering Functions"
Cohesion: 0.70
Nodes (5): drawDrop(), drawFlare(), drawLeaf(), hex2rgba(), renderPoster()

### Community 3 - "Package Dependencies"
Cohesion: 0.40
Nodes (5): dependencies, @anthropic-ai/sdk, canvas, dotenv, telegraf

## Knowledge Gaps
- **11 isolated node(s):** `name`, `version`, `main`, `start`, `@anthropic-ai/sdk` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies` to `Package Metadata`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `renderPoster()` connect `Visual Rendering Functions` to `Bot Core & AI Integration`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `name`, `version`, `main` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._