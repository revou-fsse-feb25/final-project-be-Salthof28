import { Inject, Injectable } from '@nestjs/common';
import { RatingService, TransactionBuy, TransactionBuyCare, TransactionCare, TransactionsServiceItf, UpdateBuy, UpdateCare, UpdateCountTransaction, UpdateTransaction } from './transactions.service.interface';
import { OutAccessBuy, OutAccessCare, OutFarmIdTransaction, TransactionsRepositoryItf } from './transactions.repository.interface';
import { CareTransaction, DetailBuyTransaction, Farms, Livestock, Prisma, Shelter, Transaction } from '@prisma/client';
import { Condition } from '../global/entities/condition-entity';
import { TransactionNotFoundException } from './exception/transaction-not-found-exception';
import { OutAccomodate, OutCareShelter, SheltersRepositoryItf } from '../shelters/shelters.repository.interface';
import { CareNotFoundException } from 'src/shelters/exception/care-not-found-exception';
import { CreateCareTransactionDto } from './dto/req/care-transaction.dto';
import { CreateDetailBuyDto } from './dto/req/detail-buy.dto';
import { LivestocksRepositoryItf } from 'src/livestocks/livestocks.repository.interface';
import { LivestockNotFoundException } from 'src/livestocks/exception/livestock-not-found-exception';
import { TransactionErrorException } from './exception/transaction-error-exception';
import { Decimal } from '@prisma/client/runtime/library';
import { ShelterNotFoundException } from 'src/shelters/exception/shelter-not-found-exception';
import { FarmNotFoundException } from 'src/farms/exception/farm-not-found-exception';
import { FarmsRepositoryItf } from 'src/farms/farms.repository.interface';

@Injectable()
export class TransactionsService implements TransactionsServiceItf {
  constructor(@Inject('TransactionsRepositoryItf') private readonly transactionsRepository: TransactionsRepositoryItf, @Inject('SheltersRepositoryItf') private readonly sheltersRepository: SheltersRepositoryItf, @Inject('LivestocksRepositoryItf') private readonly livestocksRepository: LivestocksRepositoryItf, @Inject('FarmsRepositoryItf') private readonly farmsRepository: FarmsRepositoryItf){}

  async getAllTransaction(query?: Condition): Promise<Transaction[]> {
    const allTransaction: Transaction[] | undefined = await this.transactionsRepository.getAll(query);
    if(!allTransaction) throw new TransactionNotFoundException();
    return allTransaction
  };

  async getAllTransactionBreeder(user_id: number): Promise<Transaction[]> {
    const farm: Farms | undefined = await this.farmsRepository.getFarmByUserId(user_id);
    if(!farm) throw new FarmNotFoundException('Your farm not registered');
    const allTransaction: Transaction[] | undefined = await this.transactionsRepository.getAll({farm_id: farm.id});
    return allTransaction;
  };

  async getTransaction(id: number): Promise<Transaction> {
    const transaction: Transaction | undefined = await this.transactionsRepository.getOne(id);
    if(!transaction) throw new TransactionNotFoundException();
    return transaction;
  };

  async getAllCareByShelter(shelter_id: number): Promise<CareTransaction[]> {
    const allTransaction: CareTransaction[] = await this.transactionsRepository.getAllCareByShelter(shelter_id);
    return allTransaction;
  }

  async transactionCare(transCare: TransactionCare): Promise<Transaction> {
    await this.checkShelterAvaibility(transCare.care);
    transCare.care = await this.countCare(transCare.care);
    const total_amount = transCare.care.reduce((sum, care) => {
      if(!care.sub_total) throw new TransactionErrorException();
      return sum.add(care.sub_total);
    }, new Prisma.Decimal(0));
    transCare.transaction.total_amount = total_amount;
    const createTransaction = await this.transactionsRepository.createdCareTransaction(transCare);
    return createTransaction;    
  };

