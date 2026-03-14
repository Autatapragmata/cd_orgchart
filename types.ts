export interface Person {
  id: string;
  name: string;
  title: string;
  skills: string[];
  projects: string[];
  children: Person[];
  x?: number;
  y?: number;
  color?: string;
  team?: string;
}