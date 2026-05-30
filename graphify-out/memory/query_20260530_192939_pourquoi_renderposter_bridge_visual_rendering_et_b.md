---
type: "query"
date: "2026-05-30T19:29:39.003903+00:00"
question: "Pourquoi renderPoster bridge Visual Rendering et Bot Core AI Integration ?"
contributor: "graphify"
source_nodes: ["renderPoster()", "handleGeneration()", "getDesignData()", "hex2rgba()", "drawLeaf()", "drawDrop()", "drawFlare()"]
---

# Q: Pourquoi renderPoster bridge Visual Rendering et Bot Core AI Integration ?

## Answer

handleGeneration() (Bot Core, L197) appelle renderPoster() (Visual Rendering, L107) avec les données AI de getDesignData(). renderPoster() a 6 voisins dans la communauté Visual Rendering (hex2rgba, drawLeaf, drawDrop, drawFlare, rrect, wrapText) et 1 voisin dans Bot Core (handleGeneration via appel entrant). Expanded from original query via vocab: [render, poster, bot, handle, generation, draw]. C est le seul noeud appelé par handleGeneration, d ou sa position de pont unique avec betweenness centrality 0.031.

## Source Nodes

- renderPoster()
- handleGeneration()
- getDesignData()
- hex2rgba()
- drawLeaf()
- drawDrop()
- drawFlare()