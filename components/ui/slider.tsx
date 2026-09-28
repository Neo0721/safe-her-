'use client'

import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  id?: string
  'aria-label'?: string
  className?: string
}

function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  id,
  className,
  ...props
}: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className={cn('relative flex h-6 w-full items-center', className)}>
      <div className="relative h-2 w-full rounded-full bg-muted">
        <div
          className="absolute h-2 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="absolute inset-0 h-6 w-full cursor-pointer appearance-none bg-transparent outline-none [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
        {...props}
      />
    </div>
  )
}

export { Slider }
