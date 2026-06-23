import { SessionLogin, Users } from "@prisma/client";
import { CreateUserDto } from "./dto/req/create-user.dto";
import { Condition } from "../global/entities/condition-entity";
import { SessionDetailDto } from "./dto/req/create-session-login.dto";
import { UpdateRefreshTokenSessionDto } from "./dto/req/update-refresh-token-session.dto";
import { UpdateUserDto } from "./dto/req/update-user.dto";

export interface UsersRepositoryItf {
    getAllUser(query?: Condition): Promise<Users[] | undefined>;
    findEmail(email: string): Promise<Users | undefined>;
    findById(id: number): Promise<Users | undefined>;
    findExistingUser(condition: Condition[]): Promise<Users | undefined>;
    created(body: CreateUserDto): Promise<Users>;
    updatedProfile(user: UpdatedUser): Promise<Users>;
    updatedUserByAdmin(user: UpdatedUser): Promise<Users>;
    deleteUser(id: number): Promise<Users>;

    loginSession(session: SessionDetailDto): Promise<SessionLogin>;
    findSessionbyIdToken(id_token: string): Promise<SessionLogin | undefined>;
    updateRefreshToken(newRefreshToken: UpdateRefreshTokenSessionDto): Promise<SessionLogin>;
    deleteSession(id_token: string): Promise<SessionLogin>;
}

export interface UpdatedUser {
    id: number,
    body: Partial<UpdateUserDto>
}




