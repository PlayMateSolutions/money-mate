# GitHub Copilot Instructions - Money Mate

## PROJECT CONTEXT
Money Mate is a sports/gym club membership management system built with Angular 19+ and Ionic 8+. It's a hybrid mobile application that manages members, attendance, payments, and club operations.

## TECH STACK & ARCHITECTURE

### Frontend Stack
- **Angular 19+** with standalone components (NO NgModules)
- **Ionic 8+** UI framework with native mobile capabilities
- **Capacitor 7+** for native device features
- **TypeScript** in strict mode
- **RxJS** for reactive programming
- **Service-oriented architecture** for business logic
- **JWT authentication** with @auth0/angular-jwt
- **ngx-translate** for internationalization (English, Tamil)

## CODE STYLE & PATTERNS

### Component Guidelines
```typescript
// ✅ ALWAYS use standalone components
@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './member-list.page.html',
  styleUrls: ['./member-list.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberListPage implements OnInit {
  // Component logic here
}
```

### Service Patterns
```typescript
// ✅ Injectable services with proper error handling
@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private apiUrl = environment.apiUrl;
  private membersSubject = new BehaviorSubject<Member[]>([]);
  
  getMembers(): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.apiUrl}/members`).pipe(
      tap(members => this.membersSubject.next(members)),
      catchError(this.handleError)
    );
  }
  
  private handleError(error: any): Observable<never> {
    console.error('Service error:', error);
    return throwError(() => new Error('Operation failed'));
  }
}
```

### Reactive Programming
```typescript
// ✅ Use observables and reactive patterns
ngOnInit() {
  this.members$ = this.memberService.getMembers().pipe(
    map(members => members.filter(m => m.isActive)),
    shareReplay(1)
  );
}
```

## MOBILE-FIRST RESPONSIVE DESIGN

### Always implement responsive layouts:
```scss
// ✅ Mobile-first approach with breakpoints
.member-card {
  width: 100%;
  padding: var(--app-padding-medium);
  margin-bottom: var(--app-padding-small);
  
  @media (min-width: 768px) {
    width: calc(50% - var(--app-padding-small));
    display: inline-block;
  }
  
  @media (min-width: 1200px) {
    width: calc(33.333% - var(--app-padding-small));
  }
}
```

### Ionic Grid System:
```html
<!-- ✅ Use Ionic's responsive grid -->
<ion-grid>
  <ion-row>
    <ion-col size="12" size-md="6" size-lg="4">
      <app-member-card></app-member-card>
    </ion-col>
  </ion-row>
</ion-grid>
```

## THEME SUPPORT (DARK/LIGHT)

### Always use CSS variables for theming:
```scss
// ✅ Theme-aware styling
.member-card {
  background: var(--ion-color-light);
  color: var(--ion-text-color);
  border: 1px solid var(--ion-color-medium);
  box-shadow: var(--app-card-shadow);
  
  &:hover {
    background: var(--ion-color-light-tint);
  }
}

// ✅ Custom theme variables in variables.scss
:root {
  --app-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --app-padding-small: 8px;
  --app-padding-medium: 16px;
  --app-padding-large: 24px;
}

[data-theme="dark"] {
  --app-card-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
}
```

### Theme Service Pattern:
```typescript
// ✅ Theme switching service
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme = new BehaviorSubject<'light' | 'dark'>('light');
  
  toggleTheme(): void {
    const newTheme = this.currentTheme.value === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    this.currentTheme.next(newTheme);
    localStorage.setItem('theme', newTheme);
  }
}
```

## IONIC COMPONENT PATTERNS

### Proper Ionic Usage:
```html
<!-- ✅ Use Ionic components with proper structure -->
<ion-header [translucent]="true">
  <ion-toolbar>
    <ion-title>Members</ion-title>
    <ion-buttons slot="end">
      <ion-button (click)="addMember()">
        <ion-icon name="add"></ion-icon>
      </ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content [fullscreen]="true">
  <ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
    <ion-refresher-content></ion-refresher-content>
  </ion-refresher>
  
  <ion-list>
    <ion-item *ngFor="let member of members; trackBy: trackByMemberId">
      <ion-avatar slot="start">
        <img [src]="member.avatar || 'assets/default-avatar.png'" />
      </ion-avatar>
      <ion-label>
        <h2>{{ member.name }}</h2>
        <p>{{ member.membershipType }}</p>
      </ion-label>
      <ion-chip color="success" *ngIf="member.isActive">
        Active
      </ion-chip>
    </ion-item>
  </ion-list>
