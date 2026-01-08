/**
 * Service d'optimisation de performance
 * Lazy loading, code splitting, memoization
 */

import { lazy, Suspense, ComponentType, ReactNode } from 'react';
import { memo, useMemo, useCallback } from 'react';

// ================================================
// LAZY LOADING DES ROUTES
// ================================================

/**
 * Lazy load d'un composant avec fallback
 */
export function lazyLoad<T extends ComponentType<any>>(
    importFunc: () => Promise<{ default: T }>,
    fallback: ReactNode = <div>Chargement...</div>
) {
    const LazyComponent = lazy(importFunc);

    return (props: any) => (
        <Suspense fallback= { fallback } >
        <LazyComponent { ...props } />
        </Suspense>
  );
}

// Routes lazy-loaded
export const DashboardView = lazyLoad(() => import('@/components/views/DashboardView'));
export const LivraisonsView = lazyLoad(() => import('@/components/views/LivraisonsView'));
export const InstallationsView = lazyLoad(() => import('@/components/views/InstallationsView'));
export const StockView = lazyLoad(() => import('@/components/views/StockView'));
export const HistoryView = lazyLoad(() => import('@/components/views/HistoryView'));
export const MapView = lazyLoad(() => import('@/components/views/MapView'));

// ================================================
// MEMOIZATION
// ================================================

/**
 * Hook pour memoizer des calculs coûteux
 */
export function useMemoizedValue<T>(
    factory: () => T,
    deps: React.DependencyList
): T {
    return useMemo(factory, deps);
}

/**
 * Hook pour memoizer des callbacks
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList
): T {
    return useCallback(callback, deps) as T;
}

/**
 * HOC pour memoizer un composant
 */
export function withMemo<P extends object>(
    Component: ComponentType<P>,
    propsAreEqual?: (prevProps: P, nextProps: P) => boolean
) {
    return memo(Component, propsAreEqual);
}

// ================================================
// DEBOUNCE & THROTTLE
// ================================================

/**
 * Debounce une fonction
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle une fonction
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// ================================================
// VIRTUAL SCROLLING
// ================================================

/**
 * Hook pour virtual scrolling de grandes listes
 */
export function useVirtualScroll<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number
) {
    const [scrollTop, setScrollTop] = useState(0);

    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
        startIndex + Math.ceil(containerHeight / itemHeight) + 1,
        items.length
    );

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;

    return {
        visibleItems,
        offsetY,
        totalHeight: items.length * itemHeight,
        onScroll: (e: React.UIEvent<HTMLDivElement>) => {
            setScrollTop(e.currentTarget.scrollTop);
        }
    };
}

// ================================================
// IMAGE OPTIMIZATION
// ================================================

/**
 * Lazy load d'images
 */
export function useLazyImage(src: string) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            setImageSrc(src);
            setIsLoading(false);
        };
    }, [src]);

    return { imageSrc, isLoading };
}

/**
 * Composant Image optimisé
 */
export const OptimizedImage = memo(({
    src,
    alt,
    className,
    placeholder = '/placeholder.svg'
}: {
    src: string;
    alt: string;
    className?: string;
    placeholder?: string;
}) => {
    const { imageSrc, isLoading } = useLazyImage(src);

    return (
        <img
      src= { isLoading? placeholder: imageSrc || placeholder }
    alt = { alt }
    className = { className }
    loading = "lazy"
        />
  );
});

// ================================================
// CACHE
// ================================================

/**
 * Cache simple en mémoire
 */
class MemoryCache<T = any> {
    private cache = new Map<string, { data: T; timestamp: number }>();
    private ttl: number;

    constructor(ttlMinutes: number = 5) {
        this.ttl = ttlMinutes * 60 * 1000;
    }

    set(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(key: string): T | null {
        const cached = this.cache.get(key);

        if (!cached) return null;

        // Vérifier l'expiration
        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clear(): void {
        this.cache.clear();
    }

    delete(key: string): void {
        this.cache.delete(key);
    }
}

export const apiCache = new MemoryCache(5); // 5 minutes

// ================================================
// PREFETCH
// ================================================

/**
 * Prefetch des données
 */
export async function prefetchData(url: string): Promise<void> {
    try {
        const response = await fetch(url);
        const data = await response.json();
        apiCache.set(url, data);
    } catch (error) {
        console.error('Prefetch error:', error);
    }
}

/**
 * Hook pour prefetch au hover
 */
export function usePrefetch(url: string) {
    const handleMouseEnter = useCallback(() => {
        prefetchData(url);
    }, [url]);

    return { onMouseEnter: handleMouseEnter };
}

// ================================================
// BATCH UPDATES
// ================================================

/**
 * Batch plusieurs mises à jour
 */
export function batchUpdates<T>(
    updates: T[],
    batchSize: number = 10
): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < updates.length; i += batchSize) {
        batches.push(updates.slice(i, i + batchSize));
    }

    return batches;
}

// ================================================
// WEB WORKERS
// ================================================

/**
 * Exécuter du code dans un Web Worker
 */
export function runInWorker<T, R>(
    fn: (data: T) => R,
    data: T
): Promise<R> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([`
      self.onmessage = function(e) {
        const fn = ${fn.toString()};
        const result = fn(e.data);
        self.postMessage(result);
      }
    `], { type: 'application/javascript' });

        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = (e) => {
            resolve(e.data);
            worker.terminate();
        };

        worker.onerror = (error) => {
            reject(error);
            worker.terminate();
        };

        worker.postMessage(data);
    });
}

// ================================================
// UTILS
// ================================================

import { useState, useEffect } from 'react';

/**
 * Hook pour détecter si un élément est visible
 */
export function useInView(ref: React.RefObject<HTMLElement>) {
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsInView(entry.isIntersecting),
            { threshold: 0.1 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [ref]);

    return isInView;
}

/**
 * Hook pour idle callback
 */
export function useIdleCallback(callback: () => void, deps: React.DependencyList) {
    useEffect(() => {
        const id = requestIdleCallback(callback);
        return () => cancelIdleCallback(id);
    }, deps);
}
