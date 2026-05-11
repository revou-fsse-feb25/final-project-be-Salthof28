import { Injectable } from '@nestjs/common';
import { AllBooking, AllCareBooking, CreateBuyCareTransaction, CreateTransactionBuy, CreateTransactionCare, OutAccessBuy, OutAccessCare, OutAllBooking, OutFarmIdTransaction, Rating, TransactionsRepositoryItf, UpdateCareTransaction, UpdateDetailBuy, UpdateTransaction } from './transactions.repository.interface';
import { PrismaService } from 'prisma/prisma.service';
import { Condition } from '../global/entities/condition-entity';
import { handlePrismaError, retry } from '../global/utils/prisma.error.util';
import { CareTransaction, DetailBuyTransaction, StatusTransaction, Transaction } from '@prisma/client';

@Injectable()
export class TransactionsRepository implements TransactionsRepositoryItf {
    constructor(private readonly prisma: PrismaService){}

    async getAll(query?: Condition): Promise<Transaction[]> {
        try {
            const where: Condition = {}
            if(query?.customer_id || query?.farm_id || query?.transaction_status){
                where.OR = [];
                if(query.customer_id) where.OR.push({ customer_id: query.customer_id });
                if(query.farm_id) where.OR.push({ farm_id: query.farm_id });
                if(query.transaction_status) where.OR.push({ transaction_status: query.transaction_status });
            }
            
            const allTransaction: Transaction[] = await retry(() => this.prisma.transaction.findMany({ 
                where,
                include: {
                    detail_buy: {
                        include: {
                            livestock: {
                                select: {
                                    name: true,
                                    img_livestock: true
                                }
                            }
                        }
                    },
                    care_transaction: {
                        include: { 
                            detail_care: {
                                include: {
                                    careGive: true
                                }
                            },
                            shelter: {
                                select: {
                                    name: true,
                                    img_shelter: true
                                }
                            }
                         }
                    },
                },
                orderBy: {
                    date_transaction: 'desc'
                }
            }));
            return allTransaction;
        } catch (error) {
            handlePrismaError(error);
        }        
    };

    async getAllCareByShelter(shelter_id: number): Promise<CareTransaction[]> {
        try {
            const allTransaction: CareTransaction[] = await retry(() => this.prisma.careTransaction.findMany({
                where: {
                    shelter_id,
                    transaction: {
                        status_transaction: "CARE"
                    }
                },
                include: { 
                    transaction: {
                        select: { date_transaction: true }
                    }
                 }
            }));
            return allTransaction
        } catch (error) {
            handlePrismaError(error);
        }  
    }

    async getAllCare(transaction_id?: number, booking?: AllCareBooking, status?: string): Promise<CareTransaction[]> {
        try {
            const allCare: CareTransaction[] = await retry(() => this.prisma.careTransaction.findMany({
                where: {
                    ...(transaction_id && { transaction_id }),
                    ...(booking && {
                        shelter_id: booking.shelter_id,
                        start_date: {  lte: booking.finish },
                        finish_date: { gte: booking.start },
                    }),
                    ...(status && {
                        transaction: { 
                            is: { status_transaction: status as StatusTransaction },
                        }
                    })
                },
                // include: {
                //     transaction: true
                // }
            }));
            return allCare;
        } catch (error) {
            handlePrismaError(error);
        }
    }

    async getAllbooking(booking: AllBooking[]): Promise<OutAllBooking[]> {
        try {     
            const allCare: OutAllBooking[] = await retry(() => this.prisma.careTransaction.findMany({
                where: { OR: booking },
                select: { shelter_id: true, total_livestock: true },
            }));
            return allCare;
        } catch (error) {
            handlePrismaError(error);
        }   
    }

    async getOne(id: number): Promise<OutFarmIdTransaction | undefined> {
        try {
            const transaction: OutFarmIdTransaction | null = await retry(() => this.prisma.transaction.findUnique({
                where: { id },
                include: {
                    detail_buy: true,
                    care_transaction: true,
                    farm: { select: { user_id: true } }
                }
            }));
            if(transaction === null) return undefined;
            return transaction
        } catch (error) {
            handlePrismaError(error);
        }          
    };