</ion-content>
```

## ERROR HANDLING & LOADING STATES

### Consistent error handling:
```typescript
// ✅ Handle loading and error states
export class MemberListPage {
  loading$ = new BehaviorSubject<boolean>(false);
  error$ = new BehaviorSubject<string | null>(null);
  
  async loadMembers(): Promise<void> {
    try {
      this.loading$.next(true);
      this.error$.next(null);
      const members = await this.memberService.getMembers().toPromise();
      // Handle success
    } catch (error) {
      this.error$.next('Failed to load members');
      await this.presentToast('Error loading members');
    } finally {
      this.loading$.next(false);
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
}
```

## PERFORMANCE PATTERNS

### Optimization techniques:
```typescript
// ✅ Use OnPush change detection
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})

// ✅ TrackBy functions for *ngFor
trackByMemberId(index: number, member: Member): number {
  return member.id;
}

// ✅ Async pipe for observables
// Template: <div *ngFor="let member of members$ | async; trackBy: trackByMemberId">
```

## FILE STRUCTURE & NAMING

### Follow Angular conventions:
```
src/app/
├── core/                    # Core services, guards, interceptors
│   ├── services/
│   ├── guards/
│   └── interceptors/
├── features/               # Feature modules
│   ├── members/
│   ├── attendance/
│   └── payments/
├── shared/                # Shared components & utilities
│   ├── components/
│   ├── pipes/
│   └── models/
└── tabs/                  # Tab navigation
```

### Naming conventions:
- **Pages**: `member-list.page.ts`
- **Components**: `member-card.component.ts`
- **Services**: `member.service.ts`
- **Models**: `member.model.ts`
- **Guards**: `auth.guard.ts`

## INTERNATIONALIZATION

```typescript
// ✅ Use translation service
constructor(private translate: TranslateService) {}

// Template usage
<ion-title>{{ 'MEMBERS.TITLE' | translate }}</ion-title>

// Component usage
const message = this.translate.instant('MEMBERS.DELETE_CONFIRM');
```

## NAVIGATION PATTERNS

```typescript
// ✅ Angular Router with Ionic
async navigateToMember(memberId: number): Promise<void> {
  await this.router.navigate(['/tabs/members', memberId]);
}

// ✅ Modal navigation
async openMemberModal(): Promise<void> {
  const modal = await this.modalController.create({
    component: MemberFormComponent,
    componentProps: { mode: 'create' }
  });
  await modal.present();
}
```

## COMMON ANTI-PATTERNS TO AVOID

❌ **Don't use NgModules** - Use standalone components
❌ **Don't use hard-coded colors** - Use CSS variables
❌ **Don't ignore mobile breakpoints** - Always responsive
❌ **Don't forget error handling** - Always handle errors gracefully
❌ **Don't use any type** - Use proper TypeScript types
❌ **Don't forget accessibility** - Use semantic HTML and ARIA

## PROJECT-SPECIFIC MODELS

```typescript
// Core domain models
interface Member {
  id: number;
  name: string;
  email: string;
  phone: string;
  membershipType: string;
  joinDate: Date;
  isActive: boolean;
  avatar?: string;
}

interface Attendance {
  id: number;
  memberId: number;
  checkIn: Date;
  checkOut?: Date;
  date: Date;
}

interface Payment {
  id: number;
  memberId: number;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  description: string;
  status: 'pending' | 'completed' | 'cancelled';
}
```

## REMEMBER
- **Mobile-first**: Always design for mobile, then enhance for larger screens
- **Theme support**: Every component must work in both light and dark themes  
- **Accessibility**: Use semantic HTML, proper ARIA labels, and color contrast
- **Performance**: Use OnPush, trackBy, and lazy loading
- **Type safety**: Use TypeScript interfaces and avoid 'any'
- **Error handling**: Always handle errors gracefully with user feedback
- **Responsive design**: Test on multiple screen sizes (320px to 1920px+)