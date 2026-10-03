import { fireEvent, render, screen } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { OtpInput } from '@/components/auth/OtpInput'

describe('OtpInput', () => {
  it('accepts pasted 6-digit code', () => {
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} aria-label="otp" />)
    const input = screen.getByLabelText('otp')

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '123456',
      },
    })

    expect(onChange).toHaveBeenCalled()
    const event = onChange.mock.calls[0]?.[0] as ChangeEvent<HTMLInputElement> | undefined
    expect(event?.target.value).toBe('123456')
  })
})