    async getOneBuy(id: number): Promise<OutAccessBuy | undefined> {
        try {
            const buyOne: OutAccessBuy | null = await retry(() => this.prisma.detailBuyTransaction.findUnique({
                where: { id },
                include: {
                    transaction: {
                        select: {
                            customer_id: true,
                            farm: {
                                select: { user_id: true }
                            },
                            status_transaction: true
                        }
                    }                    
                }
            }));
            if(buyOne === null) return undefined;
            return buyOne
        } catch (error) {
            handlePrismaError(error);
        }          
    }

    async getOneCare(id: number): Promise<OutAccessCare | undefined> {
        try {
            const careOne: OutAccessCare | null = await retry(() => this.prisma.careTransaction.findUnique({
                where: { id },
                include: {
                    transaction: {
                        select: { 
                            customer_id: true,
                            farm: {
                                select: { user_id: true }
                            },
                            status_transaction: true 
                        }
                    },
                    shelter: {
                        select: { accomodate: true }
                    }                    
                }
            }));
            if(careOne === null) return undefined;
            return  careOne
        } catch (error) {
            handlePrismaError(error);
        }     
    }

    async createdCareTransaction(careTransaction: CreateTransactionCare): Promise<Transaction> {
        try {
            const newTransaction: Transaction = await this.prisma.transaction.create({
                data: {
                    customer_id: careTransaction.transaction.id_customer,
                    farm_id: careTransaction.transaction.id_farm,
                    date_transaction: new Date(),
                    total_amount: careTransaction.transaction.total_amount,
                    status_transaction: 'WAITING',
                    care_transaction: {
                        create: careTransaction.care.map(transaction => ({
                            livestock_id: transaction.livestock_id,
                            shelter_id: transaction.shelter_id,
                            total_livestock: transaction.total_livestock,
                            address: transaction.address,
                            duration_care: transaction.duration_care,
                            start_date: new Date(transaction.start_date),
                            finish_date: new Date(transaction.finish_date),
                            one_day_price: transaction.one_day_price,
                            sub_total: transaction.sub_total,
                            detail_care: {
                                create: transaction.careGive_id.map(id_care => ({
                                    careGive_id: id_care
                                }))
                            }
                        }))
                    }
                }
            });
            return newTransaction;
        } catch (error) {
            handlePrismaError(error);
        }             
    }

    async createdBuyTransaction(create: CreateTransactionBuy): Promise<Transaction> {
        try {
            const newTransaction: Transaction = await this.prisma.$transaction(async (tx) => {
                const transaction = await tx.transaction.create({
                    data: {
                    customer_id: create.transaction.id_customer,
                    farm_id: create.transaction.id_farm,
                    date_transaction: new Date(),
                    total_amount: create.transaction.total_amount,
                    status_transaction: 'WAITING',
                    detail_buy: {
                        create: create.buy.map((transaction) => ({
                        livestock_id: transaction.livestock_id,
                        address: transaction.address,
                        total_livestock: transaction.total_livestock,
                        unit_price: transaction.unit_price,
                        sub_total: transaction.sub_total,
                        })),
                    },
                    },
                });
                // Update stok each livestock
                for (const item of create.buy) {
                    await tx.livestock.update({
                    where: { id: item.livestock_id },
                    data: {
                        stock: {
                        decrement: item.total_livestock,
                        },
                    },
                    });
                }
                return transaction;
            });
            return newTransaction;
        } catch (error) {
            handlePrismaError(error);
        }          
    }

    async createdBuyCareTransaction(create: CreateBuyCareTransaction): Promise<Transaction> {
        try {
            const newTransaction: Transaction = await this.prisma.$transaction(async (tx) => {
                const transaction = await this.prisma.transaction.create({
                    data: {
                        customer_id: create.transaction.id_customer,
                        farm_id: create.transaction.id_farm,
                        date_transaction: new Date(),
                        total_amount: create.transaction.total_amount,
                        status_transaction: 'WAITING',
                        care_transaction: {
                            create: create.care.map(transaction => ({
                                livestock_id: transaction.livestock_id,
                                shelter_id: transaction.shelter_id,
                                total_livestock: transaction.total_livestock,
                                duration_care: transaction.duration_care,
                                start_date: new Date(transaction.start_date),
                                finish_date: new Date(transaction.finish_date),
                                one_day_price: transaction.one_day_price,
                                sub_total: transaction.sub_total,
                                detail_care: {
                                    create: transaction.careGive_id.map(id_care => ({
                                        careGive_id: id_care
                                    }))
                                }
                            }))
                        },
                        detail_buy: {
                            create: create.buy.map(transaction => ({
                                livestock_id: transaction.livestock_id,
                                total_livestock: transaction.total_livestock,
                                unit_price: transaction.unit_price,
                                sub_total: transaction.sub_total
                            }))
                        }
                    }
                });
                // Update stok each livestock
                for (const item of create.buy) {
                    await tx.livestock.update({
                    where: { id: item.livestock_id },
                    data: {
                        stock: {
                        decrement: item.total_livestock,
                        },
                    },
                    });
                }
                return transaction;
            })
            return newTransaction;
        } catch (error) {
            handlePrismaError(error);
        }    
    }

