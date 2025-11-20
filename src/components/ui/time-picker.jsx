import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

export function TimePicker({ 
  value, 
  onChange, 
  placeholder = "Sélectionner une heure",
  className,
  disabled,
  required,
  step = 1 // minutes step (1, 5, 15, 30)
}) {
  const [open, setOpen] = React.useState(false)
  
  // Parse the value if it's a string (from input type="time" format HH:MM)
  const timeValue = React.useMemo(() => {
    if (!value) return { hour: null, minute: null }
    if (typeof value === 'string' && value.match(/^\d{2}:\d{2}$/)) {
      const [hour, minute] = value.split(':').map(Number)
      return { hour, minute }
    }
    return { hour: null, minute: null }
  }, [value])

  // Generate hours (0-23)
  const hours = React.useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i)
  }, [])

  // Generate minutes based on step
  const minutes = React.useMemo(() => {
    const minuteList = []
    for (let i = 0; i < 60; i += step) {
      minuteList.push(i)
    }
    return minuteList
  }, [step])

  const handleHourChange = (hour) => {
    const newHour = parseInt(hour)
    const currentMinute = timeValue.minute !== null ? timeValue.minute : 0
    const formatted = `${String(newHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`
    onChange?.(formatted)
  }

  const handleMinuteChange = (minute) => {
    const currentHour = timeValue.hour !== null ? timeValue.hour : 0
    const newMinute = parseInt(minute)
    const formatted = `${String(currentHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`
    onChange?.(formatted)
  }

  const formatDisplayTime = (hour, minute) => {
    if (hour === null || minute === null) return null
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  const displayValue = timeValue.hour !== null && timeValue.minute !== null
    ? formatDisplayTime(timeValue.hour, timeValue.minute)
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !displayValue && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          type="button"
        >
          <Clock className="mr-2 h-4 w-4" />
          {displayValue ? (
            displayValue
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Hour and Minute Selectors */}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="text-xs text-white mb-1 block font-medium">Heure</label>
              <Select
                value={timeValue.hour !== null ? timeValue.hour.toString() : undefined}
                onValueChange={handleHourChange}
              >
                <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="--" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 max-h-[200px]">
                  {hours.map((hour) => (
                    <SelectItem key={hour} value={hour.toString()} className="hover:bg-slate-700">
                      {String(hour).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-6 text-white text-xl font-bold">:</div>
            <div className="flex-1">
              <label className="text-xs text-white mb-1 block font-medium">Minute</label>
              <Select
                value={timeValue.minute !== null ? timeValue.minute.toString() : undefined}
                onValueChange={handleMinuteChange}
              >
                <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="--" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 max-h-[200px]">
                  {minutes.map((minute) => (
                    <SelectItem key={minute} value={minute.toString()} className="hover:bg-slate-700">
                      {String(minute).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700"
            >
              Fermer
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

