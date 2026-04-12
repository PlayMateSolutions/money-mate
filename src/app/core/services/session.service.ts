import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  GoogleLoginResponseOnline,
  SocialLogin,
} from '@capgo/capacitor-social-login';
import { environment } from '../../../environments/environment';

export type AuthMode = 'google' | 'offline';

export interface UserSession {
  mode: AuthMode;
  email?: string;
  name?: string;
  picture?: string;
  accessToken?: string;
  expiresAt?: number;
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private readonly SESSION_KEY = 'money-mate-user-session';
  private readonly ENTRY_KEY = 'money-mate-auth-entry-completed';
  private readonly sessionSubject = new BehaviorSubject<UserSession | null>(null);
  private initialized = false;

  constructor() {
    this.loadSession();
  }

  get session$(): Observable<UserSession | null> {
    return this.sessionSubject.asObservable();
  }

  get currentSession(): UserSession | null {
    return this.sessionSubject.value;
  }

  get hasCompletedEntry(): boolean {
    return localStorage.getItem(this.ENTRY_KEY) === 'true';
  }

  get isGoogleConnected(): boolean {
    return this.currentSession?.mode === 'google';
  }

  async initializeGoogleAuth(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await SocialLogin.initialize({
      google: {
        webClientId: environment.googleSignInClientId,
      },
    });

    this.initialized = true;
  }

  async signInWithGoogle(): Promise<boolean> {
    try {
      await this.initializeGoogleAuth();

      const response = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: environment.googleScopes,
          forceRefreshToken: true,
        },
      });

      const result = response.result as GoogleLoginResponseOnline | undefined;
      const accessToken = result?.accessToken?.token;

      if (!accessToken) {
        return false;
      }

      const session: UserSession = {
        mode: 'google',
        email: result?.profile?.email ?? undefined,
        name: result?.profile?.name ?? undefined,
        picture: result?.profile?.imageUrl ?? undefined,
        accessToken,
        expiresAt: Date.now() + 60 * 60 * 1000,
      };

      this.setSession(session);
      this.markEntryCompleted();
      return true;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      return false;
    }
  }

  continueOffline(): void {
    this.setSession({ mode: 'offline' });
    this.markEntryCompleted();
  }

  async signOutGoogle(): Promise<void> {
    try {
      await SocialLogin.logout({ provider: 'google' });
    } catch (error) {
      console.error('Google sign-out failed:', error);
    }

    this.setSession({ mode: 'offline' });
    this.markEntryCompleted();
  }

  private markEntryCompleted(): void {
    localStorage.setItem(this.ENTRY_KEY, 'true');
  }

  private loadSession(): void {
    const raw = localStorage.getItem(this.SESSION_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as UserSession;
      this.sessionSubject.next(parsed);
    } catch {
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  private setSession(session: UserSession): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    this.sessionSubject.next(session);
  }
}