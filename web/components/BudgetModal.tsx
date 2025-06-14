import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { X } from 'lucide-react'

interface BudgetModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (budget: number) => void
}

export default function BudgetModal({ open, onClose, onSubmit }: BudgetModalProps) {
  const [budget, setBudget] = useState('')
  const [error, setError] = useState('')

  const presetAmounts = [500000, 3000000, 10000000]

  const handleSubmit = () => {
    const cleanBudget = budget.replace(/[^0-9]/g, '')
    const budgetValue = parseFloat(cleanBudget)
    console.log('BudgetModal submit:', { budget, cleanBudget, budgetValue })
    
    if (isNaN(budgetValue) || budgetValue < 500000) {
      setError('Minimum budget is $500,000')
      return
    }
    onSubmit(budgetValue)
    setBudget('')
    setError('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const formatCurrency = (value: string) => {
    const num = value.replace(/[^0-9]/g, '')
    return num ? parseInt(num).toLocaleString() : ''
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white border-2 border-stone-300">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold font-funnel text-forest-green">Investment Budget</DialogTitle>
          <DialogDescription className="text-base text-stone-600 font-funnel">
            How much would you like to invest in establishing food banks? We'll optimize locations to maximize impact within your budget.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Preset amounts */}
          <div className="grid grid-cols-3 gap-3">
            {presetAmounts.map((amount) => (
              <Button
                key={amount}
                variant={budget === amount.toString() ? "default" : "outline"}
                className={`font-funnel font-semibold transition-all ${
                  budget === amount.toString() 
                    ? 'bg-forest-green hover:bg-forest-green-dark text-stone-50 border-2 border-forest-green' 
                    : 'bg-white hover:bg-stone-100 border-2 border-stone-300 hover:border-forest-green text-forest-green'
                }`}
                onClick={() => setBudget(amount.toString())}
              >
                ${amount >= 1000000 ? `${amount / 1000000}M` : '500K'}
              </Button>
            ))}
          </div>

          {/* Custom amount input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700 font-funnel">
              Custom Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 text-lg font-funnel">
                $
              </span>
              <Input
                type="text"
                value={formatCurrency(budget)}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder="500,000"
                className="pl-10 text-lg font-semibold font-funnel h-12 border-2 border-stone-300 focus:border-forest-green focus:ring-0 bg-stone-50"
                autoFocus
              />
            </div>
          </div>

          {/* Info/Error message */}
          <div className={`p-3 rounded-lg border font-funnel text-sm ${
            error || (budget && parseFloat(budget) < 500000)
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-stone-100 border-stone-300 text-stone-700'
          }`}>
            {error || (budget && parseFloat(budget) < 500000) ? (
              <p>Minimum budget is $500,000 to establish at least one food bank</p>
            ) : (
              <p>
                {budget && parseFloat(budget) >= 500000
                  ? `This budget can establish approximately ${Math.floor(parseFloat(budget) / 300000)} food banks`
                  : 'Enter a budget to see estimated coverage'}
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={!budget || parseFloat(budget) < 500000}
            className="w-full h-12 text-lg font-bold font-funnel bg-forest-green hover:bg-forest-green-dark text-stone-50 disabled:bg-stone-300 disabled:text-stone-500"
          >
            {budget && parseFloat(budget) >= 500000 ? 'Start Optimization' : 'Enter Valid Budget'}
          </Button>

          <p className="text-center text-xs text-stone-500 font-funnel">
            Press Enter to continue • Escape to cancel
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
} 