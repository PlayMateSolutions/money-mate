export interface BaseEntity {
  id: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends BaseEntity {
  createdBy: string;
  updatedBy?: string;
}