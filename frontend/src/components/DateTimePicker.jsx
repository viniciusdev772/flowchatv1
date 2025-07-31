import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

const DateTimePicker = ({ 
  selected, 
  onChange, 
  placeholderText = "Selecione data e hora",
  className = "",
  minDate = new Date(),
  showTimeSelect = true,
  dateFormat = "dd/MM/yyyy HH:mm",
  timeFormat = "HH:mm",
  timeIntervals = 15
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const customInput = React.forwardRef(({ value, onClick }, ref) => (
    <div 
      className={`relative w-full cursor-pointer ${className}`}
      onClick={onClick}
      ref={ref}
    >
      <div className="flex items-center w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl bg-white hover:border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
        <div className="flex items-center flex-1 gap-3">
          <Calendar className="w-5 h-5 text-gray-500" />
          <span className={`${!value ? 'text-gray-500' : 'text-gray-900'}`}>
            {value || placeholderText}
          </span>
        </div>
        <Clock className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  ));

  customInput.displayName = 'CustomInput';

  return (
    <>
      <style jsx global>{`
        .react-datepicker-wrapper {
          width: 100%;
        }
        
        .react-datepicker {
          font-family: inherit;
          border: 2px solid #e5e7eb;
          border-radius: 1rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          background: white;
        }
        
        .react-datepicker__header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-bottom: none;
          border-radius: 0.875rem 0.875rem 0 0;
          padding: 1rem;
        }
        
        .react-datepicker__current-month {
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 0.5rem;
        }
        
        .react-datepicker__day-names {
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          padding-top: 0.5rem;
        }
        
        .react-datepicker__day-name {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
          font-size: 0.875rem;
          width: 2.5rem;
          height: 2.5rem;
          line-height: 2.5rem;
        }
        
        .react-datepicker__month-container {
          background: white;
        }
        
        .react-datepicker__month {
          padding: 1rem;
        }
        
        .react-datepicker__day {
          width: 2.5rem;
          height: 2.5rem;
          line-height: 2.5rem;
          margin: 0.125rem;
          border-radius: 0.5rem;
          color: #374151;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .react-datepicker__day:hover {
          background: #dbeafe;
          color: #1d4ed8;
          transform: scale(1.05);
        }
        
        .react-datepicker__day--selected {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          font-weight: 600;
        }
        
        .react-datepicker__day--selected:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          transform: scale(1.05);
        }
        
        .react-datepicker__day--today {
          background: #fef3c7;
          color: #d97706;
          font-weight: 600;
        }
        
        .react-datepicker__day--disabled {
          color: #d1d5db;
          cursor: not-allowed;
        }
        
        .react-datepicker__day--disabled:hover {
          background: transparent;
          transform: none;
        }
        
        .react-datepicker__day--outside-month {
          color: #d1d5db;
        }
        
        .react-datepicker__navigation {
          top: 1.25rem;
          width: 2rem;
          height: 2rem;
          border-radius: 0.5rem;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          transition: all 0.2s ease;
        }
        
        .react-datepicker__navigation:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }
        
        .react-datepicker__navigation-icon::before {
          border-color: white;
          border-width: 2px 2px 0 0;
          width: 0.5rem;
          height: 0.5rem;
        }
        
        .react-datepicker__time-container {
          border-left: 2px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 0 1rem 1rem 0;
        }
        
        .react-datepicker__time-container .react-datepicker__time {
          background: #f9fafb;
          border-radius: 0 1rem 1rem 0;
        }
        
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box {
          border-radius: 0 1rem 1rem 0;
        }
        
        .react-datepicker__header--time {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-weight: 600;
          border-radius: 0;
          padding: 0.75rem;
        }
        
        .react-datepicker__time-list-item {
          padding: 0.5rem 1rem;
          font-weight: 500;
          color: #374151;
          transition: all 0.2s ease;
        }
        
        .react-datepicker__time-list-item:hover {
          background: #dbeafe;
          color: #1d4ed8;
        }
        
        .react-datepicker__time-list-item--selected {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-weight: 600;
        }
        
        .react-datepicker__time-list-item--selected:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
        }
        
        .react-datepicker__triangle {
          display: none;
        }
        
        .react-datepicker-popper {
          z-index: 9999;
        }
        
        .react-datepicker-popper[data-placement^="bottom"] {
          margin-top: 0.5rem;
        }
        
        .react-datepicker-popper[data-placement^="top"] {
          margin-bottom: 0.5rem;
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
        customInput={customInput}
        placeholderText={placeholderText}
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => setIsOpen(false)}
        popperClassName="react-datepicker-popper"
        calendarClassName="react-datepicker-calendar"
        showPopperArrow={false}
        fixedHeight
        monthsShown={1}
        todayButton="Hoje"
      />
    </>
  );
};

export default DateTimePicker;