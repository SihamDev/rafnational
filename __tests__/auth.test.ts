import { describe, it, expect } from 'vitest'
import { loginSchema, signUpSchema, forgotPasswordSchema } from '../lib/validations/auth'

describe('loginSchema', () => {
  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'password123' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'short' })
    expect(result.success).toBe(false)
  })

  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })
})

describe('signUpSchema', () => {
  it('rejects mismatched passwords', () => {
    const result = signUpSchema.safeParse({
      full_name: 'اسم رباعي كامل',
      email: 'test@example.com',
      password: 'password123',
      confirm_password: 'different123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((e) => e.path.join('.'))
      expect(paths).toContain('confirm_password')
    }
  })

  it('rejects short full_name', () => {
    const result = signUpSchema.safeParse({
      full_name: 'أب',
      email: 'test@example.com',
      password: 'password123',
      confirm_password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid signup data', () => {
    const result = signUpSchema.safeParse({
      full_name: 'محمد عبدالله الأحمد',
      email: 'test@example.com',
      password: 'password123',
      confirm_password: 'password123',
    })
    expect(result.success).toBe(true)
  })
})

describe('forgotPasswordSchema', () => {
  it('rejects invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'bad' })
    expect(result.success).toBe(false)
  })

  it('accepts valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(true)
  })
})
