import { describe, expect, it, jest } from '@jest/globals'
import { LeaderboardController } from './leaderboard.controller'

describe('LeaderboardController', () => {
  it('delegates overview query to service', async () => {
    const service = {
      getOverview: jest.fn(async () => ({ rows: [], monitors: [] })),
      updateRule: jest.fn(),
      rebuild: jest.fn(),
      retrySync: jest.fn(),
    } as any

    const controller = new LeaderboardController(service)
    const query = { uid: 'U0001001', sortRule: 'goldHoldingGrams' as const }

    await controller.getOverview(query)

    expect(service.getOverview).toHaveBeenCalledWith(query)
  })

  it('passes admin actor into governance actions', async () => {
    const service = {
      getOverview: jest.fn(),
      updateRule: jest.fn(async () => ({})),
      rebuild: jest.fn(async () => ({})),
      retrySync: jest.fn(async () => ({})),
    } as any

    const controller = new LeaderboardController(service)
    const req = {
      user: {
        adminUserId: 'admin-1',
        username: 'leader-admin',
      },
    } as any

    await controller.updateRule({ sortRule: 'totalAsset' }, req)

    expect(service.updateRule).toHaveBeenCalledWith(
      { sortRule: 'totalAsset' },
      {
        adminUserId: 'admin-1',
        username: 'leader-admin',
      },
    )
  })
})
