"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calendarSeries, dateLabel, moods, shiftDate, type Entry } from "@/lib/mood";
import styles from "./mood-chart.module.css";

type Tooltip = { date: string; score: number; left: number; top: number; arrowLeft: number; below: boolean };

export default function MoodChart({ entries, today, range, onAnnotate }: { entries: Entry[]; today: string; range: string; onAnnotate?: (entry: Entry) => void }) {
  const tooltipId = useId();
  const chart = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function measure() {
      const matrix = chart.current?.getScreenCTM();
      if (matrix) setScale(Math.hypot(matrix.a, matrix.b) || 1);
      setTooltip(null);
    }
    const observer = new ResizeObserver(measure);
    if (chart.current) observer.observe(chart.current);
    const dismiss = () => setTooltip(null);
    window.addEventListener("scroll", dismiss, true);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("scroll", dismiss, true); };
  }, []);

  function showTooltip(target: SVGGElement, date: string, score: number) {
    // Measure the visible dot, not the enlarged invisible hit target.
    const dot = target.querySelector("[data-visible-dot]")!.getBoundingClientRect();
    const center = dot.left + dot.width / 2;
    const hasNote = entries.find(entry => entry.date === date)?.note;
    const tooltipWidth = hasNote ? 240 : 184;
    const left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, center - tooltipWidth / 2));
    const below = dot.top < (hasNote ? 190 : 120);
    setTooltip({ date, score, left, top: below ? dot.bottom + 14 : dot.top - 14, arrowLeft: center - left, below });
  }

  const start = range === "all" ? (entries[0]?.date ?? shiftDate(today, -29)) : shiftDate(today, -(Number(range) - 1));
  const points = calendarSeries(entries, start, today);
  const byDate = new Map(entries.map(entry => [entry.date, entry]));
  const tooltipNote = tooltip ? byDate.get(tooltip.date)?.note : undefined;
  const width = 900, height = 240, left = 36, right = 18, top = 18, bottom = 40;
  const x = (index: number) => left + (points.length === 1 ? .5 : index / (points.length - 1)) * (width - left - right);
  const y = (score: number) => top + (5 - score) / 4 * (height - top - bottom);
  const lines: string[] = [];
  let current = "";
  points.forEach((point, index) => {
    if (point.score === null) { if (current) lines.push(current); current = ""; }
    else current += `${current ? " L" : "M"}${x(index)} ${y(point.score)}`;
  });
  if (current) lines.push(current);
  const labels = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return <>
    <svg ref={chart} className="mood-chart" viewBox={`0 0 ${width} ${height}`} role="group"
      aria-label={`Mood scores from ${dateLabel(start)} to ${dateLabel(today)}. Missing days are gaps. Exact scores are in the table below.`}
      onPointerLeave={() => setTooltip(null)}
      onKeyDown={event => { if (event.key === "Escape") setTooltip(null); }}>
      {[1, 2, 3, 4, 5].map(score => <g key={score}><line x1={left} x2={width - right} y1={y(score)} y2={y(score)} stroke="#e9ece6" strokeDasharray="3 5" /><text x="10" y={y(score) + 4} fill="#7a827b" fontSize="12">{score}</text></g>)}
      {lines.map((line, index) => <path key={index} d={line} stroke="#527d65" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
      {points.map((point, index) => {
        if (point.score === null) return null;
        const score = point.score;
        return <g key={point.date} className={styles.point} style={{ cursor: "pointer" }} role="button" tabIndex={0}
          aria-label={`${dateLabel(point.date)}: ${score} (${moods[score - 1].label})${byDate.get(point.date)?.note ? ". Has a note." : ""}${onAnnotate ? " Edit day’s note." : ""}`}
          aria-haspopup={onAnnotate ? "dialog" : undefined}
          aria-describedby={tooltip?.date === point.date ? tooltipId : undefined}
          onPointerEnter={event => showTooltip(event.currentTarget, point.date, score)}
          onPointerLeave={() => setTooltip(null)}
          onFocus={event => showTooltip(event.currentTarget, point.date, score)}
          onBlur={() => setTooltip(null)}
          onClick={event => { if (onAnnotate) { setTooltip(null); onAnnotate(byDate.get(point.date)!); } else showTooltip(event.currentTarget, point.date, score); }}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (onAnnotate) { setTooltip(null); onAnnotate(byDate.get(point.date)!); } else showTooltip(event.currentTarget, point.date, score); }
          }}>
          <circle className={styles.halo} cx={x(index)} cy={y(score)} r="9" fill={moods[score - 1].color} opacity={tooltip?.date === point.date ? .2 : 0} pointerEvents="none" />
          <circle data-visible-dot cx={x(index)} cy={y(score)} r="4.5" fill={moods[score - 1].color} stroke="white" strokeWidth="2" pointerEvents="none" />
          {byDate.get(point.date)?.note && <circle cx={x(index) + 6} cy={y(score) - 6} r="2.5" fill="#35482e" stroke="white" strokeWidth="1" pointerEvents="none" />}
          <ellipse data-hit-target cx={x(index)} cy={y(score)}
            rx={Math.max(4.5, Math.min(22 / scale, (width - left - right) / Math.max(1, points.length - 1) / 2))}
            ry={22 / scale} fill="transparent" pointerEvents="all" style={{ cursor: "pointer" }} />
        </g>;
      })}
      {labels.map(index => <text key={index} x={x(index)} y={height - 9} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fill="#7a827b" fontSize="12">{dateLabel(points[index].date)}</text>)}
    </svg>
    {tooltip && createPortal(<div id={tooltipId} role="tooltip" className={styles.tooltip}
      style={{ position: "fixed", zIndex: 1000, pointerEvents: "none", left: tooltip.left, top: tooltip.top, width: tooltipNote ? 240 : 184, transform: tooltip.below ? "none" : "translateY(-100%)" }}>
      <span className={styles.date}>{dateLabel(tooltip.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
      <span className={styles.score}><span className={styles.swatch} style={{ background: moods[tooltip.score - 1].color }} />{tooltip.score} / 5 <span className={styles.label}>({moods[tooltip.score - 1].label})</span></span>
      {tooltipNote && <p className={styles.note}>{tooltipNote}</p>}
      {onAnnotate && <span className={styles.hint}>Click to {tooltipNote ? "edit" : "add"} a note</span>}
      <span className={styles.arrow} style={{ left: tooltip.arrowLeft, ...(tooltip.below ? { top: -5, transform: "translateX(-50%) rotate(225deg)" } : { bottom: -5 }) }} />
    </div>, document.body)}
  </>;
}
