"use client";

import { ClockIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dialPositionForHour, hourFromDial, minuteFromDial, nextBuffer, pad2, toTime } from "@/lib/time-input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Form field name (a hidden input carries "HH:mm"). */
  name?: string;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
};

const SIZE = 248;
const CENTER = SIZE / 2;
const OUTER = 100;
const INNER = 66;

function split(value: string) {
  const [h = "", m = ""] = value.split(":");
  return { hour: h, minute: m };
}

/**
 * 24 h time input: two typeable fields (HH : mm) plus a clock dial in a
 * popover, like the Android clock: outer ring 1–12, inner ring 13–00, then
 * minutes in steps of 5.
 */
export function TimePicker({ value, onChange, id, name, className, disabled, ...rest }: Props) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const label = rest["aria-label"] ?? "Hora";
  const { hour, minute } = split(value);
  const minuteRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const commit = (h: string, m: string) => onChange(toTime(Number(h || 0), Number(m || 0)));

  function step(part: "hour" | "minute", delta: number) {
    const h = Number(hour || 0);
    const m = Number(minute || 0);
    if (part === "hour") onChange(toTime((h + delta + 24) % 24, m));
    else {
      const total = (h * 60 + m + delta + 24 * 60) % (24 * 60);
      onChange(toTime(Math.floor(total / 60), total % 60));
    }
  }

  return (
    <div
      className={cn(
        "inline-flex h-10 items-center gap-0.5 rounded-xl border border-input bg-card pr-1 pl-2 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      role="group"
      aria-label={label}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <DigitField
        id={baseId}
        label={`${label}: hora`}
        placeholder="HH"
        part="hour"
        value={hour}
        disabled={disabled}
        onCommit={(h) => {
          commit(h, minute);
          minuteRef.current?.focus();
        }}
        onStep={(delta) => step("hour", delta)}
      />
      <span className="text-muted-foreground">:</span>
      <DigitField
        ref={minuteRef}
        label={`${label}: minutos`}
        placeholder="mm"
        part="minute"
        value={minute}
        disabled={disabled}
        onCommit={(m) => commit(hour, m)}
        onStep={(delta) => step("minute", delta * 5)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={`Elegir ${label.toLowerCase()} en el reloj`}
          disabled={disabled}
          className="ml-0.5 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ClockIcon className="size-4" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          {open && <ClockDial value={value || "09:00"} onChange={onChange} onDone={() => setOpen(false)} />}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ClockDial({ value, onChange, onDone }: { value: string; onChange: (value: string) => void; onDone: () => void }) {
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const reduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const h = Number(value.slice(0, 2));
  const m = Number(value.slice(3, 5));

  function pick(event: React.PointerEvent, final: boolean) {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const angle = (Math.atan2(x, -y) * 180) / Math.PI;
    const distance = Math.hypot(x, y) * (SIZE / rect.width);
    if (mode === "hour") {
      const next = hourFromDial(angle, distance < (OUTER + INNER) / 2);
      onChange(toTime(next, m));
      if (final) setMode("minute");
    } else {
      onChange(toTime(h, minuteFromDial(angle)));
    }
  }

  const hand =
    mode === "hour"
      ? { angle: dialPositionForHour(h).angle, length: dialPositionForHour(h).inner ? INNER : OUTER }
      : { angle: (m / 60) * 360, length: OUTER };

  const handRad = (hand.angle * Math.PI) / 180;
  const handEnd = { x: CENTER + hand.length * Math.sin(handRad), y: CENTER - hand.length * Math.cos(handRad) };

  const label = (n: number, radius: number, angle: number, text: string, selected: boolean, small = false) => {
    const rad = (angle * Math.PI) / 180;
    return (
      <text
        key={`${radius}-${text}`}
        x={CENTER + radius * Math.sin(rad)}
        y={CENTER - radius * Math.cos(rad)}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn(
          "pointer-events-none select-none tabular",
          small ? "text-[12px]" : "text-[14px] font-semibold",
          selected ? "fill-primary-foreground" : small ? "fill-muted-foreground" : "fill-foreground",
        )}
      >
        {text}
      </text>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-baseline gap-1 text-3xl font-extrabold tabular">
        <button
          type="button"
          onClick={() => setMode("hour")}
          className={cn("rounded-lg px-2", mode === "hour" ? "bg-primary-soft text-primary" : "text-muted-foreground")}
        >
          {pad2(h)}
        </button>
        :
        <button
          type="button"
          onClick={() => setMode("minute")}
          className={cn("rounded-lg px-2", mode === "minute" ? "bg-primary-soft text-primary" : "text-muted-foreground")}
        >
          {pad2(m)}
        </button>
      </div>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="slider"
        tabIndex={0}
        aria-label={mode === "hour" ? "Hora" : "Minutos"}
        aria-valuemin={0}
        aria-valuemax={mode === "hour" ? 23 : 59}
        aria-valuenow={mode === "hour" ? h : m}
        aria-valuetext={value}
        className="touch-none rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onPointerDown={(event) => {
          dragging.current = true;
          (event.target as Element).setPointerCapture?.(event.pointerId);
          pick(event, false);
        }}
        onPointerMove={(event) => dragging.current && pick(event, false)}
        onPointerUp={(event) => {
          dragging.current = false;
          pick(event, true);
        }}
        onKeyDown={(event) => {
          const delta = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : event.key === "ArrowDown" || event.key === "ArrowLeft" ? -1 : 0;
          if (delta) {
            event.preventDefault();
            if (mode === "hour") onChange(toTime((h + delta + 24) % 24, m));
            else onChange(toTime(h, (m + delta * 5 + 60) % 60));
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (mode === "hour") setMode("minute");
            else onDone();
          }
        }}
      >
        <circle cx={CENTER} cy={CENTER} r={CENTER - 2} className="fill-muted" />
        {/* Hand: computed endpoint (SVG transforms + CSS origins are unreliable across browsers). */}
        <motion.line
          x1={CENTER}
          y1={CENTER}
          initial={false}
          animate={{ x2: handEnd.x, y2: handEnd.y }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 28 }}
          strokeWidth={2}
          className="stroke-primary"
        />
        <motion.circle
          r={17}
          initial={false}
          animate={{ cx: handEnd.x, cy: handEnd.y }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 28 }}
          className="fill-primary"
        />
        <circle cx={CENTER} cy={CENTER} r={4} className="fill-primary" />
        {mode === "hour"
          ? [
              ...Array.from({ length: 12 }, (_, i) => {
                const n = i === 0 ? 12 : i;
                return label(n, OUTER, i * 30, String(n), h === n);
              }),
              ...Array.from({ length: 12 }, (_, i) => {
                const n = i === 0 ? 0 : i + 12;
                return label(n, INNER, i * 30, pad2(n), h === n, true);
              }),
            ]
          : Array.from({ length: 12 }, (_, i) => label(i * 5, OUTER, i * 30, pad2(i * 5), m === i * 5))}
      </svg>
      <div className="flex w-full items-center justify-between">
        <span className="text-xs text-muted-foreground">{mode === "hour" ? "Tocá la hora" : "Tocá los minutos"}</span>
        <Button type="button" size="sm" onClick={onDone}>
          Listo
        </Button>
      </div>
    </div>
  );
}

