declare module '@rails/actioncable' {
  export function createConsumer(url?: string): Consumer

  export interface Consumer {
    subscriptions: Subscriptions
    disconnect(): void
  }

  export interface Subscriptions {
    create(
      channelOrParams: string | Record<string, unknown>,
      callbacks: SubscriptionCallbacks,
    ): Subscription
  }

  export interface Subscription {
    unsubscribe(): void
    perform(action: string, data?: Record<string, unknown>): void
  }

  export interface SubscriptionCallbacks {
    connected?(): void
    disconnected?(): void
    received?(data: unknown): void
    rejected?(): void
  }
}
