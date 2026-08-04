import type { EChartsOption, EChartsType } from 'echarts';
import { useEffect, useRef } from 'react';

interface AsyncChartProps {
  option: EChartsOption;
  height?: number;
  ariaLabel: string;
}

export function AsyncChart({ option, height = 260, ariaLabel }: AsyncChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    let chart: EChartsType | null = null;
    let active = true;
    const observer = new ResizeObserver(() => chart?.resize());

    void import('echarts').then((echarts) => {
      if (!active) return;
      chart = echarts.init(element, undefined, { renderer: 'canvas' });
      chart.setOption(option);
      observer.observe(element);
    });

    return () => {
      active = false;
      observer.disconnect();
      chart?.dispose();
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      className="async-chart"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
