import * as React from 'react';
import DatePicker from 'react-datepicker';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import 'react-datepicker/dist/react-datepicker.css';

const DateTimePicker = React.forwardRef(({
  selected,
  onChange,
  placeholderText = "Selecione data e hora",
  className,
  minDate = new Date(),
  showTimeSelect = true,
  dateFormat = "dd/MM/yyyy HH:mm",
  timeFormat = "HH:mm",
  timeIntervals = 15,
  ...props
}, ref) => {

  const CustomInput = React.forwardRef(({ value, onClick }, inputRef) => (
    <div
      className={cn(
        "relative w-full cursor-pointer",
        className
      )}
      onClick={onClick}
      ref={inputRef}
    >
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:border-muted-foreground focus-within:outline-none focus-within:ring-1 focus-within:ring-ring">
        <div className="flex items-center flex-1 gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className={cn(
            "text-sm",
            !value ? "text-muted-foreground" : "text-foreground"
          )}>
            {value || placeholderText}
          </span>
        </div>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  ));

  CustomInput.displayName = 'CustomInput';

  return (
    <>
      <style jsx global>{`
        .react-datepicker-wrapper {
          width: 100%;
        }

        .react-datepicker {
          font-family: inherit;
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          background: hsl(var(--background));
        }

        .react-datepicker__header {
          background: hsl(var(--primary));
          border-bottom: none;
          border-radius: 0.75rem 0.75rem 0 0;
          padding: 1rem;
        }

        .react-datepicker__current-month {
          color: hsl(var(--primary-foreground));
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .react-datepicker__day-names {
          border-top: 1px solid hsl(var(--primary-foreground) / 0.2);
          padding-top: 0.5rem;
        }

        .react-datepicker__day-name {
          color: hsl(var(--primary-foreground) / 0.9);
          font-weight: 600;
          font-size: 0.75rem;
          width: 2rem;
          height: 2rem;
          line-height: 2rem;
        }

        .react-datepicker__month-container {
          background: hsl(var(--background));
        }

        .react-datepicker__month {
          padding: 0.75rem;
        }

        .react-datepicker__day {
          width: 2rem;
          height: 2rem;
          line-height: 2rem;
          margin: 0.125rem;
          border-radius: 0.375rem;
          color: hsl(var(--foreground));
          font-weight: 500;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .react-datepicker__day:hover {
          background: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }

        .react-datepicker__day--selected {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-weight: 600;
        }

        .react-datepicker__day--selected:hover {
          background: hsl(var(--primary) / 0.9);
        }

        .react-datepicker__day--today {
          background: hsl(var(--secondary));
          color: hsl(var(--secondary-foreground));
          font-weight: 600;
        }

        .react-datepicker__day--disabled {
          color: hsl(var(--muted-foreground));
          cursor: not-allowed;
        }

        .react-datepicker__day--disabled:hover {
          background: transparent;
        }

        .react-datepicker__day--outside-month {
          color: hsl(var(--muted-foreground));
        }

        .react-datepicker__navigation {
          top: 1rem;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 0.375rem;
          background: hsl(var(--primary-foreground) / 0.2);
          border: 1px solid hsl(var(--primary-foreground) / 0.3);
          transition: all 0.2s ease;
        }

        .react-datepicker__navigation:hover {
          background: hsl(var(--primary-foreground) / 0.3);
        }

        .react-datepicker__navigation-icon::before {
          border-color: hsl(var(--primary-foreground));
          border-width: 1px 1px 0 0;
          width: 0.375rem;
          height: 0.375rem;
        }

        .react-datepicker__time-container {
          border-left: 1px solid hsl(var(--border));
          background: hsl(var(--muted));
          border-radius: 0 0.75rem 0.75rem 0;
        }

        .react-datepicker__time-container .react-datepicker__time {
          background: hsl(var(--muted));
          border-radius: 0 0.75rem 0.75rem 0;
        }

        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box {
          border-radius: 0 0.75rem 0.75rem 0;
        }

        .react-datepicker__header--time {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-weight: 600;
          border-radius: 0;
          padding: 0.75rem;
        }

        .react-datepicker__time-list-item {
          padding: 0.5rem 0.75rem;
          font-weight: 500;
          color: hsl(var(--foreground));
          transition: all 0.2s ease;
          font-size: 0.875rem;
        }

        .react-datepicker__time-list-item:hover {
          background: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }

        .react-datepicker__time-list-item--selected {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-weight: 600;
        }

        .react-datepicker__triangle {
          display: none;
        }

        .react-datepicker-popper {
          z-index: 9999;
        }

        .react-datepicker-popper[data-placement^="bottom"] {
          margin-top: 0.25rem;
        }

        .react-datepicker-popper[data-placement^="top"] {
          margin-bottom: 0.25rem;
        }
      `}</style>

      <DatePicker
        selected={selected}
        onChange={onChange}
        showTimeSelect={showTimeSelect}
        timeFormat={timeFormat}
        timeIntervals={timeIntervals}
        dateFormat={dateFormat}
        locale={ptBR}
        minDate={minDate}
        customInput={<CustomInput />}
        placeholderText={placeholderText}
        popperClassName="react-datepicker-popper"
        calendarClassName="react-datepicker-calendar"
        showPopperArrow={false}
        fixedHeight
        monthsShown={1}
        todayButton="Hoje"
        ref={ref}
        {...props}
      />
    </>
  );
});

DateTimePicker.displayName = "DateTimePicker";

export default DateTimePicker;