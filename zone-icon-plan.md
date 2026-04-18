# Zone Label Redesign — Implementation Plan

## Problems with the current implementation
1. Pill still visible and overflowing — mode detection isn't reliable enough
2. Double-click conflicts with react-zoom-pan-pinch's built-in double-click-to-zoom
3. Centered/draggable modes add complexity the user doesn't want
4. No "Other" room type in the color map

---

## What the user actually wants
> "Option three on all of them" — replace the pill entirely with a small colored dot on every zone, regardless of size.

**Dot behavior:**
- Always a small colored circle centered in the zone
- Color = room type
- **Hover** → tooltip with room name appears above the dot
- **Click** → open/close the popout (which already shows the room name in its header)

No double-click. No pill. No mode switching.

---

## Changes

### 1. `RoomZone.tsx`
- Remove: all `PillMode` logic, `evaluatePillMode`, `ResizeObserver`, `pillDrag`, `pillRef`, `pillPos`
- Remove: `onDoubleClick` handler — revert to `onClick` for opening popout
- Replace pill JSX with a single dot + hover tooltip:
  ```
  [colored dot 12px] — always centered in zone
  on hover → tooltip above dot showing room.name
  on click (zone) → open/close popout
  ```
- Keep: all popout drag/resize/items logic unchanged
- Keep: admin delete button unchanged
- Add: `other` to color map → neutral warm gray `#a8a29e`

### 2. `MapArea.tsx`
- Add `doubleClick={{ disabled: true }}` to `<TransformWrapper>` to prevent zoom-on-double-click conflicts

---

## Color map (final)
| Type | Color |
|------|-------|
| Sanctuary / Chapel / Worship | Violet `#8b5cf6` |
| Classroom | Blue `#3b82f6` |
| Office | Slate `#64748b` |
| Kitchen | Amber `#f59e0b` |
| Storage | Stone `#78716c` |
| Lobby / Foyer / Entrance | Teal `#14b8a6` |
| Gym / Fellowship Hall | Green `#22c55e` |
| Nursery | Rose `#f43f5e` |
| Library | Indigo `#6366f1` |
| Conference / Meeting Room | Sky `#0ea5e9` |
| Bathroom / Restroom | Cyan `#06b6d4` |
| Hallway / Corridor | Gray `#94a3b8` |
| **Other** | Warm gray `#a8a29e` |
| Unknown (not in list) | Hash → palette fallback |

---

## What stays the same
- All popout drag, resize, items list, edit/delete actions
- DnD drop target behavior
- Admin draw/delete mode
- SVG connector line
