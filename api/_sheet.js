// The Events spreadsheet's public tabs, read through the Apps Script (see api/sheet.js).
import { homecomingNominationsApi } from '../src/data/sources.js'

export const PUBLIC_TABS = ['Spirit Points', 'Events', 'Sports']

export const publicTabUrl = (tab) =>
  `${homecomingNominationsApi}${homecomingNominationsApi.includes('?') ? '&' : '?'}view=sheet&tab=${encodeURIComponent(tab)}`
