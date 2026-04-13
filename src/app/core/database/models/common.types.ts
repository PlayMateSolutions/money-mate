export const GUEST_USER_NAME = 'Guest';

export interface BaseEntity {
  id: string;
  isDeleted: boolean;
  isDirty?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends BaseEntity {
  createdBy: string;
  updatedBy?: string;
}