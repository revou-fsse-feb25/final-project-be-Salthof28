import { Inject, Injectable } from '@nestjs/common';
import { UsersRepositoryItf } from './users.repository.interface';
import { UpdatedUser, UpdatedUserByAdmin, UsersServiceItf } from './users.service.interface';
import { Users } from '@prisma/client';
import { UserNotFoundException } from './exception/user-not-found-exception';
import { Condition } from '../global/entities/condition-entity';
import { EmailRegisteredException } from '../auth/exception/email-registered-exception';
import { PhoneRegisteredException } from '../auth/exception/phone-registered-exception';
import * as bcrypt from 'bcrypt';
import { PasswordUserException } from './exception/password-user-exception';
import { UpdateUserDto } from './dto/req/update-user.dto';
import { RedisService } from 'redis/redis.service';

@Injectable()
export class UsersService implements UsersServiceItf {
  constructor(@Inject('UsersRepositoryItf') private usersRepository: UsersRepositoryItf, private readonly redisService: RedisService) {}

  async getAllUsers(query?: Condition): Promise<Users[]> {
    const allUsers: Users[] | undefined = await this.usersRepository.getAllUser(query);
    if(!allUsers) throw new UserNotFoundException();
    return allUsers;
  }
  
  async getProfile(id: number): Promise<Users> {
    // let cacheProfile: Users | null = await this.redisService.get(`${id}`);
    // if(!cacheProfile) {
    //   console.log('hello')
    //   const userProfile: Users | undefined = await this.usersRepository.findById(id);
    //   if(!userProfile) throw new UserNotFoundException();
    //   await this.redisService.set(`${id}`, userProfile);
    //   cacheProfile = userProfile;
    // }
    // return cacheProfile;
    const userProfile: Users | undefined = await this.usersRepository.findById(id);
    if(!userProfile) throw new UserNotFoundException();
    return userProfile
  }

  async findUserByAdmin(id: number): Promise<Users> {
    const user: Users | undefined = await this.usersRepository.findById(id);
    if(!user) throw new UserNotFoundException();
    return user;
  }

  async updateProfile(user: UpdatedUser): Promise<Users> {
    // check exis email or phone
    let conditions: Condition[] = [];
    if(user.body.email) {
        conditions.push({ email: user.body.email });
    }
    if(user.body.phone) {
        conditions.push({ phone: user.body.phone });
    }
    if(conditions.length > 0) await this.exceptionUpdate(conditions, user.body);
    // check old password
    if(user.body.password?.trim() && user.oldPassword?.trim()){
      const findUser: Users | undefined = await this.usersRepository.findById(user.id);
      if(!findUser) throw new UserNotFoundException();
      const oldPassword = user.oldPassword
      const isMatchPassword = await bcrypt.compare(oldPassword, findUser.password)
      if(!isMatchPassword) throw new PasswordUserException();
      const newPassword = user.body.password.trim();
      const newSaltRounds = 10;
      user.body.password = await bcrypt.hash(newPassword, newSaltRounds);
    }
    else if(user.body.password?.trim() && !user.oldPassword?.trim()) throw new PasswordUserException('old password no been input');
    else if(!user.body.password?.trim() && user.oldPassword?.trim()) throw new PasswordUserException('new password no been input');
    // update to database and redis
    const updated = await this.usersRepository.updatedProfile(user);
    await this.redisService.set(`${user.id}`, updated);
    return updated;
  }

  async exceptionUpdate(condition: Condition[], user: UpdateUserDto) {
    const exisUser: Users | undefined = await this.usersRepository.findExistingUser(condition);
    if(exisUser) {
      if(exisUser.email === user.email) throw new EmailRegisteredException();
      if(exisUser.phone === user.phone) throw new PhoneRegisteredException();
    };
  }

  async updateUserByAdmin(user: UpdatedUserByAdmin): Promise<Users> {
    await this.findUserByAdmin(user.id);
    const updateUser: Users = await this.usersRepository.updatedUserByAdmin(user);
    return updateUser;
  }

  async deletUserByAdmin(id: number): Promise<Users> {
    const deleteUser: Users = await this.usersRepository.deleteUser(id);
    return deleteUser;
  }

}
