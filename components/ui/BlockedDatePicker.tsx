import React, { useState, useRef, useEffect } from 'react';
import { ScheduleBlock } from '../../services/scheduleBlockService';

type DayStatus = 'free' | 'partial' | 'blocked';

interface BlockedDatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    blocks: ScheduleBlock[];
    disabled?: boolean;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const toDateString = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const BlockedDatePicker: React.FC<BlockedDatePickerProps> = ({ value, onChange, blocks, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        const base = value ? new Date(value + 'T12:00:00') : new Date();
        return new Date(base.getFullYear(), base.getMonth(), 1);
    });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const openPicker = () => {
        if (disabled) return;
        const base = value ? new Date(value + 'T12:00:00') : new Date();
        setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
        setIsOpen(true);
    };

    const getDayInfo = (dateStr: string, dayOfWeek: number): { status: DayStatus; reasons: string[] } => {
        const matching = blocks.filter(b =>
            (b.block_type === 'SPECIFIC_DAY' && b.date === dateStr) ||
            (b.block_type === 'WEEKLY_RECURRING' && b.day_of_week === dayOfWeek)
        );
        if (matching.length === 0) return { status: 'free', reasons: [] };
        const reasons = matching.map(b => {
            const range = b.start_time && b.end_time
                ? `${b.start_time.substring(0, 5)}–${b.end_time.substring(0, 5)}`
                : 'dia inteiro';
            return b.reason ? `${b.reason} (${range})` : `Bloqueado (${range})`;
        });
        const fullDay = matching.some(b => !b.start_time || !b.end_time);
        return { status: fullDay ? 'blocked' : 'partial', reasons };
    };

    const formatDisplay = (dateStr: string) => {
        if (!dateStr) return 'Selecione a data';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = toDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={openPicker}
                disabled={disabled}
                className="form-input w-full flex items-center justify-between rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-white disabled:opacity-50 text-left"
            >
                <span>{formatDisplay(value)}</span>
                <span className="material-symbols-outlined text-slate-400 text-[20px]">calendar_month</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{monthLabel}</p>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                                aria-label="Mês anterior"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                                aria-label="Próximo mês"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-1">
                        {WEEKDAY_LABELS.map((label, i) => (
                            <span key={i} className="text-center text-[11px] font-black text-slate-400 dark:text-slate-500 py-1">{label}</span>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-1">
                        {Array.from({ length: firstWeekday }).map((_, i) => <span key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = toDateString(year, month, day);
                            const dayOfWeek = new Date(year, month, day).getDay();
                            const { status, reasons } = getDayInfo(dateStr, dayOfWeek);
                            const isSelected = value === dateStr;
                            const isToday = todayStr === dateStr;

                            let dayClasses = 'relative w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-bold transition-colors ';
                            if (status === 'blocked') {
                                dayClasses += 'text-red-400 dark:text-red-500/70 bg-red-50 dark:bg-red-900/20 line-through cursor-not-allowed';
                            } else if (isSelected) {
                                dayClasses += 'bg-primary text-white shadow-sm';
                            } else if (status === 'partial') {
                                dayClasses += 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40';
                            } else {
                                dayClasses += 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700';
                            }
                            if (isToday && !isSelected) {
                                dayClasses += ' ring-1 ring-inset ring-slate-300 dark:ring-slate-600';
                            }

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={status === 'blocked'}
                                    title={reasons.join('\n') || undefined}
                                    onClick={() => {
                                        onChange(dateStr);
                                        setIsOpen(false);
                                    }}
                                    className={dayClasses}
                                >
                                    {day}
                                    {status === 'partial' && !isSelected && (
                                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-600" /> Livre
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Horários bloqueados
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Dia bloqueado
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
