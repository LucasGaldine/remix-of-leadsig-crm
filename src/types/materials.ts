// Materials & Supply System Types

export type TemplateType = 'pavers' | 'concrete' | 'sod' | 'decks' | 'fencing';

export interface MaterialItem {
  id: string;
  name: string;
  category: 'base' | 'surface' | 'fasteners' | 'accessories' | 'other';
  unit: string;
  qty: number;
  notes?: string;
  supplierCategory?: string;
}

export interface MaterialList {
  id: string;
  jobId: string;
  jobName: string;
  templateType: TemplateType;
  measurements: Record<string, number | string | boolean>;
  wastageFactor: number;
  items: MaterialItem[];
  createdAt: string;
  updatedAt: string;
}

export type SupplyOrderStatus = 'draft' | 'sent' | 'confirmed' | 'delivered';

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  deliveryOptions?: string;
  notes?: string;
}

export interface SupplyOrder {
  id: string;
  materialListId: string;
  jobId: string;
  jobName: string;
  supplierId: string;
  supplierName: string;
  items: MaterialItem[];
  status: SupplyOrderStatus;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryAddress: string;
  notes?: string;
  createdAt: string;
  sentAt?: string;
  confirmedAt?: string;
  deliveredAt?: string;
}

// Template measurement schemas
export interface PaverMeasurements {
  totalSqFt: number;
  paverType: string;
  paverSize: string;
  baseDepth: number;
  edgingLength: number;
  jointSandType: string;
}

export interface ConcreteMeasurements {
  totalSqFt: number;
  thickness: number;
  useRebar: boolean;
  useMesh: boolean;
  controlJoints: number;
  useFiberAdditive: boolean;
}

export interface SodMeasurements {
  totalSqFt: number;
  topsoilDepth: number;
  useSeed: boolean;
  useFertilizer: boolean;
  edgingOption: string;
}

export interface DeckMeasurements {
  deckLength: number;
  deckWidth: number;
  joistSpacing: number;
  boardType: string;
  footingCount: number;
  hardwareType: string;
}

export interface FenceMeasurements {
  linearFeet: number;
  fenceType: string;
  postSpacing: number;
  gateCount: number;
  hardwareType: string;
}
