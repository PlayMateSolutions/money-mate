import { addIcons } from 'ionicons';
import * as ionicons from 'ionicons/icons';
import { Account, Category, Transaction } from '../database/models';

export interface TransactionDisplayItem {
  id: string;
  transaction: Transaction;
  accountName: string;
  transferToAccountName?: string;
  categoryName: string;
  iconName: string;
  iconColor: string;
  date: Date;
}

export function registerCategoryIcons(
  categories: Category[],
  registeredIconNames: Set<string>,
): void {
  const iconsToRegister: Record<string, string> = {};

  categories.forEach((category) => {
    const iconName = category.icon?.trim();
    if (!iconName || registeredIconNames.has(iconName)) {
      return;
    }

    const exportName = iconName.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    const iconData = (ionicons as Record<string, string>)[exportName];
    if (!iconData) {
      return;
    }

    iconsToRegister[iconName] = iconData;
    registeredIconNames.add(iconName);
  });

  if (Object.keys(iconsToRegister).length > 0) {
    addIcons(iconsToRegister);
  }
}

export function buildTransactionDisplayItem(
  transaction: Transaction,
  accountsMap: Map<string, Account>,
  categoriesMap: Map<string, Category>,
  registeredIconNames: Set<string>,
): TransactionDisplayItem {
  const sourceAccount = accountsMap.get(transaction.accountId);
  const transferToAccount = transaction.transferToAccountId
    ? accountsMap.get(transaction.transferToAccountId)
    : undefined;
  const category = transaction.categoryId ? categoriesMap.get(transaction.categoryId) : undefined;
  const categoryIconName = category?.icon?.trim();
  const rawIconName = transaction.type === 'transfer'
    ? 'swap-horizontal-outline'
    : (categoryIconName || 'pricetag-outline');

  return {
    id: transaction.id,
    transaction,
    accountName: sourceAccount?.name ?? 'Unknown account',
    transferToAccountName: transferToAccount?.name,
    categoryName: transaction.type === 'transfer'
      ? 'Transfer'
      : (category?.name ?? 'Uncategorized'),
    iconName: registeredIconNames.has(rawIconName) ? rawIconName : 'pricetag-outline',
    iconColor: transaction.type === 'transfer'
      ? 'var(--ion-color-medium)'
      : (category?.color || 'var(--ion-color-medium)'),
    date: new Date(transaction.date),
  };
}
