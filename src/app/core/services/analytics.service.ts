import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

export type AnalyticsParamValue = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsParamValue>;

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly measurementId = environment.gaMeasurementId;
  private readonly analyticsEnabled = environment.analyticsEnabled && !!environment.gaMeasurementId;
  private scriptLoadingPromise?: Promise<void>;
  private initialized = false;
  private lastTrackedPagePath: string | null = null;

  async initialize(): Promise<void> {
    if (!this.analyticsEnabled || this.initialized) {
      return;
    }

    await this.loadGtagScript();

    window.gtag?.('js', new Date());
    window.gtag?.('config', this.measurementId, {
      send_page_view: false,
      anonymize_ip: true,
    });

    this.initialized = true;
    await this.setDefaultUserProperties();
  }

  trackPageView(pageTitle: string, pagePath: string): void {
    if (!this.isGtagAvailable() || this.lastTrackedPagePath === pagePath) {
      return;
    }

    this.lastTrackedPagePath = pagePath;
    window.gtag?.('event', 'page_view', {
      page_title: pageTitle,
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
    });
  }

  trackEvent(eventName: string, params?: AnalyticsParams): void {
    if (!this.isGtagAvailable()) {
      console.warn(`Analytics event not tracked: ${eventName}. Gtag not available.`);
      return;
    }

    window.gtag?.('event', eventName, this.sanitizeParams(params));
  }

  setUserProperties(properties: AnalyticsParams): void {
    if (!this.isGtagAvailable()) {
      return;
    }

    const sanitized = this.sanitizeParams(properties);
    if (Object.keys(sanitized).length === 0) {
      return;
    }

    window.gtag?.('set', 'user_properties', sanitized);
  }

  private async setDefaultUserProperties(): Promise<void> {
    const defaultProperties: AnalyticsParams = {
      platform_type: Capacitor.getPlatform(),
    };

    try {
      const appInfo = await App.getInfo();
      defaultProperties['app_version'] = appInfo.version;
      defaultProperties['app_build'] = appInfo.build;
    } catch {
      defaultProperties['app_version'] = 'unknown';
    }

    this.setUserProperties(defaultProperties);
  }

  private isGtagAvailable(): boolean {
    return this.analyticsEnabled && typeof window !== 'undefined' && typeof window.gtag === 'function';
  }

  private sanitizeParams(params?: AnalyticsParams): Record<string, string | number | boolean> {
    if (!params) {
      return {};
    }

    return Object.entries(params).reduce<Record<string, string | number | boolean>>((acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }

      acc[key] = typeof value === 'string' ? value.slice(0, 100) : value;
      return acc;
    }, {});
  }

  private loadGtagScript(): Promise<void> {
    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise<void>((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Document is not available.'));
        return;
      }

      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag(..._args: unknown[]): void {
        window.dataLayer?.push(arguments);
      };

      const existingScript = document.querySelector<HTMLScriptElement>(`script[src*="googletagmanager.com/gtag/js?id=${this.measurementId}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Analytics script.'));
      document.head.appendChild(script);
    }).catch((error) => {
      console.error('Failed to initialize analytics:', error);
      throw error;
    });

    return this.scriptLoadingPromise;
  }
}