const fieldClass =
  "w-8 bg-transparent text-center text-[15px] font-semibold tabular outline-none placeholder:text-muted-foreground/60 focus:rounded-md focus:bg-primary-soft";

/**
 * One 2-digit box (hours or minutes). Typing goes into a buffer that starts
 * empty on focus, so "21" is 21 even if the box showed "08" (no appending).
 * Pasting "14:30" sets the whole time through `onCommit` of each part.
 */
function DigitField({
  ref,
  id,
  label,
  placeholder,
  part,
  value,
  disabled,
  onCommit,
  onStep,
}: {
  ref?: React.Ref<HTMLInputElement>;
  id?: string;
  label: string;
  placeholder: string;
  part: "hour" | "minute";
  value: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  onStep: (delta: number) => void;
}) {
  // The ref is the source of truth (keystrokes can arrive before a
  // re-render); the state only drives what the box shows.
  const bufferRef = useRef<string | null>(null);
  const [buffer, setBufferState] = useState<string | null>(null);
  const setBuffer = (next: string | null) => {
    bufferRef.current = next;
    setBufferState(next);
  };

  function feed(text: string) {
    let current = bufferRef.current ?? "";
    for (const char of text) {
      if (!/\d/.test(char)) continue;
      const next = nextBuffer(current, char, part);
      current = next.buffer;
      if (next.commit) {
        setBuffer(null);
        onCommit(next.commit);
        return;
      }
    }
    setBuffer(current);
  }

  return (
    <input
      ref={ref}
      id={id}
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={fieldClass}
      value={buffer ?? value}
      disabled={disabled}
      onFocus={(event) => {
        setBuffer(null);
        event.target.select();
      }}
      onBeforeInput={(event) => {
        // Typed or pasted text never appends to what the box showed.
        event.preventDefault();
        feed((event.nativeEvent as InputEvent).data ?? "");
      }}
      onChange={(event) => {
        // Fallback for browsers without beforeinput, and clearing the box.
        const digits = event.target.value.replace(/\D/g, "");
        if (digits === "") setBuffer("");
        else feed(digits.slice(-1));
      }}
      onBlur={() => {
        if (bufferRef.current) onCommit(pad2(Number(bufferRef.current)));
        setBuffer(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          onStep(event.key === "ArrowUp" ? 1 : -1);
        } else if (event.key === "Backspace") {
          event.preventDefault();
          setBuffer((bufferRef.current ?? value).slice(0, -1));
        }
      }}
    />
  );
}
