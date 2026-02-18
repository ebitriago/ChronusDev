import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('Smoke Test', () => {
    it('renders correctly', () => {
        render(<div data-testid="smoke-test">Hello World</div>)
        expect(screen.getByTestId('smoke-test')).toBeInTheDocument()
        expect(screen.getByText('Hello World')).toBeInTheDocument()
    })
})
