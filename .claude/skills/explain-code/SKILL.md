---
name: explain-code
description: Explains code efficiently. Default to concise; add diagrams or analogies only when helpful or requested.
---

Goal:
- Minimize tokens while staying correct.

Default output (always):
- 2–6 bullets explaining what the code does.
- 1 gotcha (1 sentence).

Conditional:
- If the user asks "how does this work?": include a short step list (max 6 steps).

Only include the following if they materially increase clarity or are explicitly requested:
- Analogy: max 2 sentences.
- ASCII diagram: max 6 lines.

Hard limits:
- Max 1200 characters total unless the user requests "detailed".
- No introductions, no conclusions, no filler.
- Do not repeat the code.
- Reference symbols/functions by name.

If context is missing:
- Ask one targeted question OR
- State the single most likely assumption and proceed.

Output format (strict order):
1) Summary bullets  
2) (Optional) Diagram  
3) (Optional) Analogy  
4) Steps (only if asked or necessary)  
5) Gotcha
