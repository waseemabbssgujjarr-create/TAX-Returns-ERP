'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CreateClientBodySchema, ClientTypeSchema, FilerStatusSchema } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import {
  IDENTIFIER_REQUIRED_MESSAGE,
  translateClientFieldError,
} from '@/components/clients/clientFormValidation'
import { ApiError } from '@/lib/api/base'
import { checkClientDuplicate, createClient, updateClient } from '@/lib/api/clients'
import { getProblemFieldErrors, getProblemTitle } from '@/lib/api/problemDetails'
import { useAuthStore } from '@/stores/authStore'

const FormSchema = CreateClientBodySchema

type FormValues = z.infer<typeof FormSchema>



const clientTypes = ClientTypeSchema.options

const filerStatuses = FilerStatusSchema.options



const CLIENT_FORM_FIELDS = ['displayName', 'cnic', 'ntn'] as const



export interface ClientFormProps {

  mode: 'create' | 'edit'

  clientId?: string

  initial?: Partial<FormValues>

  onSaved?: (id: string) => void

}



export function ClientForm({ mode, clientId, initial, onSaved }: ClientFormProps) {

  const t = useTranslations('clients')

  const { locale } = useParams<{ locale: string }>()

  const accessToken = useAuthStore((s) => s.accessToken)

  const [duplicateId, setDuplicateId] = useState<string | null>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)



  const {

    register,

    handleSubmit,

    watch,

    setError,

    formState: { errors, isSubmitting },

  } = useForm<FormValues>({

    resolver: zodResolver(FormSchema),

    defaultValues: {

      displayName: initial?.displayName ?? '',

      type: initial?.type ?? 'SALARIED_INDIVIDUAL',

      filerStatus: initial?.filerStatus ?? 'UNKNOWN',

      cnic: initial?.cnic ?? '',

      ntn: initial?.ntn ?? '',

      notes: initial?.notes,

    },

  })



  const cnic = watch('cnic')

  const ntn = watch('ntn')



  const fieldError = (field: (typeof CLIENT_FORM_FIELDS)[number]) => {

    const message = errors[field]?.message

    if (typeof message !== 'string') return undefined

    return translateClientFieldError(t, field, message)

  }



  useEffect(() => {

    if (!accessToken) return

    const timer = setTimeout(() => {

      void (async () => {

        try {

          const cnicTrimmed = (cnic ?? '').trim()

          const ntnTrimmed = (ntn ?? '').trim()

          if (!cnicTrimmed && !ntnTrimmed) {

            setDuplicateId(null)

            return

          }

          const result = await checkClientDuplicate(accessToken, {

            cnic: cnicTrimmed || undefined,

            ntn: ntnTrimmed || undefined,

            excludeClientId: clientId,

          })

          const match = result.cnicMatch ?? result.ntnMatch

          setDuplicateId(match?.clientId ?? null)

        } catch {

          setDuplicateId(null)

        }

      })()

    }, 400)

    return () => clearTimeout(timer)

  }, [accessToken, cnic, ntn, clientId])



  const applyApiFieldErrors = (body: unknown) => {

    const fieldErrors = getProblemFieldErrors(body)

    let applied = false

    for (const field of CLIENT_FORM_FIELDS) {

      const messages = fieldErrors[field]

      const first = messages?.[0]

      if (!first) continue

      setError(field, {

        message: translateClientFieldError(t, field, first) ?? first,

      })

      applied = true

    }

    return applied

  }



  const onSubmit = (event: FormEvent<HTMLFormElement>) => {

    void handleSubmit(

      async (values) => {

        if (!accessToken) {

          setSubmitError(t('errors.saveFailed'))

          return

        }

        setSubmitError(null)

        try {

          if (mode === 'create') {

            const created = await createClient(accessToken, values)

            onSaved?.(created.id)

          } else if (clientId) {

            const updated = await updateClient(accessToken, clientId, values)

            onSaved?.(updated.id)

          }

        } catch (err) {

          if (err instanceof ApiError) {

            if (err.status === 422 || err.status === 409) {

              setSubmitError(getProblemTitle(err.body) ?? t('form.duplicateWarning'))

              return

            }

            if (err.status === 400) {

              if (!applyApiFieldErrors(err.body)) {

                setSubmitError(getProblemTitle(err.body) ?? t('errors.saveFailed'))

              }

              return

            }

            if (err.status === 502 || err.status === 503 || err.status === 504) {

              setSubmitError(t('errors.apiUnavailable'))

              return

            }

          }

          if (err instanceof TypeError) {

            setSubmitError(t('errors.apiUnavailable'))

            return

          }

          setSubmitError(t('errors.saveFailed'))

        }

      },

      () => {

        setSubmitError(null)

      },

    )(event)

  }



  const cnicFieldError = fieldError('cnic')

  const ntnFieldError = fieldError('ntn')

  const showIdentifierRequired =

    errors.cnic?.type === 'custom' && errors.cnic.message === IDENTIFIER_REQUIRED_MESSAGE



  return (

    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6" noValidate>

      <h2 className="text-foreground text-xl font-semibold">

        {mode === 'create' ? t('form.createTitle') : t('form.editTitle')}

      </h2>



      {duplicateId && (

        <div

          className="border-warning/40 bg-warning/10 text-foreground rounded-md border px-4 py-3 text-sm"

          role="alert"

        >

          <p>{t('form.duplicateWarning')}</p>

          <Link

            href={`/${locale}/clients/${duplicateId}`}

            className="text-primary mt-1 inline-block font-medium underline"

          >

            {t('form.viewExisting')}

          </Link>

        </div>

      )}



      {submitError && (

        <p className="text-error text-sm" role="alert">

          {submitError}

        </p>

      )}



      <div className="space-y-1">

        <label htmlFor="displayName" className="text-sm font-medium">

          {t('form.displayName')}

        </label>

        <input

          id="displayName"

          className="border-border bg-surface w-full rounded-md border px-3 py-2 text-base"

          aria-invalid={!!errors.displayName}

          aria-describedby={errors.displayName ? 'displayName-error' : 'displayName-hint'}

          {...register('displayName')}

        />

        <p id="displayName-hint" className="text-muted-foreground text-xs">

          {t('form.displayNameHint')}

        </p>

        {fieldError('displayName') && (

          <p id="displayName-error" className="text-error text-sm">

            {fieldError('displayName')}

          </p>

        )}

      </div>



      <div className="grid gap-4 sm:grid-cols-2">

        <div className="space-y-1">

          <label htmlFor="cnic" className="text-sm font-medium">

            {t('form.cnic')}

          </label>

          <input

            id="cnic"

            inputMode="numeric"

            className="border-border bg-surface w-full rounded-md border px-3 py-2 text-base"

            aria-invalid={!!cnicFieldError || showIdentifierRequired}

            aria-describedby={cnicFieldError || showIdentifierRequired ? 'cnic-error' : 'cnic-hint'}

            {...register('cnic')}

          />

          <p id="cnic-hint" className="text-muted-foreground text-xs">

            {t('form.cnicHint')}

          </p>

          {(cnicFieldError || showIdentifierRequired) && (

            <p id="cnic-error" className="text-error text-sm">

              {showIdentifierRequired ? t('form.validation.identifierRequired') : cnicFieldError}

            </p>

          )}

        </div>

        <div className="space-y-1">

          <label htmlFor="ntn" className="text-sm font-medium">

            {t('form.ntn')}

          </label>

          <input

            id="ntn"

            inputMode="numeric"

            className="border-border bg-surface w-full rounded-md border px-3 py-2 text-base"

            aria-invalid={!!ntnFieldError}

            aria-describedby={ntnFieldError ? 'ntn-error' : 'ntn-hint'}

            {...register('ntn')}

          />

          <p id="ntn-hint" className="text-muted-foreground text-xs">

            {t('form.ntnHint')}

          </p>

          {ntnFieldError && (

            <p id="ntn-error" className="text-error text-sm">

              {ntnFieldError}

            </p>

          )}

        </div>

      </div>



      <div className="grid gap-4 sm:grid-cols-2">

        <div className="space-y-1">

          <label htmlFor="type" className="text-sm font-medium">

            {t('form.type')}

          </label>

          <select

            id="type"

            className="border-border bg-surface w-full rounded-md border px-3 py-2 text-base"

            {...register('type')}

          >

            {clientTypes.map((value) => (

              <option key={value} value={value}>

                {t(`type.${value}`)}

              </option>

            ))}

          </select>

        </div>

        <div className="space-y-1">

          <label htmlFor="filerStatus" className="text-sm font-medium">

            {t('form.filerStatus')}

          </label>

          <select

            id="filerStatus"

            className="border-border bg-surface w-full rounded-md border px-3 py-2 text-base"

            {...register('filerStatus')}

          >

            {filerStatuses.map((value) => (

              <option key={value} value={value}>

                {t(`filerStatus.${value}`)}

              </option>

            ))}

          </select>

        </div>

      </div>



      <div className="flex gap-3 pt-2">

        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>

          {t('form.save')}

        </Button>

      </div>

    </form>

  )

}

