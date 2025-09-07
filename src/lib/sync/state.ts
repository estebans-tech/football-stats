import { assertDb } from '$lib/db/dexie'

export const getLastSync = async (key: string) =>
    Number(localStorage.getItem(`fs.sync.${key}`) || '0')

export const setLastSync = async (key: string, ts: number) =>
    localStorage.setItem(`fs.sync.${key}`, String(ts))