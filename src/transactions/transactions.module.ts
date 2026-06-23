import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { SheltersModule } from '../shelters/shelters.module';
import { LivestocksModule } from '../livestocks/livestocks.module';
import { FarmsModule } from '../farms/farms.module';

@Module({
  imports: [SheltersModule, LivestocksModule, FarmsModule],
  controllers: [TransactionsController],
  providers: [
    { provide: 'TransactionsServiceItf', useClass: TransactionsService },
    { provide: 'TransactionsRepositoryItf', useClass: TransactionsRepository }
  ],
})
export class TransactionsModule {}
