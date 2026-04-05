import { apiFetch } from '../utils/request'

export const UserService = {
  getProfile() {
    return apiFetch('/api/user/profile')
  },

  getNotice() {
    return apiFetch('/api/notice')
  },

  getActivities() {
    return apiFetch('/api/activities')
  },

  getActivityDetail(id) {
    return apiFetch(`/api/activities/${id}`)
  },

  getLeaderboard() {
    return apiFetch('/api/public/leaderboard')
  },

  getGoldChainRecords() {
    return apiFetch('/api/public/gold-chain')
  }
}
