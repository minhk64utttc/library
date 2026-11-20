import { Global, Module } from '@nestjs/common';

import { ENV, validateEnv } from './env';

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => validateEnv(),
    },
  ],
  exports: [ENV],
})
export class EnvModule {}
