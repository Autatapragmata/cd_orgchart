export interface ChartMeta {
  id: string;
  name: string;
  allowedEmails?: string[];
}

export interface Person {
  id: string;
  name: string;
  title: string;
  type?: 'person' | 'division';
  notes?: string;
  skills?: string[];
  projects?: string[];
  children: Person[];
  x?: number;
  y?: number;
  color?: string;
  team?: string;
}