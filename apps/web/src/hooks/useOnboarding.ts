import { useState, useCallback } from 'react'

const STORAGE_KEY = 'fixflow-onboarding'

interface OnboardingState {
  step: number
  completed: boolean
  data: {
    org?: { name: string; industry: string; size: string }
    locations?: { name: string; type: string }[]
    asset?: { name: string; type: string; location_id?: number }
    invites?: { email: string; role: string }[]
  }
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : { step: 1, completed: false, data: {} }
    } catch {
      return { step: 1, completed: false, data: {} }
    }
  })

  const save = useCallback((update: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...update }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return {
    step: state.step,
    data: state.data,
    completed: state.completed,
    goToStep: (step: number) => save({ step }),
    nextStep: () => save({ step: state.step + 1 }),
    prevStep: () => save({ step: Math.max(1, state.step - 1) }),
    updateData: (data: Partial<OnboardingState['data']>) =>
      save({ data: { ...state.data, ...data } }),
    complete: () => save({ completed: true }),
    reset: () => {
      localStorage.removeItem(STORAGE_KEY)
      setState({ step: 1, completed: false, data: {} })
    },
  }
}