  async countCare(care: CreateCareTransactionDto[]): Promise<CreateCareTransactionDto[]> {
    // collect all id care "new set" delete value duplicate
    const allIdCareGive = [...new Set(care.flatMap(tc => tc.careGive_id))];
    const allIdShelter = care.flatMap(cr => cr.shelter_id);
    // get all care by id
    const getAllCare: OutCareShelter[] = await this.sheltersRepository.getAllCare(allIdCareGive);
    const getAllShelter: Shelter[] = await this.sheltersRepository.getAllShelterTransaction(allIdShelter)
    // if(!getAllCare) throw new CareNotFoundException('Care want buy not found');
    // for map id -> price (lookup table not array) return { 1 => 1000, 2 => 2000, 3 => 3000 }
    // alternatif can convert array object to one object (use reduce)
    const priceCareMap = new Map(getAllCare.map(cg => [cg.id, { price: cg.price, unit: cg.unit }]));
    const priceShelter = getAllShelter.reduce((map, cg) => {
      if (!map.has(cg.id)) {
        map.set(cg.id, cg.price_daily);
      }
      return map;
    }, new Map<number, Prisma.Decimal>());
  
    // update transaction care 
    care = care.map(tc => {
      const carePrice = tc.careGive_id.reduce((sum, id) => {
        const careData = priceCareMap.get(id);
        if(!careData) throw new CareNotFoundException('careData not found')
        const { price, unit } = careData;
        if(!price) throw new CareNotFoundException();
        const finalPrice = unit === 'DAY' ? price : price.div(7);
        return sum.add(finalPrice);
      }, new Prisma.Decimal(0));
      const shelterPrice = priceShelter.get(tc.shelter_id);
      if(!shelterPrice) throw new ShelterNotFoundException('shelter price not found, maybe shelter not register in database');
      const oneDay = carePrice.add(shelterPrice).mul(tc.total_livestock);
      const startDate = new Date(tc.start_date);
      const finishDate = new Date(tc.finish_date);
      const durationCare = Math.ceil((finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      tc.duration_care = durationCare;
      return {
        ...tc,
        one_day_price: oneDay,
        sub_total: oneDay.mul(tc.duration_care)
      }
    });
    return care;    
  };

  async transactionBuy(transBuy: TransactionBuy): Promise<Transaction> {
    transBuy.buy = await this.countBuy(transBuy.buy);
    const total_amount = transBuy.buy.reduce((sum, buy) => {
      if(!buy.sub_total) throw new TransactionErrorException();
      return sum.add(buy.sub_total)
    }, new Prisma.Decimal(0));
    transBuy.transaction.total_amount = total_amount;
    const createBuyTransaction: Transaction = await this.transactionsRepository.createdBuyTransaction(transBuy);
    return createBuyTransaction;
  }

  async countBuy(buy: CreateDetailBuyDto[]): Promise<CreateDetailBuyDto[]> {
    const allIdLivestock = buy.flatMap(tb => tb.livestock_id);
    const getAllLivestock: Livestock[] | undefined = await this.livestocksRepository.getAllLiveTransaction(allIdLivestock);
    if(!getAllLivestock) throw new LivestockNotFoundException('Livestock want buy not found');
    const priceLivestock = new Map(getAllLivestock.map(pl => [pl.id, pl.price]));

    buy = buy.map(tb => {
      const oneUnit = priceLivestock.get(tb.livestock_id);
      if(!oneUnit) throw new LivestockNotFoundException();
      return {
        ...tb,
        unit_price: oneUnit,
        sub_total: oneUnit.mul(tb.total_livestock)
      }
    });
    return buy
  }

  async transactionBuyCare(transBuyCare: TransactionBuyCare): Promise<Transaction> {
    await this.checkShelterAvaibility(transBuyCare.care);
    transBuyCare.buy = await this.countBuy(transBuyCare.buy);
    transBuyCare.care = await this.countCare(transBuyCare.care);
    const amountBuy = transBuyCare.buy.reduce((sum, buy) => {
      if(!buy.sub_total) throw new TransactionErrorException();
      return sum.add(buy.sub_total)
    }, new Prisma.Decimal(0));
    const total_amount = transBuyCare.care.reduce((sum, care) => {
      if(!care.sub_total) throw new TransactionErrorException();
      return sum.add(care.sub_total);
    }, new Prisma.Decimal(amountBuy));
    transBuyCare.transaction.total_amount = total_amount;
    const createTransaction: Transaction = await this.transactionsRepository.createdBuyCareTransaction(transBuyCare);
    return createTransaction;
  };

  async updateStatus(updated: UpdateTransaction): Promise<Transaction> {
    // ambil transactio id farm
    const getTransaction: OutFarmIdTransaction | undefined = await this.transactionsRepository.getOne(updated.id);
    if(!getTransaction) throw new TransactionNotFoundException();
    if(getTransaction.farm.user_id !== updated.user_id) throw new TransactionErrorException('not have access to updated this transaction')
    const update: Transaction = await this.transactionsRepository.updatedTransaction({
      id: updated.id,
      body: updated.transaction
    });
    return update;
  }

  async updatedBuy(updated: UpdateBuy): Promise<Transaction> {
    // check access
    const accessBuy: OutAccessBuy | undefined = await this.transactionsRepository.getOneBuy(updated.id);
    if(!accessBuy) throw new TransactionNotFoundException();
    if(accessBuy.transaction.status_transaction !== 'WAITING') throw new TransactionErrorException("you don't change your order because status not WAITING")
    if(accessBuy.transaction.customer_id !== updated.user_id) throw new TransactionErrorException('not have acces this transaction');
    // count subtotal
    if(updated.buy.total_livestock) updated.buy.sub_total = new Decimal(accessBuy.unit_price).mul(updated.buy.total_livestock);
    // update buy detail transaction
    const buyUpdate: DetailBuyTransaction = await this.transactionsRepository.updatedDetailBuy({
      id: updated.id,
      body: updated.buy
    });
    // get all buy by transaction_id
    const transaction: OutFarmIdTransaction | undefined = await this.transactionsRepository.getOne(buyUpdate.transaction_id);
    if(!transaction) throw new TransactionNotFoundException();
    // count total amoutn
    const total_amount = await this.countUpdateTransaction({
      buy: transaction.detail_buy,
      care: transaction.care_transaction
    });
    const transactionUpdate: Transaction = await this.transactionsRepository.updatedTransaction({
      id: accessBuy.transaction_id,
      body: {
        total_amount
      }
    });
    return transactionUpdate;
  }

  async resheduleCare(updated: UpdateCare): Promise<Transaction> {
    const accesCare: OutAccessCare | undefined = await this.transactionsRepository.getOneCare(updated.id);
    if(!accesCare) throw new TransactionNotFoundException();
    if(accesCare.transaction.status_transaction !== 'WAITING')throw new TransactionErrorException("you don't change your order because status not WAITING")
    if(accesCare.transaction.customer_id !== updated.user_id) throw new TransactionErrorException('not have acces this transaction');

    // count duration
    if(updated.care.start_date && updated.care.finish_date) {
      const startDate = new Date(updated.care.start_date);
      const finishDate = new Date(updated.care.finish_date);
      const allBookings = await this.transactionsRepository.getAllCare(undefined, {
        shelter_id: accesCare.shelter_id,
        start: startDate,
        finish: finishDate,
        
      }, "CARE");
      if(allBookings){
        const usedAccomodate = allBookings.reduce((sum, b) => sum + b.total_livestock,0);
        // count remaining
        const remaining = accesCare.shelter.accomodate - usedAccomodate;
        if(accesCare.total_livestock > remaining) throw new TransactionErrorException('Shelter full capacity');
      }
      updated.care.duration_care = Math.ceil((finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    };
    // count sub_total
    if(updated.care.duration_care) updated.care.sub_total = accesCare.one_day_price.mul(updated.care.duration_care);
    const updateCare: CareTransaction = await this.transactionsRepository.updatedCareTransaction({
      id: updated.id,
      body: {
        start_date: updated.care.start_date,
        finish_date: updated.care.finish_date,
        duration_care: updated.care.duration_care,
        sub_total: updated.care.sub_total
      }
    });
    const transaction: OutFarmIdTransaction | undefined = await this.transactionsRepository.getOne(updateCare.transaction_id);
    if(!transaction) throw new TransactionNotFoundException();
    // count total amoutn
    const total_amount: Decimal = await this.countUpdateTransaction({
      buy: transaction.detail_buy,
      care: transaction.care_transaction
    });
    const transactionUpdate: Transaction = await this.transactionsRepository.updatedTransaction({
      id: accesCare.transaction_id,
      body: {
        total_amount
      }
    });
    return transactionUpdate;
  }

  async countUpdateTransaction(count: UpdateCountTransaction): Promise<Decimal> {
    const allBuy: DetailBuyTransaction[] = count.buy;
    const allCare: CareTransaction[] = count.care;
    let total_buy: Decimal = Prisma.Decimal(0);
    let total_care: Decimal = Prisma.Decimal(0);
    if(allBuy.length > 0) {
      // count total_amout transaction
      total_buy = allBuy.reduce((sum, buy) => {
        if(!buy.sub_total) throw new TransactionErrorException();
        return sum.add(buy.sub_total)
      }, new Prisma.Decimal(0));
    };
    // count care
    if(allCare.length > 0) {
      total_care = allCare.reduce((sum, care) => {
        if(!care.sub_total) throw new TransactionErrorException();
        return sum.add(care.sub_total)
      }, new Prisma.Decimal(0));
    };
    return total_buy.add(total_care);
  }

  async checkShelterAvaibility(careList: CreateCareTransactionDto[]): Promise<void> {
    if(!careList.length) return;
    // collect id
    const shelterIds = [...new Set(careList.map(c => c.shelter_id))];
    // get data capacity shelter
    const shelters: OutAccomodate[] | undefined = await this.sheltersRepository.getAllAccomodateShelter(shelterIds);
    if(shelters.length !== shelterIds.length) throw new ShelterNotFoundException();
    // map: shelter_id -> cap 
    const shelterCap = new Map(
      shelters.map(s => [s.id, s.accomodate ])
    );
    // Record<number, number>  -> shelter_id -> total requested
    const requestedPerShelter = careList.reduce((acc, tc) => {
      acc.set(tc.shelter_id, (acc.get(tc.shelter_id) ?? 0) + tc.total_livestock);
      return acc;
    }, new Map<number, number>());
    // --- build OR conditions for all date windows & shelters ---
    // important: each condition carries its own shelter_id
    const orConditions = careList.map(tc => ({
      shelter_id: tc.shelter_id,
      start_date: { lte: new Date(tc.finish_date) },
      finish_date: { gte: new Date(tc.start_date) },
    }));
    // get all transaction existing overlap (onetime)
    const overlapping = await this.transactionsRepository.getAllbooking(orConditions);
    // --- total booking existing per shelter 
    const bookedPerShelter = overlapping.reduce((acc, row) => {
      acc.set(row.shelter_id, (acc.get(row.shelter_id) ?? 0) + row.total_livestock);
      return acc;
    }, new Map<number, number>());

    for (const id of shelterIds) {
      const capInfo = shelterCap.get(id)!; 
      const used = bookedPerShelter.get(id) ?? 0;
      const req  = requestedPerShelter.get(id) ?? 0;
      if (used + req > capInfo) throw new TransactionErrorException(`Shelter full: capacity ${capInfo}, already filled ${used}, new request ${req}`);
    }
  }

  async reviewTransaction(review: RatingService): Promise<Transaction> {
    // check access
    const getTransaction: OutFarmIdTransaction | undefined = await this.transactionsRepository.getOne(review.id_transaction);
    if(!getTransaction) throw new TransactionNotFoundException();
    if(getTransaction.customer_id !== review.user_id) throw new TransactionErrorException('not have access to updated this transaction');
    // process
    const reviewed = await this.transactionsRepository.reviewTransaction({
      id_transaction: review.id_transaction,
      farm_id: getTransaction.farm_id,
      rating: review.rating,
      review: review.review
    });
    return reviewed;
  }

  async dropTransaction(id: number): Promise<Transaction> {
    const deleted = await this.transactionsRepository.dropTransaction(id);
    return deleted;
  }

}
