import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionFormPage } from './transaction-form.page';

describe('TransactionFormPage', () => {
  let component: TransactionFormPage;
  let fixture: ComponentFixture<TransactionFormPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionFormPage]
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
