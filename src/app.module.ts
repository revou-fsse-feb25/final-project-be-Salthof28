import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UploadsModule } from './uploads/uploads.module';
import { CategoryModule } from './category/category.module';
import { FarmsModule } from './farms/farms.module';
import { SheltersModule } from './shelters/shelters.module';
import { LivestocksModule } from './livestocks/livestocks.module';
import { TransactionsModule } from './transactions/transactions.module';
// import { RedisModule } from 'redis/redis.module';
// import { CacheModule } from '@nestjs/cache-manager';
// import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    UsersModule, 
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    // CacheModule.register({
    //   store: redisStore,
    //   // socket: {
    //   //   host: 'localhost',
    //   //   port: 6380,
    //   // },
    //   host: 'localhost',
    //   port: 6380,
    //   isGlobal: true,
    //   db: 0
    // }),
    UploadsModule,
    CategoryModule,
    FarmsModule,
    SheltersModule,
    LivestocksModule,
    TransactionsModule,
    // RedisModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