    async updatedTransaction(upTrans: UpdateTransaction): Promise<Transaction> {
        try {
            const updateTransasction: Transaction = await this.prisma.transaction.update({
                where: {
                    id: upTrans.id
                },
                data: {
                    total_amount: upTrans.body.total_amount,
                    status_transaction: upTrans.body.status_transaction,                    
                },
                include: {
                    detail_buy: true,
                    care_transaction: {
                        include: {
                            detail_care: {
                                include: { careGive: true }
                            }
                        }
                    }                    
                }
            });
            return updateTransasction;
        } catch (error) {
            handlePrismaError(error);
        }           
    };

    async updatedCareTransaction(careTrans: UpdateCareTransaction): Promise<CareTransaction> {
        try {
            const updated: CareTransaction = await this.prisma.careTransaction.update({
                where: {
                    id: careTrans.id
                },
                data: {
                    duration_care: careTrans.body.duration_care,
                    start_date: new Date(careTrans.body.start_date),
                    finish_date: new Date(careTrans.body.finish_date),
                    one_day_price: careTrans.body.one_day_price,
                    sub_total: careTrans.body.sub_total                    
                },
                include: {
                    detail_care: {
                        include: { careGive: true }
                    }
                }
            });
            return updated;
        } catch (error) {
            handlePrismaError(error);
        }         
    };

    async updatedDetailBuy(upBuy: UpdateDetailBuy): Promise<DetailBuyTransaction> {
        try {
            const updated: DetailBuyTransaction = await this.prisma.$transaction(async (tx) => { 
                const oldDetail = await tx.detailBuyTransaction.findUnique({
                    where: { id: upBuy.id },
                    include: { livestock: true }, // biar dapat stok sekarang
                });
                if (!oldDetail) throw new Error("Detail not found");
                // count difference
                const oldQty = oldDetail.total_livestock;
                const newQty = upBuy.body.total_livestock;
                if (!newQty) throw new Error("Detail not found");
                const delta = newQty - oldQty;
                // Update stok in Livestock
                if (delta !== 0) {
                    await tx.livestock.update({
                    where: { id: oldDetail.livestock_id },
                    data: {
                        stock: { increment: -delta },
                        // delta positif (nambah beli) → stock berkurang
                        // delta negatif (ngurangin beli) → stock nambah
                    },
                    });
                }
                const updateDetail = await tx.detailBuyTransaction.update({
                    where: {
                        id: upBuy.id
                    },
                    data: {
                        total_livestock: upBuy.body.total_livestock,
                        sub_total: upBuy.body.sub_total                    
                    },
                });
                return updateDetail
            })
            return updated;
        } catch (error) {
            handlePrismaError(error);
        }          
    }

    async dropTransaction(id: number): Promise<Transaction> {
        try {
            const dropTransaction = await this.prisma.transaction.delete({
                where: {
                    id
                }
            });
            return dropTransaction;
        } catch (error) {
            handlePrismaError(error);
        }    
    }

    async reviewTransaction(review: Rating): Promise<Transaction> {
        try {
            const ratingTransaction: Transaction = await this.prisma.$transaction(async (tx) => { 
                const updateTransaction: Transaction = await tx.transaction.update({
                    where: {
                        id: review.id_transaction
                    },
                    data: {
                        rating: review.rating,
                        review: review.review,
                        status_transaction: "FINISH"
                    }
                });

                const avgRating = await tx.transaction.aggregate({
                    where: {
                        farm_id: review.farm_id,
                        status_transaction: 'FINISH',
                    },
                    _avg: {
                        rating: true,
                    },
                });

                await tx.farms.update({
                    where: {
                        id: review.farm_id
                    },
                    data: {
                        rating: avgRating._avg.rating
                    }
                })
                return updateTransaction
            });
            return ratingTransaction;
        } catch (error) {
            handlePrismaError(error);
        }  
    }
}