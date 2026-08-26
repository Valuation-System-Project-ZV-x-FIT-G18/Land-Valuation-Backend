export type AuthUser = {
  userId: string
  email: string
  role: string
  tokenUse?: 'access' | 'refresh'
  sessionVersion?: number
}

