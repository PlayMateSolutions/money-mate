import { Component, OnInit, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular/standalone';
import 'swiper/css';
import 'swiper/css/pagination';
import { Swiper } from 'swiper';
import { Pagination } from 'swiper/modules';
import { AccountRepository } from '../../../core/database/repositories';
import { Account } from '../../../core/database/models';
import { ToastController } from '@ionic/angular';

interface BalanceCard {
  id: string;
  name: string;
  balance: number;
  type: Account['type'] | null;
  color: string | null;
  icon?: string;
  isTotal?: boolean;
}

@Component({
  selector: 'app-account-balance-carousel',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonIcon],
  templateUrl: './account-balance-carousel.component.html',
  styleUrls: ['./account-balance-carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountBalanceCarouselComponent implements OnInit, AfterViewInit {
  @ViewChild('swiperContainer', { static: false }) swiperContainer!: ElementRef;

  cards: BalanceCard[] = [];
  loading = true;
  error: string | null = null;
  private swiper: Swiper | null = null;

  constructor(
    private accountRepository: AccountRepository,
    private cdr: ChangeDetectorRef,
    private toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.loadAccounts();
  }

  ngAfterViewInit(): void {
    // Initialize Swiper after view is initialized
    setTimeout(() => {
      this.initializeSwiper();
    }, 100);
  }

  private initializeSwiper(): void {
    if (this.swiperContainer && this.cards.length > 0) {
      Swiper.use([Pagination]);
      this.swiper = new Swiper(this.swiperContainer.nativeElement, {
        modules: [Pagination],
        slidesPerView: 1,
        spaceBetween: 20,
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
          dynamicBullets: true
        },
        speed: 400,
        grabCursor: true
      });
    }
  }

  private async loadAccounts(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      this.cdr.markForCheck();

      const accounts = await this.accountRepository.getAccounts();

      if (!accounts || accounts.length === 0) {
        this.cards = [];
        this.loading = false;
        this.cdr.markForCheck();
        // No need to initialize Swiper if no cards
        return;
      }

      // Calculate total balance
      const totalBalance = accounts.reduce((sum: number, account: Account) => sum + account.balance, 0);

      // Create total card with gradient (no specific color, handled in CSS)
      const totalCard: BalanceCard = {
        id: 'total',
        name: 'Total Balance',
        balance: totalBalance,
        type: null,
        color: null,
        isTotal: true
      };

      // Create individual account cards
      const accountCards: BalanceCard[] = accounts.map((account: Account) => ({
        id: account.id,
        name: account.name,
        balance: account.balance,
        type: account.type,
        color: account.color,
        icon: account.icon
      }));

      // Combine: total card first, then individual accounts
      this.cards = [totalCard, ...accountCards];
      this.loading = false;
      this.cdr.markForCheck();

      // Reinitialize Swiper after cards are loaded
      setTimeout(() => {
        this.initializeSwiper();
      }, 100);
    } catch (err) {
      this.error = 'Failed to load accounts';
      this.loading = false;
      this.cdr.markForCheck();
      console.error('Error loading accounts:', err);
      await this.presentToast('Error loading accounts');
    }
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }

  formatBalance(balance: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(balance);
  }

  capitalizeType(type: Account['type'] | null): string {
    if (!type) return '';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  getCardNumber(cardId: string): string {
    // Return last 4 chars of ID as a placeholder card number
    return cardId.slice(-4).padStart(4, '*');
  }

  trackByCardId(index: number, card: BalanceCard): string {
    return card.id;
  }
}
