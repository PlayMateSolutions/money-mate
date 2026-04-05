import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Platform } from '@ionic/angular';

export interface SmsMessage {
  id: string;
  sender: string;
  body: string;
  timestamp: Date;
}

export interface SmsPermissionStatus {
  granted: boolean;
  canRequest: boolean;
}

declare var SMS: any;

@Injectable({
  providedIn: 'root'
})
export class SmsService {
  private messagesSubject = new BehaviorSubject<SmsMessage[]>([]);
  private permissionSubject = new BehaviorSubject<SmsPermissionStatus>({
    granted: false,
    canRequest: true
  });

  public messages$ = this.messagesSubject.asObservable();
  public permission$ = this.permissionSubject.asObservable();

  constructor(private platform: Platform) {
    this.platform.ready().then(() => {
      this.checkPermissionStatus();
      this.initializeSmsListener();
    });
  }

  /**
   * Check current SMS permission status
   */
  async checkPermissionStatus(): Promise<SmsPermissionStatus> {
    if (!this.platform.is('android') || !this.isSmsPluginAvailable()) {
      const status = { granted: false, canRequest: false };
      this.permissionSubject.next(status);
      return status;
    }

    try {
      return new Promise((resolve) => {
        SMS.hasPermission((granted: boolean) => {
          const status = { granted, canRequest: true };
          this.permissionSubject.next(status);
          resolve(status);
        }, (error: any) => {
          console.error('Error checking SMS permission:', error);
          const status = { granted: false, canRequest: true };
          this.permissionSubject.next(status);
          resolve(status);
        });
      });
    } catch (error) {
      console.error('SMS permission check failed:', error);
      const status = { granted: false, canRequest: false };
      this.permissionSubject.next(status);
      return status;
    }
  }

  /**
   * Request SMS permissions from user
   */
  async requestSmsPermission(): Promise<boolean> {
    if (!this.platform.is('android') || !this.isSmsPluginAvailable()) {
      return false;
    }

    try {
      return new Promise((resolve) => {
        SMS.requestPermission((granted: boolean) => {
          const status = { granted, canRequest: true };
          this.permissionSubject.next(status);
          if (granted) {
            this.loadRecentMessages();
          }
          resolve(granted);
        }, (error: any) => {
          console.error('Error requesting SMS permission:', error);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('SMS permission request failed:', error);
      return false;
    }
  }

  /**
   * Load recent SMS messages
   */
  async loadRecentMessages(): Promise<void> {
    const permission = await this.checkPermissionStatus();
    if (!permission.granted || !this.isSmsPluginAvailable()) {
      return;
    }

    try {
      SMS.listSMS(
        {
          box: 'inbox', // inbox, sent, draft
          maxCount: 50,
          indexFrom: 0
        },
        (messages: any[]) => {
          const smsMessages: SmsMessage[] = messages.map((msg, index) => ({
            id: msg._id || `msg_${index}_${Date.now()}`,
            sender: msg.address || 'Unknown',
            body: msg.body || '',
            timestamp: new Date(msg.date_sent ? parseInt(msg.date_sent) : Date.now())
          }));

          this.messagesSubject.next(smsMessages);
        },
        (error: any) => {
          console.error('Error loading SMS messages:', error);
        }
      );
    } catch (error) {
      console.error('Failed to load SMS messages:', error);
    }
  }

  /**
   * Initialize SMS listener for new incoming messages
   */
  private initializeSmsListener(): void {
    if (!this.platform.is('android') || !this.isSmsPluginAvailable()) {
      return;
    }

    try {
      // Listen for incoming SMS
      document.addEventListener('onSMSArrive', (event: any) => {
        const smsData = event.data;
        const newMessage: SmsMessage = {
          id: `incoming_${Date.now()}`,
          sender: smsData.address || 'Unknown',
          body: smsData.body || '',
          timestamp: new Date()
        };

        // Add new message to the beginning of the list
        const currentMessages = this.messagesSubject.value;
        this.messagesSubject.next([newMessage, ...currentMessages]);
      });
    } catch (error) {
      console.error('Failed to initialize SMS listener:', error);
    }
  }

  /**
   * Check if SMS plugin is available
   */
  private isSmsPluginAvailable(): boolean {
    return typeof SMS !== 'undefined';
  }

  /**
   * Get current messages
   */
  getCurrentMessages(): SmsMessage[] {
    return this.messagesSubject.value;
  }

  /**
   * Get current permission status
   */
  getCurrentPermissionStatus(): SmsPermissionStatus {
    return this.permissionSubject.value;
  }

  /**
   * Clear all messages (for demo purposes)
   */
  clearMessages(): void {
    this.messagesSubject.next([]);
  }
}