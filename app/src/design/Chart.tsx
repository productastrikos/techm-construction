import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, GaugeChart, HeatmapChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { useApp } from '../app/store';

echarts.use([
  BarChart,
  CustomChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export interface ChartPalette {
  text: string;
  muted: string;
  line: string;
  grid: string;
  accent: string;
  good: string;
  bad: string;
  warn: string;
  info: string;
  violet: string;
  surface: string;
}

/** reads the active CSS-variable theme so charts follow dark/light */
export function useChartPalette(): ChartPalette {
  const theme = useApp((s) => s.theme);
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    return {
      text: g('--text', '#e6f3f4'),
      muted: g('--muted', '#9bbcc1'),
      line: g('--line-2', '#24505b'),
      grid: g('--grid', 'rgba(120,180,190,0.12)'),
      accent: g('--accent', '#3ee0b0'),
      good: g('--good', '#3ee0b0'),
      bad: g('--bad', '#ff6b6b'),
      warn: g('--warn', '#f7b84b'),
      info: g('--info', '#5bb8ff'),
      violet: g('--violet', '#a78bfa'),
      surface: g('--surface', '#0a1d23'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

export function Chart({
  option,
  height = 260,
  className,
  onClick,
  onReady,
}: {
  option: EChartsCoreOption;
  height?: number | string;
  className?: string;
  onClick?: (p: { name?: string; dataIndex?: number; seriesName?: string; data?: unknown }) => void;
  onReady?: (c: echarts.ECharts) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const lang = useApp((s) => s.lang);
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'canvas' });
    chart.current = c;
    onReady?.(c);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.setOption({ animationDuration: 350, textStyle: { fontFamily: lang === 'ar' ? '"IBM Plex Sans Arabic", sans-serif' : '"Inter Variable", sans-serif' }, ...option }, true);
  }, [option, lang]);
  useEffect(() => {
    const c = chart.current;
    if (!c || !onClick) return;
    c.off('click');
    c.on('click', (p) => onClick(p as never));
  }, [onClick]);
  return <div ref={el} className={className} style={{ height, width: '100%' }} dir="ltr" />;
}
