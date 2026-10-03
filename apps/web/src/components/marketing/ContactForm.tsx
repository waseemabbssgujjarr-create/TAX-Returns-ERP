'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@taxdesk/ui'
import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const TOPIC_VALUES = ['general', 'demo', 'partnership', 'support', 'other'] as const

function buildContactSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('errors.name')),
    email: z.string().email(t('errors.email')),
    firm: z.string().min(2, t('errors.firm')),
    phone: z.string().min(7, t('errors.phone')).max(24, t('errors.phone')),
    topic: z.enum(TOPIC_VALUES, { required_error: t('errors.topic') }),
    message: z.string().min(10, t('errors.message')).max(4000, t('errors.message')),
  })
}

type ContactFormValues = z.infer<ReturnType<typeof buildContactSchema>>

export function ContactForm() {
  const t = useTranslations('marketing.contact')
  const [submitted, setSubmitted] = useState(false)

  const schema = useMemo(() => buildContactSchema(t), [t])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      firm: '',
      phone: '',
      topic: 'general',
      message: '',
    },
  })

  const onSubmit = () => {
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div
        className="border-border bg-surface flex flex-col items-center gap-4 rounded-xl border px-6 py-10 text-center shadow-sm"
        role="status"
      >
        <CheckCircle2 className="text-success size-10" aria-hidden="true" />
        <h2 className="text-foreground text-lg font-semibold">{t('success.title')}</h2>
        <p className="text-foreground/80 max-w-md text-sm">{t('success.body')}</p>
        <p className="text-foreground text-sm font-medium">
          <a
            className="text-primary underline-offset-2 hover:underline"
            href={`mailto:${t('mailtoTo')}`}
          >
            {t('mailtoTo')}
          </a>
        </p>
      </div>
    )
  }

  return (
    <form
      className="border-border bg-surface flex flex-col gap-5 rounded-xl border p-6 shadow-sm sm:p-8"
      noValidate
      aria-label={t('formAria')}
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit(onSubmit)(e)
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('fields.name')} error={errors.name?.message} htmlFor="contact-name">
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            className={inputClass(errors.name)}
            {...register('name')}
          />
        </Field>
        <Field label={t('fields.email')} error={errors.email?.message} htmlFor="contact-email">
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            className={inputClass(errors.email)}
            {...register('email')}
          />
        </Field>
        <Field label={t('fields.firm')} error={errors.firm?.message} htmlFor="contact-firm">
          <input
            id="contact-firm"
            type="text"
            autoComplete="organization"
            className={inputClass(errors.firm)}
            {...register('firm')}
          />
        </Field>
        <Field label={t('fields.phone')} error={errors.phone?.message} htmlFor="contact-phone">
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            className={inputClass(errors.phone)}
            {...register('phone')}
          />
        </Field>
      </div>

      <Field label={t('fields.topic')} error={errors.topic?.message} htmlFor="contact-topic">
        <select id="contact-topic" className={inputClass(errors.topic)} {...register('topic')}>
          {TOPIC_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`topics.${value}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('fields.message')} error={errors.message?.message} htmlFor="contact-message">
        <textarea
          id="contact-message"
          rows={5}
          className={inputClass(errors.message)}
          {...register('message')}
        />
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
        {t('submit')}
      </Button>
    </form>
  )
}

function inputClass(hasError: unknown) {
  return [
    'border-border bg-surface text-foreground focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    hasError ? 'border-destructive' : '',
  ].join(' ')
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string
  error?: string | undefined
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-foreground text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
