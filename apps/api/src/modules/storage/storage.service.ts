import { StorageAdapter } from './storage.interface.js';
import { LocalStorageAdapter } from './local.storage.js';

class StorageService {
  private adapter: StorageAdapter;

  constructor() {
    // Production can configure S3 or Object Storage adapter here
    this.adapter = new LocalStorageAdapter();
  }

  getAdapter(): StorageAdapter {
    return this.adapter;
  }
}

export const storageService = new StorageService();
