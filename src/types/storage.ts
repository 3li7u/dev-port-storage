export interface StorageItem {
  key: string;
  value: any;
  type: "localStorage" | "cookie";
  domain: string;
  port: string;
}

export interface ProjectContext {
  port: string;
  name: string;
  storage: StorageItem[];
  lastAccessed: number;
}

export interface StorageContext {
  [key: string]: ProjectContext;
}
