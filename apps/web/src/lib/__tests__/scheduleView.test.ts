import { describe, it, expect } from 'vitest'
import { fixtures } from '@/test/reportFixtures'
import { EARLIER, moveRequest, ordersIn, overloads, rangeFor, step, toDay } from '../scheduleView'
import type { Schedule } from '@/types/schedule'

const schedule: Schedule = fixtures.schedule.data
// Ids and numbers change when the fixture is made again, so people and work are found by their names.
const person = (name: string) => schedule.technicians.find((t) => t.name === name)!
const alice = person('Alice Silva').id!
const bob = person('Bob Perera').id!
const pumpJob = schedule.work_orders.find((o) => o.title === 'Job on Pump')!

describe('the period', () => {
  it('is the week around a day, starting on the day the company starts its week', () => {
    const wednesday = new Date(2026, 9, 14)
    expect(rangeFor('week', wednesday, 1)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(rangeFor('week', wednesday, 0)).toEqual({ from: '2026-10-11', to: '2026-10-17' })
  })

  it('is the day itself in the day view', () => {
    expect(rangeFor('day', new Date(2026, 9, 14), 1)).toEqual({ from: '2026-10-14', to: '2026-10-14' })
  })

  it('moves a day or a week at a time', () => {
    const wednesday = new Date(2026, 9, 14)
    expect(toDay(step('day', wednesday, 1))).toBe('2026-10-15')
    expect(toDay(step('week', wednesday, -1))).toBe('2026-10-07')
  })
})

describe('which work is where, in the real response', () => {
  it('has each work order on its person and day', () => {
    expect(ordersIn(schedule, alice, '2026-10-13')).toEqual([pumpJob])
    expect(ordersIn(schedule, null, '2026-10-14')).toHaveLength(1)
  })

  it('puts work from before the period, and work with no date, in the earlier column of the person it is with', () => {
    expect(ordersIn(schedule, bob, EARLIER).map((o) => o.day).sort()).toEqual(['2026-10-08', null].sort())
    expect(ordersIn(schedule, bob, '2026-10-08')).toEqual([])
  })

  it('counts everything once: each work order is in exactly one cell', () => {
    const people = [null, ...schedule.technicians.map((t) => t.id)]
    const days = [EARLIER, ...schedule.days.map((d) => d.date)]
    const cells = people.flatMap((p) => days.map((d) => ordersIn(schedule, p, d).length))
    expect(cells.reduce((a, b) => a + b, 0)).toBe(schedule.work_orders.length)
  })
})

describe('what dropping a work order changes', () => {
  const onTuesdayWithAlice = { ...pumpJob, assignee_id: alice, day: '2026-10-13' }

  it('is the other person when only the person differs', () => {
    expect(moveRequest(onTuesdayWithAlice, bob, '2026-10-13')).toEqual({ assignee_id: bob })
  })

  it('is the other day when only the day differs', () => {
    expect(moveRequest(onTuesdayWithAlice, alice, '2026-10-16')).toEqual({ due_on: '2026-10-16' })
  })

  it('is both when both differ, and nobody when dropped on the row of work nobody has', () => {
    expect(moveRequest(onTuesdayWithAlice, null, '2026-10-16')).toEqual({ assignee_id: null, due_on: '2026-10-16' })
  })

  it('is nothing when it is dropped where it already is', () => {
    expect(moveRequest(onTuesdayWithAlice, alice, '2026-10-13')).toBeNull()
  })

  it('leaves the date alone when dropped in the earlier column, as that column has no date to give', () => {
    expect(moveRequest(onTuesdayWithAlice, bob, EARLIER)).toEqual({ assignee_id: bob })
    expect(moveRequest(onTuesdayWithAlice, alice, EARLIER)).toBeNull()
  })

  it('gives work with no date the day it is dropped on', () => {
    expect(moveRequest({ ...onTuesdayWithAlice, day: null }, alice, '2026-10-13')).toEqual({ due_on: '2026-10-13' })
  })
})

describe('who is overloaded', () => {
  it('is nobody when no day is flagged', () => {
    expect(overloads(schedule)).toEqual([])
  })

  it('lists each flagged day with the hours it holds and what a day can hold', () => {
    const busy: Schedule = {
      ...schedule,
      technicians: schedule.technicians.map((t) => ({
        ...t,
        days: t.days.map((d) => (t.id === bob && d.date === '2026-10-14' ? { ...d, count: 1, hours: 2, overloaded: true } : d)),
      })),
    }
    expect(overloads(busy)).toEqual([{ id: bob, name: 'Bob Perera', date: '2026-10-14', hours: 2, capacity: 0 }])
  })
})
