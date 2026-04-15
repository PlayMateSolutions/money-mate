import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular/standalone';
import 'swiper/css';
import 'swiper/css/pagination';
import { Subscription } from 'rxjs';
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
  private accountsSubscription?: Subscription;

  constructor(
    private accountRepository: AccountRepository,
    private cdr: ChangeDetectorRef,
    private toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.subscribeToAccounts();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeSwiper();
    }, 100);
  }

  ngOnDestroy(): void {
    this.accountsSubscription?.unsubscribe();
    this.swiper?.destroy(true, true);
    this.swiper = null;
  }

  private initializeSwiper(): void {
    if (this.swiperContainer && this.cards.length > 0) {
      this.swiper?.destroy(true, true);

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

  private subscribeToAccounts(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.accountsSubscription = this.accountRepository.accounts$.subscribe({
      next: (accounts) => {
        this.cards = this.buildCards(accounts);
        this.loading = false;
        this.error = null;
        this.cdr.markForCheck();

        setTimeout(() => {
          this.initializeSwiper();
        }, 100);
      },
      error: async (err) => {
        this.error = 'Failed to load accounts';
        this.loading = false;
        this.cdr.markForCheck();
        console.error('Error streaming accounts:', err);
        await this.presentToast('Error loading accounts');
      }
    });

    void this.accountRepository.getAccounts();
  }

  private buildCards(accounts: Account[]): BalanceCard[] {
    if (accounts.length === 0) {
      return [];
    }

    if (accounts.length === 1) {
      const [account] = accounts;
      return [{
        id: account.id,
        name: account.name,
        balance: account.balance,
        type: account.type,
        color: account.color,
        icon: account.icon
      }];
    }

    const totalBalance = accounts.reduce((sum: number, account: Account) => sum + account.balance, 0);

    const totalCard: BalanceCard = {
      id: 'total',
      name: 'Total Balance',
      balance: totalBalance,
      type: null,
      color: null,
      isTotal: true
    };

    const accountCards: BalanceCard[] = accounts.map((account: Account) => ({
      id: account.id,
      name: account.name,
      balance: account.balance,
      type: account.type,
      color: account.color,
      icon: account.icon
    }));

    return [totalCard, ...accountCards];
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
