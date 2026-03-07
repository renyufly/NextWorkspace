import { Global, Module } from '@nestjs/common';

import { LocalStoreService } from './local-store.service.js';

@Global()
@Module({
  providers: [LocalStoreService],
  exports: [LocalStoreService],
})
export class LocalStoreModule {}