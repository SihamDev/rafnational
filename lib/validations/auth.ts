import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
})

export const signUpSchema = z
  .object({
    full_name: z.string().min(4, 'الاسم 4 أحرف على الأقل'),
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirm_password'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirm_password'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
