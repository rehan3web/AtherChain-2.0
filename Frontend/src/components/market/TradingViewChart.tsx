'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts';

interface TradingViewChartProps {
    data: any[];
    liveData?: any;
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
    data,
    liveData,
    colors: {
        backgroundColor = 'transparent',
        textColor = '#d1d4dc',
    } = {},
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const candlestickSeriesRef = useRef<any>(null);
    const volumeSeriesRef = useRef<any>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            grid: {
                vertLines: { color: 'rgba(197, 203, 206, 0.02)' },
                horzLines: { color: 'rgba(197, 203, 206, 0.02)' },
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    width: 1,
                    color: 'rgba(224, 227, 235, 0.1)',
                    style: 3,
                    labelBackgroundColor: '#131722',
                },
                horzLine: {
                    width: 1,
                    color: 'rgba(224, 227, 235, 0.1)',
                    style: 3,
                    labelBackgroundColor: '#131722',
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(197, 203, 206, 0.1)',
                autoScale: true,
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.1)',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // Overlay on the main scale
        });

        chart.priceScale('').applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries;
        volumeSeriesRef.current = volumeSeries;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: 400 // Fixed height for now, or use container
                });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial sizing

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [backgroundColor, textColor]);

    // Handle Historical Data
    useEffect(() => {
        if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !data || data.length === 0) return;

        const formattedCandles = data.map(c => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        const formattedVolume = data.map(c => ({
            time: c.time as any,
            value: c.volume,
            color: c.close >= c.open ? '#10b98144' : '#ef444444',
        }));

        candlestickSeriesRef.current.setData(formattedCandles);
        volumeSeriesRef.current.setData(formattedVolume);

        // Fit content on initial load
        chartRef.current?.timeScale().fitContent();
    }, [data]);

    // Handle Live Updates
    useEffect(() => {
        if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !liveData) return;

        const candle = {
            time: liveData.time as any,
            open: liveData.open,
            high: liveData.high,
            low: liveData.low,
            close: liveData.close,
        };

        const vol = {
            time: liveData.time as any,
            value: liveData.volume,
            color: liveData.close >= liveData.open ? '#10b98144' : '#ef444444',
        };

        // Lightweight charts handles the update internally based on the timestamp
        candlestickSeriesRef.current.update(candle);
        volumeSeriesRef.current.update(vol);
    }, [liveData]);

    return <div ref={chartContainerRef} className="w-full h-full min-h-[400px]" />;
};
