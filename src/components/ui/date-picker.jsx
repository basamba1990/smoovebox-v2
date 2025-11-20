import * as React from "react"
import { format, startOfMonth, setMonth, setYear, getYear, getMonth } from "date-fns"
import { fr } from "date-fns/locale/fr"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({ 
  value, 
  onChange, 
  placeholder = "Sélectionner une date",
  className,
  disabled,
  required,
  maxDate,
  minDate
}) {
  const [open, setOpen] = React.useState(false)
  
  // Parse the value if it's a string (from input type="date")
  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return value
    // Handle YYYY-MM-DD format from input type="date"
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parsed = new Date(value + 'T00:00:00')
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    return undefined
  }, [value])

  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (dateValue) {
      return startOfMonth(dateValue)
    }
    return startOfMonth(new Date())
  })

  // Update currentMonth when value changes
  React.useEffect(() => {
    if (dateValue) {
      setCurrentMonth(startOfMonth(dateValue))
    }
  }, [dateValue])

  // Generate years list (100 years back, 10 years forward)
  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    const startYear = minDate ? getYear(minDate) : currentYear - 100
    const endYear = maxDate ? getYear(maxDate) : currentYear + 10
    const yearList = []
    for (let year = startYear; year <= endYear; year++) {
      yearList.push(year)
    }
    return yearList.reverse()
  }, [minDate, maxDate])

  // Generate months list
  const months = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: format(new Date(2000, i, 1), 'MMMM', { locale: fr })
    }))
  }, [])

  const handleMonthChange = (monthIndex) => {
    const newMonth = setMonth(currentMonth, parseInt(monthIndex))
    setCurrentMonth(newMonth)
  }

  const handleYearChange = (year) => {
    const newMonth = setYear(currentMonth, parseInt(year))
    setCurrentMonth(newMonth)
  }

  const handleSelect = (date) => {
    if (date) {
      // Format as YYYY-MM-DD for compatibility with form inputs
      const formatted = format(date, 'yyyy-MM-dd')
      onChange?.(formatted)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          type="button"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? (
            format(dateValue, "PPP", { locale: fr })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Year and Month Selectors */}
          <div className="flex gap-2">
            <Select
              value={getYear(currentMonth).toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 max-h-[200px]">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()} className="hover:bg-slate-700">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={getMonth(currentMonth).toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-100 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()} className="hover:bg-slate-700">
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            disabled={disabled}
            initialFocus
            maxDate={maxDate}
            minDate={minDate}
            className="bg-slate-900 text-slate-100"
            classNames={{
              months: "flex flex-col sm:flex-row gap-2",
              month: "flex flex-col gap-4",
              caption: "flex justify-center pt-1 relative items-center w-full",
              caption_label: "text-sm font-medium text-slate-100",
              nav: "flex items-center gap-1",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-slate-100 hover:bg-slate-800 border border-slate-700",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-x-1",
              head_row: "flex",
              head_cell: "text-slate-400 rounded-md w-8 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
              day: "h-8 w-8 p-0 font-normal text-slate-200 hover:bg-slate-800 hover:text-slate-100 aria-selected:opacity-100",
              day_selected: "bg-cyan-500 text-slate-950 hover:bg-cyan-600 hover:text-slate-950 focus:bg-cyan-500 focus:text-slate-950",
              day_today: "bg-slate-800 text-slate-100",
              day_outside: "text-slate-500 opacity-50",
              day_disabled: "text-slate-600 opacity-50",
              day_hidden: "invisible",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

