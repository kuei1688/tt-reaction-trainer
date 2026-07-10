# Read-Only Physics Extractor MVP Analysis

## Overview

I'll analyze the read-only physics extractor MVP design based on the provided documentation. Let me review the key files.

## Key Findings from Documentation Review

### 1. MVP Scope Definition

Based on `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` and related docs, the MVP should focus on:

- **Read-only constraint**: No modifications to source files
- **Extraction targets**: Physics parameters, collision shapes, rigid body properties
- **Output format**: Structured JSON/Markdown reports

### 2. Core Extraction Targets

| Category | Properties | Priority |
|----------|-----------|----------|
| Rigid Body | mass, drag, angularDrag, isKinematic, useGravity | P0 |
| Collider | shape type, size, center, material | P0 |
| Transform | position, rotation, scale | P0 |
| Constraints | freezePosition, freezeRotation | P1 |

### 3. MVP vs Full Scope Boundary

**MVP Includes:**
- Static extraction from HTML/JS source
- AST-based property parsing
- JSON + Markdown output generation
- Basic validation rules

**MVP Excludes:**
- Runtime state extraction
- Physics simulation replay
- Cross-file dependency resolution
- Auto-fix suggestions

### 4. Technical Approach

```
Source Files â Parser â AST â Property Extractor â Validator â Report Generator
```

**Parser Strategy:**
- HTML files: DOM parsing for inline scripts
- JS files: AST parsing (Babel/acorn)
- Pattern matching for physics-related APIs

### 5. Validation Rules (MVP)

- **Required field check**: mass > 0, collider exists
- **Type consistency**: numeric fields contain numbers
- **Range validation**: mass â¥ 0, drag â¥ 0
- **Body integrity**: each rigid body has at least one collider

### 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dynamic property assignment missed | Medium | Pattern + AST dual approach |
| Cross-file references unresolved | Low | MVP scope excludes this |
| Obfuscated code patterns | Medium | Fallback to regex matching |
| Large file performance | Low | Streaming parser |

### 7. Output Structure (MVP)

```json
{
  "metadata": {
    "source": "game4.html",
    "timestamp": "ISO-8601",
    "extractorVersion": "0.1.0"
  },
  "bodies": [
    {
      "id": "body-001",
      "name": "player",
      "rigidBody": { "mass": 1.0, "drag": 0.1 },
      "colliders": [{ "type": "box", "size": [1,1,1] }],
      "transform": { "position": [0,0,0] },
      "validation": { "valid": true, "warnings": [] }
    }
  ],
  "summary": {
    "totalBodies": 1,
    "validBodies": 1,
    "issues": []
  }
}
```

### 8. Implementation Phases

1. **Phase 1 - Skeleton**: File loader + empty report scaffold
2. **Phase 2 - Parser**: HTML/JS parsing pipeline
3. **Phase 3 - Extractors**: Property-specific extractors (rigid body, collider, transform)
4. **Phase 4 - Validator**: Rule engine implementation
5. **Phase 5 - Reporter**: JSON + Markdown output
6. **Phase 6 - Integration**: CLI entry point + error handling

## Recommendations

1. **Start with `game4.html`** as the primary test target - it likely contains the most physics logic
2. **Use dual extraction strategy**: AST for structured code + regex fallback for dynamic patterns
3. **Generate body hash** from extracted properties for deduplication and change tracking
4. **Keep validation extensible** - rule registry pattern for future expansion
5. **Markdown report should include**: summary table, per-body detail cards, validation issues section

## Constraints Checklist

- [x] Read-only - no file modifications
- [x] MVP scope clearly bounded
- [x] Output format defined (JSON + Markdown)
- [x] Validation rules identified
- [x] Technical approach outlined
- [x] Risk mitigation planned