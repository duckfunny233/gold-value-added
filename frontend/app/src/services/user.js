import { API_BASE } from '../utils/request'
import {
  activitiesFallback,
  buildActivityDetailFallback,
  cloneData,
  profileFallback,
} from './fallback-data'

const normalizeBgImage = (value) => {
  if (!value) return value
  return value.startsWith('/images/') ? value.replace('/images/', '/') : value
}

const normalizeProfile = (profile) => {
  const mapPositions = (items = []) => items.map((item) => ({
    ...item,
    bgImage: normalizeBgImage(item.bgImage),
  }))

  return {
    ...profile,
    goldPositions: mapPositions(profile?.goldPositions),
    silverPositions: mapPositions(profile?.silverPositions),
  }
}

const fetchJsonOrFallback = async (path, fallbackData) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '',
      },
    })
    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    if (!response.ok) {
      throw new Error(payload.message || 'request-failed')
    }
    return payload
  } catch (error) {
    return {
      code: 200,
      data: cloneData(typeof fallbackData === 'function' ? fallbackData() : fallbackData),
    }
  }
}

export const UserService = {
  getProfile() {
    return fetchJsonOrFallback('/api/user/profile', profileFallback).then((payload) => ({
      ...payload,
      data: normalizeProfile(payload.data || profileFallback),
    }))
  },

  getNotice() {
    return fetchJsonOrFallback('/api/notice', { text: '【调试模式】当前正在使用本地兜底数据。' })
  },

  getActivities() {
    return fetchJsonOrFallback('/api/activities', activitiesFallback)
  },

  getActivityDetail(id) {
    return fetchJsonOrFallback(`/api/activities/${id}`, () => buildActivityDetailFallback(id))
  },

  getLeaderboard() {
    return fetchJsonOrFallback('/api/public/leaderboard', [])
  },

  getGoldChainRecords() {
    return fetchJsonOrFallback('/api/public/gold-chain', [])
  }
}
