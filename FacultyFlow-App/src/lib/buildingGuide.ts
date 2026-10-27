import type { AppData, Room } from '../types'

export type BlockCode = 'A' | 'B' | 'C' | 'D' | 'LAB'

export interface BlockGuide {
  code: BlockCode
  name: string
  floor: string
  roomNames: string[]
}

const BLOCK_META: Record<BlockCode, { name: string; order: number }> = {
  A: { name: 'Academic Block A', order: 0 },
  B: { name: 'Block B', order: 1 },
  C: { name: 'Block C', order: 2 },
  D: { name: 'Block D', order: 3 },
  LAB: { name: 'Laboratory wing', order: 4 },
}

/**
 * Rooms follow a `B-204` / `Lab-2` naming scheme, so the building each room
 * belongs to can be derived from the room registry itself. Nothing here is
 * hardcoded to the demo data — add a room and its block appears automatically.
 */
export function blockForRoom(room: Room): BlockCode {
  if (room.kind === 'Laboratory' || /^lab/i.test(room.name) || /lab/i.test(room.building)) return 'LAB'
  const prefix = room.name.charAt(0).toUpperCase()
  if (prefix >= 'A' && prefix <= 'Z') return prefix as BlockCode
  return 'A'
}

export function buildBlockGuide(rooms: Room[]): BlockGuide[] {
  const map = new Map<BlockCode, BlockGuide>()
  for (const room of rooms) {
    const code = blockForRoom(room)
    const existing = map.get(code)
    if (existing) {
      existing.roomNames.push(room.name)
    } else {
      map.set(code, {
        code,
        name: BLOCK_META[code].name,
        floor: room.floor,
        roomNames: [room.name],
      })
    }
  }
  return [...map.values()].sort((a, b) => BLOCK_META[a.code].order - BLOCK_META[b.code].order)
}

/** Maps every room id to the block it sits in, for colouring tips and cards. */
export function roomBlockIndex(data: AppData): Map<string, BlockCode> {
  const index = new Map<string, BlockCode>()
  for (const room of data.rooms) index.set(room.id, blockForRoom(room))
  return index
}

export const BLOCK_COLORS: Record<BlockCode, string> = {
  A: '#4f8fe8',
  B: '#6aa6f2',
  C: '#8fbdf8',
  D: '#a8cefb',
  LAB: '#7bbcd6',
}
