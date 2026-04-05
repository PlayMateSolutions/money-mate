import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonMenuButton,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonRefresher,
  IonRefresherContent,
  IonText
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SmsService, SmsMessage, SmsPermissionStatus } from '../core/services/sms.service';
import { addIcons } from 'ionicons';
import { 
  mailOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline, 
  refreshOutline, 
  lockClosedOutline,
  trashOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-sms-demo',
  templateUrl: 'sms-demo.page.html',
  styleUrls: ['sms-demo.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonMenuButton,
    IonButton,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonRefresher,
    IonRefresherContent,
    IonText
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SmsDemoPage implements OnInit, OnDestroy {
  messages: SmsMessage[] = [];
  permissionStatus: SmsPermissionStatus = { granted: false, canRequest: true };
  isLoading = false;
  private destroy$ = new Subject<void>();

  constructor(private smsService: SmsService) {
    addIcons({
      mailOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      refreshOutline,
      lockClosedOutline,
      trashOutline
    });
  }

  ngOnInit() {
    // Subscribe to messages
    this.smsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages;
      });

    // Subscribe to permission status
    this.smsService.permission$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.permissionStatus = status;
        if (status.granted) {
          this.loadMessages();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async requestPermission() {
    this.isLoading = true;
    try {
      await this.smsService.requestSmsPermission();
    } catch (error) {
      console.error('Permission request failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadMessages() {
    this.isLoading = true;
    try {
      await this.smsService.loadRecentMessages();
    } catch (error) {
      console.error('Loading messages failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async handleRefresh(event: any) {
    await this.loadMessages();
    event.target.complete();
  }

  clearMessages() {
    this.smsService.clearMessages();
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (minutes < 1440) {
      return `${Math.floor(minutes / 60)}h ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }

  getMessagePreview(body: string): string {
    return body.length > 100 ? body.substring(0, 100) + '...' : body;
  }

  isFinancialMessage(body: string): boolean {
    const financialKeywords = [
      'debited', 'credited', 'payment', 'transaction', 'balance',
      'withdraw', 'deposit', 'bank', 'card', 'ATM', 'UPI', 'NEFT',
      'IMPS', 'RTGS', 'amount', 'INR', 'Rs.', '₹'
    ];
    
    return financialKeywords.some(keyword => 
      body.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  trackByMessageId(index: number, message: SmsMessage): string {
    return message.id;
  }
}