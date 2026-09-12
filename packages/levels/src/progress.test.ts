import { describe, expect, it } from 'vitest'
import { CAMPAIGN_LEVEL_IDS, CAMPAIGN_START_ID, nextCampaignLevelId } from './catalog.ts'
import {
  applyCampaignWin,
  applyModeBest,
  applyOutOfHearts,
  applyUndoAfterWin,
  dequeuePendingScore,
  emptyProgress,
  enqueuePendingScore,
  isCampaignUnlocked,
  mergeProgress,
  parseProgress,
} from './progress.ts'

const WIN = { stars: 3, score: 11_200, heartsLeft: 3, moves: 1 }

describe('campaign win persistence', () => {
  it('winning level i persists i+1', () => {
    for (let i = 0; i < CAMPAIGN_LEVEL_IDS.length - 1; i++) {
      const current = CAMPAIGN_LEVEL_IDS[i]
      const expected = CAMPAIGN_LEVEL_IDS[i + 1]
      const start = { ...emptyProgress(), lastCampaignLevelId: current }
      const won = applyCampaignWin(start, current, WIN)
      expect(won.lastCampaignLevelId).toBe(expected)
      expect(won.completedIds).toContain(current)
      expect(won.campaign[current]?.score).toBe(WIN.score)
      expect(won.campaign[current]?.heartsLeft).toBe(3)
    }
  })

  it('first-run continue id is the tutorial, not a packed default', () => {
    const fresh = emptyProgress()
    expect(fresh.lastCampaignLevelId).toBe(CAMPAIGN_START_ID)
    expect(fresh.lastCampaignLevelId).toBe('flow_0001')
    expect(fresh.lastCampaignLevelId).not.toBe('flow_0015')
    expect(fresh.lastCampaignLevelId).not.toBe('flow_0025')
  })

  it('replay of an earlier board does not rewind lastCampaignLevelId', () => {
    let progress = emptyProgress()
    progress = applyCampaignWin(progress, 'flow_0001', WIN)
    progress = applyCampaignWin(progress, 'flow_0002', WIN)
    expect(progress.lastCampaignLevelId).toBe('flow_0003')
    const replay = applyCampaignWin(progress, 'flow_0001', { ...WIN, score: 12_000 })
    expect(replay.lastCampaignLevelId).toBe('flow_0003')
    expect(replay.campaign.flow_0001?.score).toBe(12_000)
  })

  it('out of hearts does not advance', () => {
    const start = emptyProgress()
    const lost = applyCampaignWin(start, 'flow_0001', { stars: 0, score: 0, heartsLeft: 0, moves: 4 })
    expect(lost).toEqual(start)
    expect(applyOutOfHearts(start).lastCampaignLevelId).toBe('flow_0001')
  })

  it('undo after win does not roll back the committed next id', () => {
    const won = applyCampaignWin(emptyProgress(), 'flow_0001', WIN)
    expect(won.lastCampaignLevelId).toBe('flow_0002')
    expect(applyUndoAfterWin(won)).toEqual(won)
  })

  it('unlocks only the current continue level and previous boards', () => {
    let progress = emptyProgress()
    expect(isCampaignUnlocked(progress, 'flow_0001')).toBe(true)
    expect(isCampaignUnlocked(progress, 'flow_0002')).toBe(false)
    progress = applyCampaignWin(progress, 'flow_0001', WIN)
    expect(isCampaignUnlocked(progress, 'flow_0001')).toBe(true)
    expect(isCampaignUnlocked(progress, 'flow_0002')).toBe(true)
    expect(isCampaignUnlocked(progress, 'flow_0003')).toBe(false)
  })
})

describe('score modes and offline queue', () => {
  it('keeps campaign, daily, and league bests on separate keys', () => {
    let progress = emptyProgress()
    progress = applyCampaignWin(progress, 'flow_0001', WIN)
    progress = applyModeBest(progress, 'daily', '2026-09-12', { ...WIN, score: 9_000 })
    progress = applyModeBest(progress, 'league', '2026-W37', { ...WIN, score: 8_000 })
    expect(progress.campaign.flow_0001?.score).toBe(11_200)
    expect(progress.daily['2026-09-12']?.score).toBe(9_000)
    expect(progress.league['2026-W37']?.score).toBe(8_000)
    expect(progress.daily.flow_0001).toBeUndefined()
    expect(progress.league.flow_0001).toBeUndefined()
  })

  it('queues an offline win and drops it after a successful retry', () => {
    const pending = {
      boardId: 'flow_0001',
      mode: 'campaign' as const,
      hints: 0,
      elapsedMs: 1400,
      moveLog: [{ arrowId: 'A', tMs: 400, result: 'free' as const }],
    }
    let progress = applyCampaignWin(emptyProgress(), 'flow_0001', WIN)
    progress = enqueuePendingScore(progress, pending)
    expect(progress.pendingScores).toHaveLength(1)
    expect(progress.campaign.flow_0001?.score).toBe(WIN.score)
    progress = enqueuePendingScore(progress, pending)
    expect(progress.pendingScores).toHaveLength(1)
    progress = dequeuePendingScore(progress, pending)
    expect(progress.pendingScores).toHaveLength(0)
  })

  it('merge keeps the farther campaign index and the better score', () => {
    const local = applyCampaignWin(emptyProgress(), 'flow_0001', WIN)
    const remote = applyCampaignWin(
      { ...emptyProgress(), lastCampaignLevelId: 'flow_0003' },
      'flow_0003',
      { stars: 2, score: 10_000, heartsLeft: 2, moves: 6 },
    )
    const merged = mergeProgress(local, remote)
    expect(merged.lastCampaignLevelId).toBe(nextCampaignLevelId('flow_0003') ?? 'flow_0004')
    expect(merged.campaign.flow_0001?.score).toBe(WIN.score)
    expect(merged.completedIds).toEqual(expect.arrayContaining(['flow_0001', 'flow_0003']))
  })

  it('rejects a malformed progress blob', () => {
    expect(parseProgress({ version: 1, lastCampaignLevelId: 'flow_0015' })).toBeNull()
    expect(parseProgress({ ...emptyProgress(), version: 2 })).toBeNull()
    expect(parseProgress(emptyProgress())?.lastCampaignLevelId).toBe('flow_0001')
  })
})
